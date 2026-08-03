import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRAPH_VIEW_STATES,
  parseGraphViewStates
} from '../src/shared/graph-view-state'

describe('graph view state', () => {
  it('opens settings for a fresh Vault graph while keeping a fresh Local graph closed', () => {
    expect(parseGraphViewStates(undefined)).toEqual({
      local: {
        ...DEFAULT_GRAPH_VIEW_STATES.local,
        settingsOpen: false
      },
      vault: {
        ...DEFAULT_GRAPH_VIEW_STATES.vault,
        settingsOpen: true
      }
    })
  })

  it('adds defaults per scope and clamps persisted zoom to the Obsidian range', () => {
    expect(
      parseGraphViewStates({
        local: {
          scale: 99,
          settingsOpen: true,
          settingsSections: {
            filters: true,
            groups: false,
            display: true,
            forces: false
          }
        }
      })
    ).toEqual({
      local: {
        scale: 8,
        query: '',
        settingsOpen: true,
        settingsSections: {
          filters: true,
          groups: false,
          display: true,
          forces: false
        }
      },
      vault: DEFAULT_GRAPH_VIEW_STATES.vault
    })

    expect(
      parseGraphViewStates({
        vault: {
          scale: 0,
          settingsOpen: false,
          settingsSections: {
            filters: false,
            groups: true,
            display: false,
            forces: true
          }
        }
      }).vault.scale
    ).toBe(1 / 128)
  })
})
