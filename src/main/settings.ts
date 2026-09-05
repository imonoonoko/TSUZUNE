import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
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
import { parseAiReviewPaths } from '../shared/ai-write-policy'
import {
  DEFAULT_CALENDAR_PLUGIN_SETTINGS,
  parseCalendarPluginSettings
} from '../shared/calendar-plugin-settings'

const DEFAULT_SETTINGS: AppSettings = {
  lastVaultPath: null,
  lastNotePath: null,
  userIgnoreFilters: [],
  aiReviewPaths: [],
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

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      lastVaultPath:
        typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
      lastNotePath: typeof parsed.lastNotePath === 'string' ? parsed.lastNotePath : null,
      userIgnoreFilters: parseUserIgnoreFilters(parsed.userIgnoreFilters),
      aiReviewPaths: parseAiReviewPaths(parsed.aiReviewPaths),
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
        : {})
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings()
  const next = {
    ...current,
    ...patch,
    userIgnoreFilters: parseUserIgnoreFilters(
      patch.userIgnoreFilters ?? current.userIgnoreFilters
    ),
    aiReviewPaths: parseAiReviewPaths(
      patch.aiReviewPaths ?? current.aiReviewPaths
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
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
