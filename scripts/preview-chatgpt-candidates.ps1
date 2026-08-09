[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$InputPath,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true, Position = 2)]
  [string]$VaultRoot,

  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$resolvedVault = (Resolve-Path -LiteralPath $VaultRoot).Path
$profileDirectory = Join-Path $resolvedVault '20_分野'
$profileNames = @(
  '本人プロフィール',
  '本人の関心とAI協働',
  '本人の健康と生活上の配慮',
  '本人の嗜好と日常',
  '本人の活動と技術環境'
)

if (-not $SkipBuild) {
  Push-Location $repositoryRoot
  try {
    & npm.cmd run build:chatgpt-candidates
    if ($LASTEXITCODE -ne 0) {
      throw 'ChatGPT candidate preview CLIのbuildに失敗しました。'
    }
  } finally {
    Pop-Location
  }
}

$previewCli = Join-Path $repositoryRoot 'work\tools\chatgpt-candidate-preview.js'
if (-not (Test-Path -LiteralPath $previewCli -PathType Leaf)) {
  throw 'Candidate preview CLIが見つかりません。先にbuildしてください。'
}

$arguments = @(
  $previewCli,
  '--input', $resolvedInput,
  '--output', $resolvedOutput,
  '--vault-root', $resolvedVault
)
foreach ($profileName in $profileNames) {
  $profilePath = Join-Path $profileDirectory ($profileName + '.md')
  if (-not (Test-Path -LiteralPath $profilePath -PathType Leaf)) {
    throw "人物プロフィール比較元が見つかりません: $profilePath"
  }
  $arguments += @('--profile', ($profileName + '=' + $profilePath))
}

& node @arguments
if ($LASTEXITCODE -ne 0) {
  throw 'ChatGPT candidate previewの生成に失敗しました。'
}
