[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$CandidatePath,
  [Parameter(Mandatory = $true, Position = 1)][string]$SourcePath,
  [Parameter(Mandatory = $true, Position = 2)][string]$OutputPath,
  [Parameter(Mandatory = $true, Position = 3)][string]$VaultRoot,
  [string]$ReviewPath,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $SkipBuild) {
  Push-Location $repositoryRoot
  try {
    & npm.cmd run build:chatgpt-candidate-quality
    if ($LASTEXITCODE -ne 0) { throw 'Candidate quality CLIのbuildに失敗しました。' }
  } finally { Pop-Location }
}

$arguments = @(
  (Join-Path $repositoryRoot 'work\tools\chatgpt-candidate-quality.js'),
  '--candidates', (Resolve-Path -LiteralPath $CandidatePath).Path,
  '--source', (Resolve-Path -LiteralPath $SourcePath).Path,
  '--output', [System.IO.Path]::GetFullPath($OutputPath),
  '--vault-root', (Resolve-Path -LiteralPath $VaultRoot).Path
)
if ($ReviewPath) { $arguments += @('--reviews', (Resolve-Path -LiteralPath $ReviewPath).Path) }
& node @arguments
if ($LASTEXITCODE -ne 0) { throw 'Candidate quality previewの生成に失敗しました。' }
