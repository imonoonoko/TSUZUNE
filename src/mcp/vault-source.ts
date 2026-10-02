import { readFile, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseUserIgnoreFilters } from '../shared/excluded-files'
import { parseDeclaredPropertyTypes, type PropertyDeclaredType } from '../shared/property-changes'

interface StoredSettings {
  lastVaultPath?: unknown
  userIgnoreFilters?: unknown
  propertyTypesByVault?: unknown
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
  propertyTypes: Record<string, PropertyDeclaredType>
}> {
  if (options.explicitVaultPath?.trim()) {
    return {
      vaultPath: resolve(options.explicitVaultPath),
      userIgnoreFilters: [],
      propertyTypes: options.settingsPath ? await readPropertyTypes(options.explicitVaultPath, options.settingsPath) : {}
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
    propertyTypes: await propertyTypesForVault(parsed, parsed.lastVaultPath)
  }
}

async function propertyTypesForVault(settings: StoredSettings, vaultPath: string): Promise<Record<string, PropertyDeclaredType>> {
  const key = resolve(await realpath(vaultPath)).replaceAll('\\', '/').replace(/\/+$/, '').toLocaleLowerCase('en-US')
  const map = settings.propertyTypesByVault
  if (map === undefined) return {}
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Property設定の形式が不正です。')
  return parseDeclaredPropertyTypes((map as Record<string, unknown>)[key])
}

export async function readPropertyTypes(vaultPath: string, settingsPath: string): Promise<Record<string, PropertyDeclaredType>> {
  let raw: string
  try { raw = await readFile(settingsPath, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return propertyTypesForVault(JSON.parse(raw) as StoredSettings, vaultPath)
}
