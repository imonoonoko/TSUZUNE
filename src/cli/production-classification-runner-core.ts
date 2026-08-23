import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extractFile } from '@electron/asar'
import type { DrivePathAliasRelocationPreview } from './drive-path-alias-relocation-prototype'

type ProcessExecutor = (
  file: string,
  args: readonly string[],
  options: {
    encoding: 'utf8'
    env: NodeJS.ProcessEnv
    windowsHide: boolean
  }
) => string

export interface OAuthBuildCredentials {
  clientId: string
  clientSecret: string
}

export function findSingleBundledValue(
  source: string,
  pattern: RegExp,
  label: string
): string {
  const values = [...new Set(source.match(pattern) ?? [])]
  if (values.length !== 1) {
    throw new Error(
      `Could not safely recover the existing ${label} (${values.length} candidates).`
    )
  }
  return values[0]
}

export function resolveOAuthBuildCredentials(
  installedAsarPath: string,
  environment: NodeJS.ProcessEnv = process.env
): OAuthBuildCredentials {
  const clientId = environment.MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = environment.MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(
      'Both Google OAuth build environment variables must be set together.'
    )
  }
  if (clientId && clientSecret) return { clientId, clientSecret }
  if (!existsSync(installedAsarPath)) {
    throw new Error(
      'Google OAuth build values are absent and the installed bundle is missing.'
    )
  }
  const mainSource = extractFile(
    installedAsarPath,
    'out\\main\\index.js'
  ).toString('utf8')
  return {
    clientId: findSingleBundledValue(
      mainSource,
      /[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com/g,
      'Google OAuth client ID'
    ),
    clientSecret: findSingleBundledValue(
      mainSource,
      /GOCSPX-[A-Za-z0-9_-]+/g,
      'Google OAuth client secret'
    )
  }
}

export function countInstalledProductionProcesses(
  installedExecutable: string,
  execute: ProcessExecutor = (file, args, options) =>
    execFileSync(file, [...args], options)
): number {
  const script = [
    '$target = [IO.Path]::GetFullPath($env:TSUZUNE_PROCESS_TARGET)',
    "$count = @(Get-Process -Name 'TSUZUNE' -ErrorAction SilentlyContinue | Where-Object {",
    '  try { [IO.Path]::GetFullPath($_.Path) -eq $target } catch { $false }',
    '}).Count',
    'Write-Output $count'
  ].join('\n')
  const output = execute(
    'powershell.exe',
    ['-NoProfile', '-Command', script],
    {
      encoding: 'utf8',
      env: { ...process.env, TSUZUNE_PROCESS_TARGET: installedExecutable },
      windowsHide: true
    }
  )
  const count = Number(output.trim())
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Could not verify whether production TSUZUNE is running.')
  }
  return count
}

export async function assertProductionNotRunning(
  installedExecutable: string,
  countProcesses: (path: string) => number = countInstalledProductionProcesses
): Promise<void> {
  if (countProcesses(installedExecutable) > 0) {
    throw new Error(
      'Production TSUZUNE is running. Save and close it before classification relocation.'
    )
  }
}

export function sanitizedPreview(
  preview: DrivePathAliasRelocationPreview
): {
  fingerprint: string
  moveCount: number
  moves: Array<{
    sourcePath: string
    destinationPath: string
    contentHash: string
  }>
} {
  return {
    fingerprint: preview.fingerprint,
    moveCount: preview.moves.length,
    moves: preview.moves.map((move) => ({
      sourcePath: move.sourcePath,
      destinationPath: move.destinationPath,
      contentHash: move.contentHash
    }))
  }
}
