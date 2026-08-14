import type { GraphGroup } from './types'

export const DEFAULT_GRAPH_GROUPS: GraphGroup[] = []

export function parseGraphGroups(value: unknown): GraphGroup[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry, index): GraphGroup[] => {
    if (!entry || typeof entry !== 'object') {
      return []
    }
    const candidate = entry as Partial<GraphGroup>
    if (
      typeof candidate.query !== 'string' ||
      typeof candidate.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(candidate.color)
    ) {
      return []
    }
    return [
      {
        id:
          typeof candidate.id === 'string' && candidate.id.trim()
            ? candidate.id
            : `graph-group-${index + 1}`,
        query: candidate.query,
        color: candidate.color.toLowerCase()
      }
    ]
  })
}
