import { app } from 'electron'
import { open, readFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type { AppSettings } from '../shared/types'
import {
  DEFAULT_GRAPH_FORCE_SETTINGS,
  parseGraphForceSettings
} from '../shared/graph-settings'
import {
  DEFAULT_GRAPH_DISPLAY_SETTINGS,
  parseGraphDisplaySettings
} from '../shared/graph-display'
import {
  DEFAULT_GRAPH_FILTER_SETTINGS,
  parseGraphFilterSettings
} from '../shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS, parseGraphGroups } from '../shared/graph-groups'
import {
  DEFAULT_GRAPH_VIEW_STATES,
  parseGraphViewStates
} from '../shared/graph-view-state'
import { parseUserIgnoreFilters } from '../shared/excluded-files'
import {
  DEFAULT_CALENDAR_PLUGIN_SETTINGS,
  parseCalendarPluginSettings
} from '../shared/calendar-plugin-settings'

const DEFAULT_SETTINGS: AppSettings = {
  lastVaultPath: null,
  lastNotePath: null,
  userIgnoreFilters: [],
  graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
  graphDisplay: DEFAULT_GRAPH_DISPLAY_SETTINGS,
  graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
  graphGroups: DEFAULT_GRAPH_GROUPS,
  graphViewStates: DEFAULT_GRAPH_VIEW_STATES,
  templateDirectory: '90_テンプレート',
  showBuiltInTemplates: true
}
export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function parseSettings(parsed: Partial<AppSettings>): AppSettings {
  return {
      lastVaultPath:
        typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
      lastNotePath: typeof parsed.lastNotePath === 'string' ? parsed.lastNotePath : null,
      userIgnoreFilters: parseUserIgnoreFilters(parsed.userIgnoreFilters),
      graphForces: parseGraphForceSettings(parsed.graphForces),
      graphDisplay: parseGraphDisplaySettings(parsed.graphDisplay),
      graphFilters: parseGraphFilterSettings(parsed.graphFilters),
      graphGroups: parseGraphGroups(parsed.graphGroups),
      graphViewStates: parseGraphViewStates(parsed.graphViewStates),
      templateDirectory:
        typeof parsed.templateDirectory === 'string' &&
        parsed.templateDirectory.trim()
          ? parsed.templateDirectory.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
          : '90_テンプレート',
      showBuiltInTemplates:
        typeof parsed.showBuiltInTemplates === 'boolean'
          ? parsed.showBuiltInTemplates
          : true,
      ...(Object.prototype.hasOwnProperty.call(parsed, 'calendarPlugin')
        ? { calendarPlugin: parseCalendarPluginSettings(parsed.calendarPlugin) }
        : {}),
      ...(parsed.workspaceStateByVault &&
      typeof parsed.workspaceStateByVault === 'object' &&
      !Array.isArray(parsed.workspaceStateByVault)
        ? { workspaceStateByVault: parsed.workspaceStateByVault }
        : {})
  }
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    return parseSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function readRawSettingsForUpdate(): Promise<Record<string, unknown>> {
  let raw: string
  try {
    raw = await readFile(settingsPath(), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return {}
    throw error
  }
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('settings.json must contain an object.')
  }
  return parsed as Record<string, unknown>
}

export async function writeRawSettings(
  value: Record<string, unknown>,
  renameFile: (oldPath: string, newPath: string) => Promise<void> = rename
): Promise<void> {
  const destination = settingsPath()
  const temporary = join(dirname(destination), `.settings-${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(temporary, 'wx')
    await handle.writeFile(JSON.stringify(value, null, 2), 'utf8')
    await handle.close()
    handle = null
    await renameFile(temporary, destination)
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const raw = await readRawSettingsForUpdate()
  const current = parseSettings(raw as Partial<AppSettings>)
  const next = {
    ...current,
    ...patch,
    userIgnoreFilters: parseUserIgnoreFilters(
      patch.userIgnoreFilters ?? current.userIgnoreFilters
    ),
    graphViewStates: parseGraphViewStates(
      patch.graphViewStates ?? current.graphViewStates
    ),
    ...(patch.calendarPlugin !== undefined || current.calendarPlugin !== undefined
      ? {
          calendarPlugin: parseCalendarPluginSettings(
            patch.calendarPlugin ?? current.calendarPlugin ?? DEFAULT_CALENDAR_PLUGIN_SETTINGS
          )
        }
      : {})
  }
  const stored: Record<string, unknown> = { ...raw, ...next }
  delete stored.aiReviewPaths
  delete stored.aiImmutablePaths
  await writeRawSettings(stored)
  return next
}
