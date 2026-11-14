export interface NoteComposeInput {
  scope: { rootPath: string; rootRevision: number }
  mode: 'extract' | 'merge'
  sourcePath: string
  expectedSourceContent: string
  targetPath: string
  targetMode: 'new' | 'existing'
  placement: 'append' | 'prepend'
  sourceReplacement?: 'link' | 'embed' | 'none'
  targetTemplate?: { path: string; now: string }
  range?: { from: number; to: number }
}
export interface NoteComposeChange { path: string; kind: 'create' | 'update' | 'trash'; before: string | null; after: string | null }
export interface NoteComposePreview { fingerprint: string; sourcePath: string; targetPath: string; changes: NoteComposeChange[]; updatedLinkCount: number }
export interface NoteComposeApplyInput { input: NoteComposeInput; fingerprint: string }
export interface NoteComposeResult { path: string; changedPaths: string[]; trashedPath?: string }
