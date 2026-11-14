import { validateRelativePath } from '../core/paths'
import { isAiImmutablePath } from './ai-write-policy'
import type { WorkspaceScope } from './workspace-state'

export function isVersionedNotePath(path: string): boolean {
  const checked = validateRelativePath(path)
  return Boolean(checked.valid && checked.normalized?.toLowerCase().endsWith('.md') && !isAiImmutablePath(checked.normalized))
}

export interface NoteVersion { id: string; savedAt: number; size: number }
export interface NoteHistory {
  scope: WorkspaceScope
  path: string
  content: string
  modifiedAt: number
  versions: NoteVersion[]
}
export interface ReadNoteVersionInput { scope: WorkspaceScope; path: string; id: string }
export interface RestoreNoteVersionInput extends ReadNoteVersionInput {
  expectedContent: string
  expectedModifiedAt: number
}
