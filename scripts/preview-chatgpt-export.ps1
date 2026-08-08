[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$InputPath,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$OutputPath,

  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$separator = [System.IO.Path]::DirectorySeparatorChar

if ($resolvedOutput -eq $resolvedInput -or $resolvedOutput.StartsWith($resolvedInput + $separator, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw '出力先は入力元の外側を指定してください。'
}

if (-not $SkipBuild) {
  Push-Location $repositoryRoot
  try {
    & npm.cmd run build:chatgpt-export
    if ($LASTEXITCODE -ne 0) {
      throw 'ChatGPT Export preview CLIのbuildに失敗しました。'
    }
  } finally {
    Pop-Location
  }
}

$previewCli = Join-Path $repositoryRoot 'work\tools\chatgpt-export-preview.js'
if (-not (Test-Path -LiteralPath $previewCli -PathType Leaf)) {
  throw 'Preview CLIが見つかりません。先にbuildしてください。'
}

$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$temporaryRoot = Join-Path $temporaryBase ('tsuzune-chatgpt-export-' + [guid]::NewGuid().ToString('N'))
$stagingDirectory = Join-Path $temporaryRoot 'conversations'
$sourceMapPath = Join-Path $temporaryRoot 'sources.json'
$selectedSourceFiles = [System.Collections.Generic.List[object]]::new()
$conversationEntries = [System.Collections.Generic.List[object]]::new()
$attachmentEntries = [System.Collections.Generic.List[object]]::new()

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-BytesSha256([byte[]]$Bytes) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($sha256.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Get-StreamSha256([System.IO.Stream]$Stream) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($sha256.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Add-StagedJson(
  [string]$SelectedPath,
  [string]$SelectedSha256,
  [string]$EntryPath,
  [string]$EntrySha256,
  [byte[]]$Bytes,
  [int]$Sequence
) {
  $stagedPath = Join-Path $stagingDirectory ('source-{0:D4}.json' -f $Sequence)
  [System.IO.File]::WriteAllBytes($stagedPath, $Bytes)
  $conversationEntries.Add([pscustomobject][ordered]@{
    selectedPath = $SelectedPath
    selectedSha256 = $SelectedSha256
    entryPath = $EntryPath
    entrySha256 = $EntrySha256
    stagedPath = $stagedPath
  })
}

New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $selectedFiles = if (Test-Path -LiteralPath $resolvedInput -PathType Container) {
    Get-ChildItem -LiteralPath $resolvedInput -Recurse -File | Where-Object {
      $_.Extension -ieq '.zip' -or $_.Name -match '^conversations(?:-\d+)?\.json$'
    } | Sort-Object FullName
  } else {
    Get-Item -LiteralPath $resolvedInput
  }

  $sequence = 0
  foreach ($selectedFile in $selectedFiles) {
    $selectedSha256 = Get-Sha256 $selectedFile.FullName
    $selectedSourceFiles.Add([pscustomobject][ordered]@{
      selectedPath = $selectedFile.FullName
      selectedSha256Before = $selectedSha256
      selectedSha256After = $null
      sourceKind = if ($selectedFile.Extension -ieq '.zip') { 'zip' } else { 'json' }
    })
    if ($selectedFile.Extension -ieq '.zip') {
      $archive = [System.IO.Compression.ZipFile]::OpenRead($selectedFile.FullName)
      try {
        $entryIndex = 0
        foreach ($entry in $archive.Entries) {
          if ($entry.FullName -match '(^|/)conversations(?:-\d+)?\.json$') {
            $stream = $entry.Open()
            $memory = $null
            try {
              $memory = [System.IO.MemoryStream]::new()
              $stream.CopyTo($memory)
              $bytes = $memory.ToArray()
            } finally {
              if ($memory) { $memory.Dispose() }
              $stream.Dispose()
            }
            $entrySha256 = Get-BytesSha256 $bytes
            $sequence += 1
            Add-StagedJson $selectedFile.FullName $selectedSha256 $entry.FullName $entrySha256 $bytes $sequence
          } elseif ($entry.FullName.EndsWith('.dat', [System.StringComparison]::Ordinal)) {
            $stream = $entry.Open()
            try {
              $entrySha256 = Get-StreamSha256 $stream
            } finally {
              $stream.Dispose()
            }
            $entryBaseName = [System.IO.Path]::GetFileName(
              $entry.FullName.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            )
            $attachmentEntries.Add([pscustomobject][ordered]@{
              selectedPath = $selectedFile.FullName
              selectedSha256 = $selectedSha256
              entryPath = $entry.FullName
              entryBaseName = $entryBaseName
              entryIndex = $entryIndex
              entrySize = $entry.Length
              entrySha256 = $entrySha256
            })
          }
          $entryIndex += 1
        }
      } finally {
        $archive.Dispose()
      }
    } elseif ($selectedFile.Name -match '^conversations(?:-\d+)?\.json$') {
      $bytes = [System.IO.File]::ReadAllBytes($selectedFile.FullName)
      $sequence += 1
      Add-StagedJson $selectedFile.FullName $selectedSha256 $selectedFile.Name $selectedSha256 $bytes $sequence
    }
  }

  if ($conversationEntries.Count -eq 0) {
    throw '対象となるconversations JSONが見つかりませんでした。'
  }

  foreach ($selectedSource in $selectedSourceFiles) {
    $selectedSource.selectedSha256After = Get-Sha256 $selectedSource.selectedPath
    if ($selectedSource.selectedSha256Before -ne $selectedSource.selectedSha256After) {
      throw "読取中に入力元が変化しました: $($selectedSource.selectedPath)"
    }
  }

  $sourceMap = [ordered]@{
    schemaVersion = 1
    selectedFiles = $selectedSourceFiles.ToArray()
    conversationEntries = $conversationEntries.ToArray()
    attachmentEntries = $attachmentEntries.ToArray()
  }
  [System.IO.File]::WriteAllText(
    $sourceMapPath,
    (ConvertTo-Json -InputObject $sourceMap -Depth 8),
    [System.Text.UTF8Encoding]::new($false)
  )

  & node $previewCli --sources $sourceMapPath --output $resolvedOutput
  if ($LASTEXITCODE -ne 0) {
    throw 'ChatGPT Export previewの生成に失敗しました。'
  }
} finally {
  $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
  $safePrefix = $temporaryBase.TrimEnd($separator) + $separator + 'tsuzune-chatgpt-export-'
  if ($resolvedTemporaryRoot.StartsWith($safePrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $resolvedTemporaryRoot -PathType Container)) {
    Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force
  }
}
