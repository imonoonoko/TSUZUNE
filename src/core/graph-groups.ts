import type { GraphGroup, NoteDocument } from '../shared/types'
import type { WikiGraphNode } from './graph'
import { matchesGraphQuery } from './graph-query'
import { extractMarkdownTags } from './tags'

export function getGraphNodeGroupColor(
  node: WikiGraphNode,
  groups: readonly GraphGroup[],
  notes: readonly NoteDocument[]
): string | null {
  if (
    node.kind === 'tag' ||
    node.kind === 'unresolved' ||
    node.exists === false
  ) {
    return null
  }
  const note = notes.find((candidate) => candidate.path === node.path)
  const document = {
    path: node.path,
    name: node.name,
    kind: node.kind,
    content: note?.content,
    tags: note ? extractMarkdownTags(note.content) : []
  }

  for (const group of groups) {
    if (group.query.trim() && matchesGraphQuery(document, group.query)) {
      return group.color
    }
  }
  return null
}
