import { parseFrontmatter } from './frontmatter'
import { extractWikiLinks, resolveWikiLink } from './links'
import type { NoteDocument } from '../shared/types'

export type TemporalWarningCode =
  | 'MALFORMED_FRONTMATTER'
  | 'MISSING_FIELD'
  | 'INVALID_FIELD'
  | 'INVALID_INTERVAL'
  | 'UNRESOLVED_LINK'

export interface TemporalWarning {
  code: TemporalWarningCode
  message: string
  field?: string
}

export interface StateMetadata {
  kind: 'state'
  subject: string
  status: string
  validFrom: string
  validTo?: string
  observedAt?: string
  verifiedAt?: string
  reviewAfter?: string
  source?: string
  supersedes?: string
}

export interface EventMetadata {
  kind: 'event'
  subject: string
  event: string
  occurredAt: string
  observedAt?: string
  source?: string
  supersedes?: string
}

export type ParsedTemporalNote =
  | {
      path: string
      kind: 'normal'
      metadata: null
      warnings: TemporalWarning[]
    }
  | {
      path: string
      kind: 'state'
      metadata: StateMetadata | null
      warnings: TemporalWarning[]
    }
  | {
      path: string
      kind: 'event'
      metadata: EventMetadata | null
      warnings: TemporalWarning[]
    }

export type StatePhase = 'current' | 'historical' | 'future'
export type EventPhase = 'occurred' | 'future'
export type TemporalPerspective = 'valid-time' | 'knowledge-time'
export type TemporalKnowledgeStatus = 'known' | 'not-yet-known' | 'unknown'

export type TemporalEvaluation =
  | {
      kind: 'state'
      phase: StatePhase
      reviewDue: boolean
    }
  | {
      kind: 'event'
      phase: EventPhase
    }

export interface TemporalTimelineEntry {
  path: string
  kind: 'state' | 'event'
  metadata: StateMetadata | EventMetadata
  evaluation: TemporalEvaluation
  supersededBy: string[]
  warnings: TemporalWarning[]
}

function optionalField(
  attributes: Record<string, string | null>,
  key: string
): string | undefined {
  const value = attributes[key]?.trim()
  return value ? value : undefined
}

function requiredField(
  attributes: Record<string, string | null>,
  key: string,
  warnings: TemporalWarning[]
): string | undefined {
  const value = optionalField(attributes, key)
  if (!value) {
    warnings.push({
      code: 'MISSING_FIELD',
      field: key,
      message: `Required field "${key}" is missing.`
    })
  }
  return value
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTemporalDate(value: string): boolean {
  if (isValidCalendarDate(value)) {
    return true
  }

  const dateTime =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    )
  if (!dateTime || !isValidCalendarDate(dateTime[1])) {
    return false
  }

  const hour = Number(dateTime[2])
  const minute = Number(dateTime[3])
  const second = Number(dateTime[4] ?? '0')
  return (
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    Number.isFinite(Date.parse(value))
  )
}

function validateDateField(
  value: string,
  field: string,
  warnings: TemporalWarning[]
): boolean {
  if (isValidTemporalDate(value)) {
    return true
  }

  warnings.push({
    code: 'INVALID_FIELD',
    field,
    message: `Field "${field}" must be YYYY-MM-DD or timezone-aware ISO 8601.`
  })
  return false
}

function validateWikiLinkField(
  value: string,
  field: string,
  warnings: TemporalWarning[]
): boolean {
  if (getWholeWikiLinkTarget(value)) {
    return true
  }

  warnings.push({
    code: 'INVALID_FIELD',
    field,
    message: `Field "${field}" must contain one complete Wiki link.`
  })
  return false
}

function getWholeWikiLinkTarget(value: string): string | null {
  const links = extractWikiLinks(value)
  return links.length === 1 && links[0].raw === value
    ? links[0].target
    : null
}

function normalizeSubject(value: string): string | null {
  const target = getWholeWikiLinkTarget(value)
  return target
    ? target
        .trim()
        .replaceAll('\\', '/')
        .replace(/\.md$/i, '')
        .toLocaleLowerCase()
    : null
}

function optionalDateField(
  attributes: Record<string, string | null>,
  field: string,
  warnings: TemporalWarning[]
): string | undefined {
  const value = optionalField(attributes, field)
  if (!value) {
    return undefined
  }
  return validateDateField(value, field, warnings) ? value : undefined
}

