import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRAPH_FILTER_SETTINGS,
  parseGraphFilterSettings
} from '../src/shared/graph-filters'

describe('Graph filter settings', () => {
  it('uses the Obsidian 1.13.4 defaults for missing or unknown settings', () => {
    expect(parseGraphFilterSettings(undefined)).toEqual(
      DEFAULT_GRAPH_FILTER_SETTINGS
    )
    expect(parseGraphFilterSettings('legacy')).toEqual(
      DEFAULT_GRAPH_FILTER_SETTINGS
    )
  })

  it('preserves boolean values and replaces invalid legacy values with defaults', () => {
    expect(
      parseGraphFilterSettings({
        showTags: true,
        showAttachments: true,
        existingFilesOnly: true,
        showOrphans: false,
        outgoingLinks: false,
        incomingLinks: false,
        neighborLinks: true,
        removedDepth: 4,
        unknown: true
      })
    ).toEqual({
      showTags: true,
      showAttachments: true,
      existingFilesOnly: true,
      showOrphans: false,
      outgoingLinks: false,
      incomingLinks: false,
      neighborLinks: true
    })

    expect(
      parseGraphFilterSettings({
        showTags: 'yes',
        showAttachments: 1,
        existingFilesOnly: null,
        showOrphans: undefined,
        outgoingLinks: 'both',
        incomingLinks: 0,
        neighborLinks: []
      })
    ).toEqual(DEFAULT_GRAPH_FILTER_SETTINGS)
  })
})
