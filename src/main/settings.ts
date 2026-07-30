import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  lastVaultPath: null,
  lastNotePath: null
}
function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      lastVaultPath:
        typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
      lastNotePath: typeof parsed.lastNotePath === 'string' ? parsed.lastNotePath : null
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings()
  const next = {
    ...current,
    ...patch
  }
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
