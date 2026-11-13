import type { PropertyChangeScope } from './property-changes'
export interface KanbanFolderMoveInput {
  scope: PropertyChangeScope
  basePath: string
  expectedBaseRevision: string
  viewIndex: number
  sourcePath: string
  /** SHA-256 hex of the saved source content. */
  expectedSourceRevision: string
  destinationDirectory: string
}
export interface KanbanFolderMovePreview {
  source: string
  destination: string
  fingerprint: string
  linkImpact: { affectedCount: number; sourcePaths: string[] }
}
export interface KanbanFolderMoveApplyInput extends KanbanFolderMoveInput { expectedFingerprint: string }
