import type { PropertyChangeScope } from './property-changes'

export interface BaseChangeInput {
  scope: PropertyChangeScope
  path: string
  expectedRevision: string
  content: string
}
export interface BaseChangePreview {
  path: string
  expectedRevision: string
  before: string
  after: string
  changed: boolean
}
