[CmdletBinding()]
param(
  [string]$CodexHome
)

$ErrorActionPreference = 'Stop'
$beginMarker = '# BEGIN TSUZUNE MCP'
$endMarker = '# END TSUZUNE MCP'

if (-not $CodexHome) {
  $CodexHome = if ($env:CODEX_HOME) {
    $env:CODEX_HOME
  } else {
    Join-Path $env:USERPROFILE '.codex'
  }
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverPath = Join-Path $repositoryRoot 'out\mcp\server.js'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
  throw 'MCPサーバーが未ビルドです。先に npm run build:mcp を実行してください。'
}

$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$configDirectory = [System.IO.Path]::GetFullPath($CodexHome)
$configPath = Join-Path $configDirectory 'config.toml'
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null

$existing = if (Test-Path -LiteralPath $configPath) {
  [System.IO.File]::ReadAllText($configPath)
} else {
  ''
}

$managedPattern = '(?ms)^# BEGIN TSUZUNE MCP\r?\n.*?^# END TSUZUNE MCP\r?\n?'
$hasManagedBlock = [regex]::IsMatch($existing, $managedPattern)
$hasUnmanagedBlock = [regex]::IsMatch(
  $existing,
  '(?m)^\[mcp_servers\.tsuzune\]\s*$'
)
if ($hasUnmanagedBlock -and -not $hasManagedBlock) {
  throw '既存の [mcp_servers.tsuzune] があるため、安全のため自動更新を中止しました。'
}

function ConvertTo-TomlString([string]$Value) {
  $escaped = $Value.Replace('\', '/').Replace('"', '\"')
  return '"' + $escaped + '"'
}

$block = @(
  $beginMarker
  '[mcp_servers.tsuzune]'
  'command = ' + (ConvertTo-TomlString $nodeCommand)
  'args = [' + (ConvertTo-TomlString $serverPath) + ']'
  'enabled = true'
  'required = false'
  'startup_timeout_sec = 10'
  'tool_timeout_sec = 60'
  'enabled_tools = ["search", "fetch", "get_backlinks", "build_context", "create_note", "update_note", "autonomous_update_note", "patch_note"]'
  'default_tools_approval_mode = "auto"'
  ''
  '[mcp_servers.tsuzune.tools.create_note]'
  'approval_mode = "prompt"'
  ''
  '[mcp_servers.tsuzune.tools.update_note]'
  'approval_mode = "prompt"'
  ''
  '[mcp_servers.tsuzune.tools.autonomous_update_note]'
  'approval_mode = "auto"'
  ''
  '[mcp_servers.tsuzune.tools.patch_note]'
  'approval_mode = "prompt"'
  $endMarker
) -join [Environment]::NewLine
$block += [Environment]::NewLine

if ($hasManagedBlock) {
  $updated = [regex]::Replace($existing, $managedPattern, $block)
} else {
  $separator = if (-not $existing) {
    ''
  } elseif ($existing.EndsWith("`n`n") -or $existing.EndsWith("`r`n`r`n")) {
    ''
  } elseif ($existing.EndsWith("`n")) {
    [Environment]::NewLine
  } else {
    [Environment]::NewLine + [Environment]::NewLine
  }
  $updated = $existing + $separator + $block
}

if ($updated -eq $existing) {
  Write-Host "TSUZUNE MCPは既に登録済みです: $configPath"
  exit 0
}

if (Test-Path -LiteralPath $configPath) {
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = "$configPath.tsuzune-backup-$timestamp"
  Copy-Item -LiteralPath $configPath -Destination $backupPath
  Write-Host "バックアップ: $backupPath"
}

[System.IO.File]::WriteAllText(
  $configPath,
  $updated,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "TSUZUNE MCPを登録しました: $configPath"
Write-Host 'Codex Desktopを再起動し、タスクの入力欄で /mcp を実行してください。'