function optionalWikiLinkField(
  attributes: Record<string, string | null>,
  field: string,
  warnings: TemporalWarning[]
): string | undefined {
  const value = optionalField(attributes, field)
  if (!value) {
    return undefined
  }
  return validateWikiLinkField(value, field, warnings) ? value : undefined
}

function compareTemporalDates(left: string, right: string): number {
  const leftIsDate = /^\d{4}-\d{2}-\d{2}$/.test(left)
  const rightIsDate = /^\d{4}-\d{2}-\d{2}$/.test(right)

  if (leftIsDate && rightIsDate) {
    return left.localeCompare(right)
  }
  if (!leftIsDate && !rightIsDate) {
    return Date.parse(left) - Date.parse(right)
  }

  const calendarComparison = left.slice(0, 10).localeCompare(right.slice(0, 10))
  if (calendarComparison !== 0) {
    return calendarComparison
  }
  return leftIsDate ? -1 : 1
}

function compareAsOf(asOf: string, value: string): number {
  const asOfIsDate = /^\d{4}-\d{2}-\d{2}$/.test(asOf)
  const valueIsDate = /^\d{4}-\d{2}-\d{2}$/.test(value)

  if (asOfIsDate === valueIsDate) {
    return compareTemporalDates(asOf, value)
  }

  const calendarComparison = asOf
    .slice(0, 10)
    .localeCompare(value.slice(0, 10))
  if (calendarComparison !== 0) {
    return calendarComparison
  }

  return asOfIsDate ? 1 : 0
}

export function evaluateTemporal(
  metadata: StateMetadata | EventMetadata,
  asOf: string
): TemporalEvaluation {
  if (!isValidTemporalDate(asOf)) {
    throw new TypeError(
      'asOf must be YYYY-MM-DD or timezone-aware ISO 8601.'
    )
  }

  if (metadata.kind === 'event') {
    return {
      kind: 'event',
      phase:
        compareAsOf(asOf, metadata.occurredAt) >= 0
          ? 'occurred'
          : 'future'
    }
  }

  let phase: StatePhase
  if (compareAsOf(asOf, metadata.validFrom) < 0) {
    phase = 'future'
  } else if (
    metadata.validTo &&
    compareAsOf(asOf, metadata.validTo) >= 0
  ) {
    phase = 'historical'
  } else {
    phase = 'current'
  }

  return {
    kind: 'state',
    phase,
    reviewDue:
      phase === 'current' &&
      Boolean(
        metadata.reviewAfter &&
          compareAsOf(asOf, metadata.reviewAfter) > 0
      )
  }
}

export function evaluateKnowledgeTime(
  metadata: StateMetadata | EventMetadata,
  asOf: string
): TemporalKnowledgeStatus {
  if (!isValidTemporalDate(asOf)) {
    throw new TypeError(
      'asOf must be YYYY-MM-DD or timezone-aware ISO 8601.'
    )
  }
  if (!metadata.observedAt) {
    return 'unknown'
  }
  return compareAsOf(asOf, metadata.observedAt) >= 0
    ? 'known'
    : 'not-yet-known'
}

export function buildTemporalTimeline(
  subject: string,
  notes: NoteDocument[],
  asOf: string,
  parsedNotes: ParsedTemporalNote[] = notes.map(parseTemporalNote)
): TemporalTimelineEntry[] {
  const entries: TemporalTimelineEntry[] = []
  const normalizedSubject = normalizeSubject(subject)

  for (const parsed of parsedNotes) {
    if (
      parsed.kind === 'normal' ||
      !parsed.metadata ||
      normalizeSubject(parsed.metadata.subject) !== normalizedSubject
    ) {
      continue
    }

    entries.push({
      path: parsed.path,
      kind: parsed.kind,
      metadata: parsed.metadata,
      evaluation: evaluateTemporal(parsed.metadata, asOf),
      supersededBy: [],
      warnings: [...parsed.warnings]
    })
  }

  const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]))
  for (const replacement of entries) {
    const supersedes = replacement.metadata.supersedes
    const isEffective =
      replacement.evaluation.kind === 'state'
        ? replacement.evaluation.phase !== 'future'
        : replacement.evaluation.phase === 'occurred'

    if (!supersedes || !isEffective) {
      continue
    }

    const occurrence = extractWikiLinks(supersedes).find(
      (link) => link.raw === supersedes
    )
    const resolved = occurrence
      ? resolveWikiLink(occurrence.target, notes)
      : null
    const replaced =
      resolved?.status === 'resolved' && resolved.resolvedPath
        ? entriesByPath.get(resolved.resolvedPath)
        : undefined

    if (!replaced) {
      replacement.warnings.push({
        code: 'UNRESOLVED_LINK',
        field: 'supersedes',
        message: `Field "supersedes" could not resolve "${supersedes}".`
      })
      continue
    }

    replaced.supersededBy.push(replacement.path)
  }

  return entries
}

