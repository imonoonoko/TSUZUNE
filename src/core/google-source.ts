import { parseFrontmatter } from './frontmatter'
import type { NoteDocument } from '../shared/types'

export interface GoogleSourceObservation {
  accountSub: string
  sourceKind: string
  containerId?: string
  resourceId: string
  sourceUpdatedAt?: string
  importedAt: string
  contentHash: string
}

export type GoogleSourceImportDecision =
  | {
      action: 'skip'
      reason: 'same_observation'
      existingPath: string
    }
  | {
      action: 'create'
      reason: 'new_resource' | 'changed_observation'
      existingPaths: string[]
    }

function requiredValue(
  attributes: Record<string, string | null>,
  field: string,
  path: string
): string {
  const value = attributes[field]?.trim()
  if (!value) {
    throw new Error(`Google情報源「${path}」の${field}が不正です。`)
  }
  return value
}

function optionalValue(
  attributes: Record<string, string | null>,
  field: string
): string | undefined {
  const value = attributes[field]?.trim()
  return value || undefined
}

function requiredSha256(
  attributes: Record<string, string | null>,
  field: string,
  path: string
): string {
  const value = requiredValue(attributes, field, path)
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`Google情報源「${path}」の${field}が不正です。`)
  }
  return value.toLowerCase()
}

function parseStoredObservation(
  note: NoteDocument
): GoogleSourceObservation | null {
  const frontmatter = parseFrontmatter(note.content)
  if (frontmatter.attributes.source_provider !== 'google') {
    return null
  }
  if (frontmatter.attributes.kind !== 'source' || frontmatter.warnings.length > 0) {
    throw new Error(`Google情報源「${note.path}」のfrontmatterが不正です。`)
  }

  return {
    accountSub: requiredValue(
      frontmatter.attributes,
      'source_account_sub',
      note.path
    ),
    sourceKind: requiredValue(
      frontmatter.attributes,
      'source_kind',
      note.path
    ),
    ...(optionalValue(frontmatter.attributes, 'source_container_id')
      ? {
          containerId: optionalValue(
            frontmatter.attributes,
            'source_container_id'
          )
        }
      : {}),
    resourceId: requiredValue(
      frontmatter.attributes,
      'source_resource_id',
      note.path
    ),
    ...(optionalValue(frontmatter.attributes, 'source_updated_at')
      ? {
          sourceUpdatedAt: optionalValue(
            frontmatter.attributes,
            'source_updated_at'
          )
        }
      : {}),
    importedAt: requiredValue(
      frontmatter.attributes,
      'imported_at',
      note.path
    ),
    contentHash: requiredSha256(
      frontmatter.attributes,
      'content_sha256',
      note.path
    )
  }
}

function identityKey(observation: GoogleSourceObservation): string {
  return JSON.stringify([
    observation.accountSub,
    observation.sourceKind,
    observation.containerId ?? '',
    observation.resourceId
  ])
}

function normalizeIncomingObservation(
  observation: GoogleSourceObservation,
  index: number
): GoogleSourceObservation {
  const requiredText = (value: string, field: string): string => {
    const normalized = value?.trim()
    if (!normalized) {
      throw new Error(`Google取込候補[${index}]の${field}が不正です。`)
    }
    return normalized
  }
  const contentHash = requiredText(observation.contentHash, 'contentHash')
  if (!/^[0-9a-f]{64}$/i.test(contentHash)) {
    throw new Error(`Google取込候補[${index}]のcontentHashが不正です。`)
  }

  return {
    accountSub: requiredText(observation.accountSub, 'accountSub'),
    sourceKind: requiredText(observation.sourceKind, 'sourceKind'),
    ...(observation.containerId?.trim()
      ? { containerId: observation.containerId.trim() }
      : {}),
    resourceId: requiredText(observation.resourceId, 'resourceId'),
    ...(observation.sourceUpdatedAt?.trim()
      ? { sourceUpdatedAt: observation.sourceUpdatedAt.trim() }
      : {}),
    importedAt: requiredText(observation.importedAt, 'importedAt'),
    contentHash: contentHash.toLowerCase()
  }
}

export function planGoogleSourceImport(
  existingNotes: readonly NoteDocument[],
  incoming: readonly GoogleSourceObservation[]
): GoogleSourceImportDecision[] {
  const existingByObservation = new Map<string, string>()
  const existingByResource = new Map<string, string[]>()

  for (const note of existingNotes) {
    const observation = parseStoredObservation(note)
    if (!observation) {
      continue
    }
    const resourceKey = identityKey(observation)
    existingByObservation.set(
      JSON.stringify([resourceKey, observation.contentHash]),
      note.path
    )
    existingByResource.set(resourceKey, [
      ...(existingByResource.get(resourceKey) ?? []),
      note.path
    ])
  }

  return incoming.map(normalizeIncomingObservation).map((observation) => {
    const resourceKey = identityKey(observation)
    const existingPath = existingByObservation.get(
      JSON.stringify([resourceKey, observation.contentHash])
    )
    if (existingPath) {
      return {
        action: 'skip',
        reason: 'same_observation',
        existingPath
      }
    }

    const existingPaths = existingByResource.get(resourceKey) ?? []
    return {
      action: 'create',
      reason:
        existingPaths.length > 0 ? 'changed_observation' : 'new_resource',
      existingPaths: [...existingPaths].sort()
    }
  })
}
