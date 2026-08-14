import type { GraphFilterSettings } from './types'

export type { GraphFilterSettings }

export const DEFAULT_GRAPH_FILTER_SETTINGS: GraphFilterSettings = {
  showTags: false,
  showAttachments: false,
  existingFilesOnly: false,
  showOrphans: true,
  outgoingLinks: true,
  incomingLinks: true,
  neighborLinks: false
}

export function parseGraphFilterSettings(value: unknown): GraphFilterSettings {
  const candidate =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Partial<GraphFilterSettings>)
      : null

  const booleanOrDefault = (setting: keyof GraphFilterSettings): boolean =>
    typeof candidate?.[setting] === 'boolean'
      ? candidate[setting]
      : DEFAULT_GRAPH_FILTER_SETTINGS[setting]

  return {
    showTags: booleanOrDefault('showTags'),
    showAttachments: booleanOrDefault('showAttachments'),
    existingFilesOnly: booleanOrDefault('existingFilesOnly'),
    showOrphans: booleanOrDefault('showOrphans'),
    outgoingLinks: booleanOrDefault('outgoingLinks'),
    incomingLinks: booleanOrDefault('incomingLinks'),
    neighborLinks: booleanOrDefault('neighborLinks')
  }
}
