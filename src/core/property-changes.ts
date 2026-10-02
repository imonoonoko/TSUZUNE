import {
  convertFrontmatterProperty,
  inspectFrontmatterProperty,
  renameFrontmatterProperty,
  setFrontmatterProperty,
  type FrontmatterProperty
} from './frontmatter'
import type {
  PropertyChangeIssue,
  PropertyChangeOperation,
  PropertyDeclaredType,
  PropertyValue
} from '../shared/property-changes'

export type PropertyTransformResult =
  | { ok: true; markdown: string; before: PropertyValue | null; after: PropertyValue | null }
  | { ok: false; issue: PropertyChangeIssue }

const DECIMAL = /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/
const NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/

function issue(code: string, message: string): PropertyTransformResult {
  return { ok: false, issue: { code, message } }
}

function calendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

export function isValidPropertyDate(value: string): boolean {
  return calendarDate(value)
}

export function isValidPropertyDateTime(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
  if (!match || !calendarDate(match[1])) return false
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || (match[4] && Number(match[4]) > 59)) return false
  const offset = match[6]
  return !offset || offset === 'Z' || (Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4, 6)) <= 59)
}

/** The YAML representation stays text; the registry supplies the date label. */
export function readPropertyAsDeclared(
  value: PropertyValue | null,
  declaredType: PropertyDeclaredType
): PropertyValue | null {
  if (!value) return null
  if (value.type !== 'text') return value
  if (declaredType === 'date' && isValidPropertyDate(value.value)) return { type: 'date', value: value.value }
  if (declaredType === 'datetime' && isValidPropertyDateTime(value.value)) return { type: 'datetime', value: value.value }
  return value
}

function validValue(value: PropertyValue): boolean {
  if (!value || typeof value !== 'object') return false
  if (value.type === 'checkbox') return typeof value.value === 'boolean'
  if (value.type === 'list') {
    return Array.isArray(value.value) && value.value.every((item) =>
      item && (item.type === 'text' || item.type === 'number') && typeof item.value === 'string' &&
      (item.type !== 'number' || (DECIMAL.test(item.value) && Number.isFinite(Number(item.value))))
    )
  }
  if (typeof value.value !== 'string') return false
  if (value.type === 'text') return true
  if (value.type === 'number') return DECIMAL.test(value.value) && Number.isFinite(Number(value.value))
  if (value.type === 'date') return isValidPropertyDate(value.value)
  if (value.type === 'datetime') return isValidPropertyDateTime(value.value)
  return false
}

function storageValue(value: PropertyValue): FrontmatterProperty {
  return value.type === 'date' || value.type === 'datetime'
    ? { type: 'text', value: value.value }
    : value
}

function convertValue(current: PropertyValue, target: PropertyDeclaredType): PropertyValue | null {
  if (target === current.type) return current
  if (target === 'list') {
    return current.type === 'text' || current.type === 'number'
      ? { type: 'list', value: [current] }
      : null
  }
  let atom: PropertyValue = current
  if (current.type === 'list') {
    if (current.value.length !== 1) return null
    atom = current.value[0]
  }
  if (target === 'text') {
    if (atom.type === 'checkbox') return { type: 'text', value: String(atom.value) }
    return atom.type === 'text' || atom.type === 'number' ? { type: 'text', value: atom.value } : null
  }
  if (target === 'number') {
    return atom.type === 'text' && DECIMAL.test(atom.value) && Number.isFinite(Number(atom.value))
      ? { type: 'number', value: atom.value }
      : null
  }
  if (target === 'checkbox') {
    return atom.type === 'text' && (atom.value === 'true' || atom.value === 'false')
      ? { type: 'checkbox', value: atom.value === 'true' }
      : null
  }
  if (target === 'date') {
    return atom.type === 'text' && isValidPropertyDate(atom.value)
      ? { type: 'date', value: atom.value }
      : null
  }
  return atom.type === 'text' && isValidPropertyDateTime(atom.value)
    ? { type: 'datetime', value: atom.value }
    : null
}

export function transformProperty(markdown: string, operation: PropertyChangeOperation): PropertyTransformResult {
  if (!operation || typeof operation !== 'object' || !NAME.test(operation.property)) {
    return issue('INVALID_PROPERTY_NAME', 'Property name is invalid.')
  }
  const inspected = inspectFrontmatterProperty(markdown, operation.property)
  if (!inspected.ok) return { ok: false, issue: { code: inspected.code, message: inspected.message } }
  const before: PropertyValue | null = inspected.property
  let result
  let after: PropertyValue | null
  if (operation.kind === 'set') {
    if (!validValue(operation.value)) return issue('INVALID_PROPERTY_VALUE', 'Property value is invalid for its declared type.')
    after = operation.value
    result = setFrontmatterProperty(markdown, operation.property, storageValue(after))
  } else if (operation.kind === 'convert') {
    if (before === null) return issue('PROPERTY_NOT_FOUND', `Property "${operation.property}" was not found.`)
    if (!['text', 'number', 'checkbox', 'list', 'date', 'datetime'].includes(operation.targetType)) {
      return issue('INVALID_PROPERTY_TYPE', 'Target property type is invalid.')
    }
    const converted = convertValue(before, operation.targetType)
    if (!converted) return issue('CONVERSION_UNSAFE', `Property "${operation.property}" cannot be converted without changing or guessing its value.`)
    after = converted
    result = convertFrontmatterProperty(markdown, operation.property, storageValue(converted))
  } else if (operation.kind === 'rename') {
    if (!NAME.test(operation.newName)) return issue('INVALID_PROPERTY_NAME', 'Property name is invalid.')
    if (before === null) return issue('PROPERTY_NOT_FOUND', `Property "${operation.property}" was not found.`)
    after = before
    result = renameFrontmatterProperty(markdown, operation.property, operation.newName)
  } else {
    return issue('INVALID_OPERATION', 'Property operation is invalid.')
  }
  return result.ok
    ? { ok: true, markdown: result.markdown, before, after }
    : { ok: false, issue: { code: result.code, message: result.message } }
}
