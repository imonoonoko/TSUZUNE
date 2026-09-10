import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../src/core/graph-layout'
import { parseGraphForceSettings } from '../src/shared/graph-settings'
import * as graphDisplayModule from '../src/shared/graph-display'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../src/shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../src/shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../src/shared/graph-view-state'

const graphDisplay = graphDisplayModule as typeof graphDisplayModule & {
  parseGraphDisplaySettings(value: unknown): graphDisplayModule.GraphDisplaySettings
}

const appData = vi.hoisted(() => ({ path: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: () => appData.path
  }
}))

import {
  readSettings,
  readRawSettingsForUpdate,
  updateSettings,
  writeRawSettings
} from '../src/main/settings'

describe('App settings', () => {
  beforeEach(async () => {
    appData.path = await mkdtemp(join(tmpdir(), 'tsuzune-settings-'))
  })

  afterEach(async () => {
    await rm(appData.path, { recursive: true, force: true })
  })

  it('ignores legacy review paths and removes them on the next settings save', async () => {
    const path = join(appData.path, 'settings.json')
    const legacy = JSON.stringify({ lastVaultPath: 'C:/Vault', aiReviewPaths: ['30_知識'], custom: 'keep' })
    await writeFile(path, legacy, 'utf8')
    expect(await readSettings()).not.toHaveProperty('aiReviewPaths')
    expect(await readFile(path, 'utf8')).toBe(legacy)
    await updateSettings({ lastNotePath: 'Home.md' })
    const saved = JSON.parse(await readFile(path, 'utf8'))
    expect(saved).not.toHaveProperty('aiReviewPaths')
    expect(saved).toMatchObject({ lastVaultPath: 'C:/Vault', lastNotePath: 'Home.md', custom: 'keep' })
  })

  it('adds default graph settings when reading an older version', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )

    await expect(readSettings()).resolves.toEqual({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
      graphDisplay: graphDisplay.DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
      graphGroups: DEFAULT_GRAPH_GROUPS,
      graphViewStates: DEFAULT_GRAPH_VIEW_STATES,
      userIgnoreFilters: [],
      templateDirectory: '90_テンプレート',
      showBuiltInTemplates: true
    })
  })

  it('saves and reads graph filter settings without losing other app settings', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )
    const graphFilters = {
      showTags: true,
      showAttachments: true,
      existingFilesOnly: true,
      showOrphans: false,
      outgoingLinks: false,
      incomingLinks: true,
      neighborLinks: true
    }

    await updateSettings({ graphFilters })

    await expect(readSettings()).resolves.toEqual({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
      graphDisplay: graphDisplay.DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters,
      graphGroups: DEFAULT_GRAPH_GROUPS,
      graphViewStates: DEFAULT_GRAPH_VIEW_STATES,
      userIgnoreFilters: [],
      templateDirectory: '90_テンプレート',
      showBuiltInTemplates: true
    })
  })

  it('saves and reads ordered graph groups without losing other app settings', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )
    const graphGroups = [
      { id: 'projects', query: 'path:Projects', color: '#e57373' },
      { id: 'ideas', query: 'tag:#idea', color: '#64b5f6' }
    ]

    await updateSettings({ graphGroups })

    await expect(readSettings()).resolves.toMatchObject({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      graphGroups
    })
  })

  it('saves the chosen template folder and built-in visibility', async () => {
    await updateSettings({
      templateDirectory: '雛形',
      showBuiltInTemplates: false
    })

    await expect(readSettings()).resolves.toMatchObject({
      templateDirectory: '雛形',
      showBuiltInTemplates: false
    })
  })

  it('persists and validates Calendar plugin settings without changing older settings shape', async () => {
    await updateSettings({
      calendarPlugin: {
        shouldConfirmBeforeCreate: false,
        weekStart: 'monday',
        wordsPerDot: 0,
        showWeeklyNote: true,
        weeklyNoteFormat: ' YYYY-[W]WW ',
        weeklyNoteTemplate: ' template ',
        weeklyNoteFolder: ' weekly ',
        localeOverride: ' ja '
      }
    })

    await expect(readSettings()).resolves.toMatchObject({
      calendarPlugin: {
        shouldConfirmBeforeCreate: false,
        weekStart: 'monday',
        wordsPerDot: 0,
        showWeeklyNote: true,
        weeklyNoteFormat: ' YYYY-[W]WW '
      }
    })
  })

  it('fails safe when persisted Calendar settings are malformed', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ calendarPlugin: { wordsPerDot: -1, weekStart: 'invalid' } }),
      'utf8'
    )

    await expect(readSettings()).resolves.toMatchObject({
      calendarPlugin: {
        shouldConfirmBeforeCreate: true,
        weekStart: 'locale',
        wordsPerDot: 250
      }
    })
  })

  it('parses graph display settings and clamps them to the public UI ranges', () => {
    expect(
      graphDisplay.parseGraphDisplaySettings({
        arrows: true,
        textFade: 99,
        nodeSize: -1,
        lineSize: Number.NaN
      })
    ).toEqual({
      arrows: true,
      textFade: 3,
      nodeSize: 0.1,
      lineSize: graphDisplay.DEFAULT_GRAPH_DISPLAY_SETTINGS.lineSize
    })
  })

  it('saves and reads graph display settings without losing other app settings', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )
    const graphDisplaySettings = {
      arrows: true,
      textFade: -1.2,
      nodeSize: 2,
      lineSize: 0.5
    }

    await updateSettings({ graphDisplay: graphDisplaySettings } as never)

    await expect(readSettings()).resolves.toMatchObject({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      graphForces: DEFAULT_GRAPH_FORCE_SETTINGS,
      graphDisplay: graphDisplaySettings
    })
  })

  it('saves graph forces without losing the active Vault and note', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )
    const graphForces = {
      centerForce: 0.25,
      repelForce: 15,
      linkForce: 0.6,
      linkDistance: 406
    }

    await updateSettings({ graphForces })

    expect(
      JSON.parse(await readFile(join(appData.path, 'settings.json'), 'utf8'))
    ).toEqual({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      graphForces,
      graphDisplay: graphDisplay.DEFAULT_GRAPH_DISPLAY_SETTINGS,
      graphFilters: DEFAULT_GRAPH_FILTER_SETTINGS,
      graphGroups: DEFAULT_GRAPH_GROUPS,
      graphViewStates: DEFAULT_GRAPH_VIEW_STATES,
      userIgnoreFilters: [],
      templateDirectory: '90_テンプレート',
      showBuiltInTemplates: true
    })
  })

  it('saves independent normalized graph view state for Local and Vault', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ lastVaultPath: 'C:/Vault', lastNotePath: 'A.md' }),
      'utf8'
    )

    await updateSettings({
      graphViewStates: {
        local: {
          scale: 16,
          query: 'file:Local',
          settingsOpen: true,
          settingsSections: {
            filters: true,
            groups: false,
            display: true,
            forces: false
          }
        },
        vault: {
          scale: 0.5,
          query: 'path:Projects',
          settingsOpen: false,
          settingsSections: {
            filters: false,
            groups: true,
            display: false,
            forces: true
          }
        }
      }
    })

    await expect(readSettings()).resolves.toMatchObject({
      graphViewStates: {
        local: {
          scale: 8,
          query: 'file:Local',
          settingsOpen: true,
          settingsSections: {
            filters: true,
            groups: false,
            display: true,
            forces: false
          }
        },
        vault: {
          scale: 0.5,
          query: 'path:Projects',
          settingsOpen: false,
          settingsSections: {
            filters: false,
            groups: true,
            display: false,
            forces: true
          }
        }
      }
    })
  })

  it('rejects non-finite force values and clamps values to the slider range', () => {
    expect(
      parseGraphForceSettings({
        centerForce: Number.NaN,
        repelForce: Number.POSITIVE_INFINITY,
        linkForce: -20,
        linkDistance: 120
      })
    ).toEqual({
      centerForce: DEFAULT_GRAPH_FORCE_SETTINGS.centerForce,
      repelForce: DEFAULT_GRAPH_FORCE_SETTINGS.repelForce,
      linkForce: 0,
      linkDistance: 120
    })
  })

  it('saves and normalizes excluded file filters without losing other settings', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({
        lastVaultPath: 'C:/Vault',
        lastNotePath: 'A.md',
        userIgnoreFilters: ['old']
      }),
      'utf8'
    )

    await updateSettings({
      userIgnoreFilters: [' 80_excluded ', '', '/\\.private\\.md$/']
    })

    await expect(readSettings()).resolves.toMatchObject({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      userIgnoreFilters: ['80_excluded', '/\\.private\\.md$/']
    })
  })

  it('drops the retired AI immutable path setting on the next save', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({
        lastVaultPath: 'C:/Vault',
        lastNotePath: 'A.md',
        aiImmutablePaths: ['Private']
      }),
      'utf8'
    )

    await updateSettings({ userIgnoreFilters: ['Archive'] })

    const stored = JSON.parse(
      await readFile(join(appData.path, 'settings.json'), 'utf8')
    ) as Record<string, unknown>
    expect(stored.aiImmutablePaths).toBeUndefined()
  })

  it('preserves unrelated unknown fields while updating known settings', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({
        lastVaultPath: 'C:/Vault',
        futureFeature: { version: 7, enabled: true },
        workspaceStateByVault: { 'c:/other': { version: 99, opaque: true } }
      }),
      'utf8'
    )

    await updateSettings({ lastNotePath: 'A.md' })

    await expect(readRawSettingsForUpdate()).resolves.toMatchObject({
      lastVaultPath: 'C:/Vault',
      lastNotePath: 'A.md',
      futureFeature: { version: 7, enabled: true },
      workspaceStateByVault: { 'c:/other': { version: 99, opaque: true } }
    })
  })

  it('refuses to replace malformed existing settings', async () => {
    const path = join(appData.path, 'settings.json')
    await writeFile(path, '{ broken', 'utf8')

    await expect(updateSettings({ lastNotePath: 'A.md' })).rejects.toThrow()
    await expect(readFile(path, 'utf8')).resolves.toBe('{ broken')
  })

  it('keeps old bytes and cleans only its temp file when atomic rename fails', async () => {
    const path = join(appData.path, 'settings.json')
    const oldBytes = '{"lastVaultPath":"C:/Vault"}'
    await writeFile(path, oldBytes, 'utf8')

    await expect(
      writeRawSettings(
        { lastVaultPath: 'D:/Vault' },
        async () => Promise.reject(new Error('rename failed'))
      )
    ).rejects.toThrow('rename failed')

    await expect(readFile(path, 'utf8')).resolves.toBe(oldBytes)
    await expect(readdir(appData.path)).resolves.toEqual(['settings.json'])
  })
})