export function parseTemporalNote(note: NoteDocument): ParsedTemporalNote {
  const frontmatter = parseFrontmatter(note.content)
  const warnings: TemporalWarning[] = frontmatter.warnings.map((warning) => ({
    code: warning.code,
    message: warning.message
  }))

  if (frontmatter.attributes.kind === 'event') {
    const subject = requiredField(frontmatter.attributes, 'subject', warnings)
    const event = requiredField(frontmatter.attributes, 'event', warnings)
    const occurredAt = requiredField(
      frontmatter.attributes,
      'occurred_at',
      warnings
    )
    const subjectIsValid = subject
      ? validateWikiLinkField(subject, 'subject', warnings)
      : false
    const observedAt = optionalDateField(
      frontmatter.attributes,
      'observed_at',
      warnings
    )
    const source = optionalWikiLinkField(
      frontmatter.attributes,
      'source',
      warnings
    )
    const supersedes = optionalWikiLinkField(
      frontmatter.attributes,
      'supersedes',
      warnings
    )

    if (
      !subject ||
      !subjectIsValid ||
      !event ||
      !occurredAt ||
      !validateDateField(occurredAt, 'occurred_at', warnings)
    ) {
      return {
        path: note.path,
        kind: 'event',
        metadata: null,
        warnings
      }
    }

    return {
      path: note.path,
      kind: 'event',
      metadata: {
        kind: 'event',
        subject,
        event,
        occurredAt,
        ...(observedAt ? { observedAt } : {}),
        ...(source ? { source } : {}),
        ...(supersedes ? { supersedes } : {})
      },
      warnings
    }
  }

  if (frontmatter.attributes.kind !== 'state') {
    return {
      path: note.path,
      kind: 'normal',
      metadata: null,
      warnings
    }
  }

  const subject = requiredField(frontmatter.attributes, 'subject', warnings)
  const status = requiredField(frontmatter.attributes, 'status', warnings)
  const validFrom = requiredField(frontmatter.attributes, 'valid_from', warnings)
  const validTo = optionalField(frontmatter.attributes, 'valid_to')
  const subjectIsValid = subject
    ? validateWikiLinkField(subject, 'subject', warnings)
    : false
  const observedAt = optionalDateField(
    frontmatter.attributes,
    'observed_at',
    warnings
  )
  const verifiedAt = optionalDateField(
    frontmatter.attributes,
    'verified_at',
    warnings
  )
  const reviewAfter = optionalDateField(
    frontmatter.attributes,
    'review_after',
    warnings
  )
  const source = optionalWikiLinkField(
    frontmatter.attributes,
    'source',
    warnings
  )
  const supersedes = optionalWikiLinkField(
    frontmatter.attributes,
    'supersedes',
    warnings
  )

  if (
    !subject ||
    !subjectIsValid ||
    !status ||
    !validFrom ||
    !validateDateField(validFrom, 'valid_from', warnings)
  ) {
    return {
      path: note.path,
      kind: 'state',
      metadata: null,
      warnings
    }
  }

  if (validTo && !validateDateField(validTo, 'valid_to', warnings)) {
    return {
      path: note.path,
      kind: 'state',
      metadata: null,
      warnings
    }
  }

  if (validTo && compareTemporalDates(validTo, validFrom) <= 0) {
    warnings.push({
      code: 'INVALID_INTERVAL',
      field: 'valid_to',
      message: 'Field "valid_to" must be later than "valid_from".'
    })
    return {
      path: note.path,
      kind: 'state',
      metadata: null,
      warnings
    }
  }

  return {
    path: note.path,
    kind: 'state',
    metadata: {
      kind: 'state',
      subject,
      status,
      validFrom,
      ...(validTo ? { validTo } : {}),
      ...(observedAt ? { observedAt } : {}),
      ...(verifiedAt ? { verifiedAt } : {}),
      ...(reviewAfter ? { reviewAfter } : {}),
      ...(source ? { source } : {}),
      ...(supersedes ? { supersedes } : {})
    },
    warnings
  }
}
