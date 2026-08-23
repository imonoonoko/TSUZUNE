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

$toolCatalogPath = Join-Path $repositoryRoot 'src\mcp\tool-catalog.json'
$toolCatalog = Get-Content -Raw -LiteralPath $toolCatalogPath | ConvertFrom-Json
$enabledTools = @($toolCatalog.common | ForEach-Object {
  ConvertTo-TomlString ([string]$_)
}) -join ', '
$approvalBlocks = @()
foreach ($override in $toolCatalog.codex.approvalOverrides.PSObject.Properties) {
  $approvalBlocks += ''
  $approvalBlocks += "[mcp_servers.tsuzune.tools.$($override.Name)]"
  $approvalBlocks += 'approval_mode = ' + (ConvertTo-TomlString ([string]$override.Value))
}

$blockLines = @(
  $beginMarker
  '[mcp_servers.tsuzune]'
  'command = ' + (ConvertTo-TomlString $nodeCommand)
  'args = [' + (ConvertTo-TomlString $serverPath) + ']'
  'enabled = true'
  'required = false'
  'startup_timeout_sec = 10'
  'tool_timeout_sec = 180'
  "enabled_tools = [$enabledTools]"
  'default_tools_approval_mode = ' + (ConvertTo-TomlString ([string]$toolCatalog.codex.defaultApproval))
)
$blockLines += $approvalBlocks
$blockLines += @(
  $endMarker
)
$block = $blockLines -join [Environment]::NewLine
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
