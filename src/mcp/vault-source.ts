import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseUserIgnoreFilters } from '../shared/excluded-files'
import {
  parseAiImmutablePaths,
  parseAiReviewPaths
} from '../shared/ai-write-policy'

interface StoredSettings {
  lastVaultPath?: unknown
  userIgnoreFilters?: unknown
  aiImmutablePaths?: unknown
  aiReviewPaths?: unknown
}

export interface VaultSourceOptions {
  explicitVaultPath?: string
  settingsPath?: string
}

export function defaultSettingsPath(): string {
  const appData = process.env.APPDATA
  return join(appData || join(homedir(), 'AppData', 'Roaming'), 'tsuzune', 'settings.json')
}

export async function resolveVaultSource(
  options: VaultSourceOptions = {}
): Promise<{
  vaultPath: string
  userIgnoreFilters: string[]
  aiImmutablePaths: string[]
  aiReviewPaths: string[]
}> {
  if (options.explicitVaultPath?.trim()) {
    return {
      vaultPath: resolve(options.explicitVaultPath),
      userIgnoreFilters: [],
      aiImmutablePaths: [],
      aiReviewPaths: []
    }
  }

  const path = options.settingsPath || defaultSettingsPath()
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new Error(
      'TSUZUNEでVaultを一度開くか、MCPサーバーへ --vault を指定してください。'
    )
  }

  let parsed: StoredSettings
  try {
    parsed = JSON.parse(raw) as StoredSettings
  } catch {
    throw new Error('TSUZUNEのsettings.jsonを読み取れませんでした。')
  }

  if (typeof parsed.lastVaultPath !== 'string' || !parsed.lastVaultPath.trim()) {
    throw new Error(
      'TSUZUNEでVaultを一度開くか、MCPサーバーへ --vault を指定してください。'
    )
  }

  return {
    vaultPath: resolve(parsed.lastVaultPath),
    userIgnoreFilters: parseUserIgnoreFilters(parsed.userIgnoreFilters),
    aiImmutablePaths: parseAiImmutablePaths(parsed.aiImmutablePaths),
    aiReviewPaths: parseAiReviewPaths(parsed.aiReviewPaths)
  }
}
