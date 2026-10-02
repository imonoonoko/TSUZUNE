import type { PropertyChangeScope } from './property-changes'

export interface MentionChangeInput {
  scope: PropertyChangeScope
  sourcePath: string
  targetPath: string
  expectedRevision: string
  range: { from: number; to: number }
  text: string
}
