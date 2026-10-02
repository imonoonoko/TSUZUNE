export type PropertyDeclaredType = 'text' | 'number' | 'checkbox' | 'list' | 'date' | 'datetime'

export type PropertyValue =
  | { type: 'text'; value: string }
  | { type: 'number'; value: string }
  | { type: 'date'; value: string }
  | { type: 'datetime'; value: string }
  | { type: 'checkbox'; value: boolean }
  | { type: 'list'; value: { type: 'text' | 'number'; value: string }[] }

export type PropertyChangeOperation =
  | { kind: 'set'; property: string; value: PropertyValue }
  | { kind: 'convert'; property: string; targetType: PropertyDeclaredType }
  | { kind: 'rename'; property: string; newName: string }

export interface PropertyChangeScope {
  rootPath: string
  rootRevision: number
}

export interface PropertyChangeIssue {
  code: string
  message: string
}

export interface PropertyPreviewInput {
  scope: PropertyChangeScope
  operation: PropertyChangeOperation
  paths: string[]
}

export interface PropertyPreviewItem {
  path: string
  expectedRevision: string | null
  before: PropertyValue | null
  after: PropertyValue | null
  changed: boolean
  issue?: PropertyChangeIssue
}

export interface PropertyPreviewResult {
  items: PropertyPreviewItem[]
}

export interface PropertyApplyInput {
  scope: PropertyChangeScope
  operation: PropertyChangeOperation
  targets: { path: string; expectedRevision: string }[]
}

export interface PropertyApplyResult {
  saved: string[]
  unchanged: string[]
  failed: (PropertyChangeIssue & { path: string })[]
  notAttempted: string[]
  registryError?: string
}

/** Reads only the six declared types; unknown settings entries cannot grant a type. */
export function parseDeclaredPropertyTypes(raw: unknown): Record<string, PropertyDeclaredType> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, PropertyDeclaredType> = Object.create(null)
  for (const [name, type] of Object.entries(raw)) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) continue
    if (type === 'text' || type === 'number' || type === 'checkbox' || type === 'list' || type === 'date' || type === 'datetime') {
      Object.defineProperty(result, name, { value: type, enumerable: true, configurable: true, writable: true })
    }
  }
  return result
}
