[CmdletBinding()]
param(
  [string]$CodexHome
)

$ErrorActionPreference = 'Stop'

if (-not $CodexHome) {
  $CodexHome = if ($env:CODEX_HOME) {
    $env:CODEX_HOME
  } else {
    Join-Path $env:USERPROFILE '.codex'
  }
}

$configPath = Join-Path ([System.IO.Path]::GetFullPath($CodexHome)) 'config.toml'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  Write-Host 'Codex設定ファイルがないため、変更はありません。'
  exit 0
}

$existing = [System.IO.File]::ReadAllText($configPath)
$managedPattern = '(?ms)^# BEGIN TSUZUNE MCP\r?\n.*?^# END TSUZUNE MCP\r?\n?'
if (-not [regex]::IsMatch($existing, $managedPattern)) {
  Write-Host 'TSUZUNEが管理するMCP設定は見つかりませんでした。'
  exit 0
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "$configPath.tsuzune-backup-$timestamp"
Copy-Item -LiteralPath $configPath -Destination $backupPath

$updated = [regex]::Replace($existing, $managedPattern, '')
[System.IO.File]::WriteAllText(
  $configPath,
  $updated,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "TSUZUNE MCPの登録を解除しました: $configPath"
Write-Host "バックアップ: $backupPath"
Write-Host '反映するにはChatGPTデスクトップを再起動してください。'
