export interface FrontmatterWarning {
  code: 'MALFORMED_FRONTMATTER'
  message: string
  line?: number
}

export interface FrontmatterParseResult {
  found: boolean
  attributes: Record<string, string | null>
  body: string
  raw: string | null
  warnings: FrontmatterWarning[]
}

export type FrontmatterEditErrorCode =
  | 'INVALID_PROPERTY_NAME'
  | 'MALFORMED_FRONTMATTER'
  | 'PROPERTY_NOT_FOUND'
  | 'DUPLICATE_PROPERTY'
  | 'NON_SCALAR_PROPERTY'

export type FrontmatterEditResult =
  | { ok: true; markdown: string }
  | { ok: false; code: FrontmatterEditErrorCode; message: string }

export type FrontmatterScalarInspection =
  | { ok: true; value: string | null }
  | { ok: false; code: FrontmatterEditErrorCode; message: string }

export type FrontmatterAtom = { type: 'text' | 'number'; value: string }

export type FrontmatterProperty =
  | FrontmatterAtom
  | { type: 'checkbox'; value: boolean }
  | { type: 'list'; value: FrontmatterAtom[] }

export type FrontmatterPropertyInspection =
  | { ok: true; property: FrontmatterProperty | null }
  | { ok: false; code: FrontmatterEditErrorCode; message: string }

const FRONTMATTER_PATTERN =
  /^(?:\uFEFF)?---(?:\r?\n([\s\S]*?)\r?\n---|\r?\n---)(?:\r?\n|$)/
const NESTED_YAML_LINE =
  /^\s+(?:-\s+.+|[A-Za-z_][A-Za-z0-9_-]*:(?:\s*.*)?)$/
const PROPERTY_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/
const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/

function parseScalar(value: string): string | null {
  if (value === '' || value === 'null' || value === '~') {
    return null
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }

  return value
}

export function parseFrontmatter(markdown: string): FrontmatterParseResult {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match) {
    if (/^(?:\uFEFF)?---(?:\r?\n|$)/.test(markdown)) {
      return {
        found: true,
        attributes: {},
        body: markdown,
        raw: null,
        warnings: [
          {
            code: 'MALFORMED_FRONTMATTER',
            message: 'Frontmatter closing delimiter is missing.'
          }
        ]
      }
    }

    return {
      found: false,
      attributes: {},
      body: markdown,
      raw: null,
      warnings: []
    }
  }

  const attributes: Record<string, string | null> = {}
  const warnings: FrontmatterWarning[] = []
  const lines = (match[1] ?? '').split(/\r?\n/)
  let nestedBlockOpen = false

  for (const [index, line] of lines.entries()) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue
    }

    if (/^\s/.test(line)) {
      if (nestedBlockOpen && NESTED_YAML_LINE.test(line)) {
        continue
      }
      warnings.push({
        code: 'MALFORMED_FRONTMATTER',
        message: 'Top-level key and scalar value are required.',
        line: index + 2
      })
      continue
    }

    if (nestedBlockOpen && /^-\s+.+$/.test(line)) {
      continue
    }

    const field = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line)
    if (!field) {
      nestedBlockOpen = false
      warnings.push({
        code: 'MALFORMED_FRONTMATTER',
        message: 'Top-level key and scalar value are required.',
        line: index + 2
      })
      continue
    }

    const rawValue = field[2] ?? ''
    const blockHeader =
      rawValue.trim() === '' || rawValue.trimStart().startsWith('#')
    Object.defineProperty(attributes, field[1], {
      configurable: true,
      enumerable: true,
      value: blockHeader ? null : parseScalar(rawValue),
      writable: true
    })
    nestedBlockOpen = blockHeader
  }

  return {
    found: true,
    attributes,
    body: markdown.slice(match[0].length),
    raw: match[0].replace(/\r?\n$/, ''),
    warnings
  }
}

type FrontmatterEditFailure = Extract<FrontmatterEditResult, { ok: false }>
type FrontmatterInspectionFailure = Extract<
  FrontmatterScalarInspection,
  { ok: false }
>

interface FrontmatterLine {
  text: string
  start: number
  ending: string
  field: RegExpExecArray | null
  topLevelField: RegExpExecArray | null
}

interface EditableScalar {
  value: string
  comment: string
}

function isEditFailure(value: unknown): value is FrontmatterEditFailure {
  return typeof value === 'object' && value !== null && 'ok' in value
}

type FrontmatterLocationResult =
  | {
      ok: true
      match: RegExpExecArray
      eol: string
      contentStart: number
      closingStart: number
      lines: FrontmatterLine[]
      target?: FrontmatterLine
    }
  | FrontmatterEditFailure

function editFailure(
  code: FrontmatterEditErrorCode,
  message: string
): FrontmatterEditFailure {
  return { ok: false, code, message }
}

function inspectionFailure(
  code: FrontmatterEditErrorCode,
  message: string
): FrontmatterInspectionFailure {
  return { ok: false, code, message }
}

function validatePropertyName(name: string): FrontmatterEditFailure | null {
  return PROPERTY_NAME_PATTERN.test(name)
    ? null
    : editFailure(
        'INVALID_PROPERTY_NAME',
        'Property names must start with a letter or underscore.'
      )
}

function scalarFailure(
  name: string,
  message = `Property "${name}" is not a supported text scalar.`
): FrontmatterEditFailure {
  return editFailure('NON_SCALAR_PROPERTY', message)
}

function isUnsupportedTypedScalar(source: string): boolean {
  return (
    /^(?:null|~|true|false|yes|no|on|off)$/i.test(source) ||
    /^[+-]?0x[\da-f_]+$/i.test(source) ||
    /^[+-]?0o[0-7_]+$/i.test(source) ||
    /^[+-]?0b[01_]+$/i.test(source) ||
    /^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:e[+-]?\d+)?$/i.test(
      source
    ) ||
    /^[+-]?\.(?:inf|nan)$/i.test(source) ||
    /^\d{4}-\d{2}-\d{2}(?:[Tt \t].*)?$/.test(source)
  )
}

function isMalformedPlainScalar(source: string): boolean {
  return (
    source === ':' ||
    /^[?-](?:\s|$)/.test(source) ||
    /^[\]}\,@%`]/.test(source) ||
    /:\s/.test(source)
  )
}

function isSimpleFlowList(source: string): boolean {
  return /^\[\s*(?:[A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)?\s*\]$/.test(
    source
  )
}

function parseEditableScalar(
  name: string,
  rawValue: string
): EditableScalar | FrontmatterEditFailure {
  const start = rawValue.search(/\S/)
  if (start === -1 || rawValue[start] === '#') {
    return scalarFailure(name)
  }

  const first = rawValue[start]
  if (/[\[{!&*|>]/.test(first)) {
    return scalarFailure(name)
  }

  if (first === '"' || first === "'") {
    let index = start + 1
    let closed = false
    for (; index < rawValue.length; index += 1) {
      if (first === '"' && rawValue[index] === '\\') {
        index += 1
        continue
      }
      if (first === "'" && rawValue[index] === "'" && rawValue[index + 1] === "'") {
        index += 1
        continue
      }
      if (rawValue[index] === first) {
        closed = true
        break
      }
    }
    if (!closed) {
      return editFailure(
        'MALFORMED_FRONTMATTER',
        'Malformed frontmatter cannot be edited safely.'
      )
    }

    const afterQuote = rawValue.slice(index + 1)
    const commentIndex = afterQuote.search(/\S/)
    if (commentIndex !== -1 && afterQuote[commentIndex] !== '#') {
      return editFailure(
        'MALFORMED_FRONTMATTER',
        'Malformed frontmatter cannot be edited safely.'
      )
    }

    const source = rawValue.slice(start, index + 1)
    let value: string
    if (first === '"') {
      try {
        value = JSON.parse(source) as string
      } catch {
        return editFailure(
          'MALFORMED_FRONTMATTER',
          'Malformed frontmatter cannot be edited safely.'
        )
      }
    } else {
      value = source.slice(1, -1).replace(/''/g, "'")
    }
    return { value, comment: afterQuote }
  }

  let commentStart = -1
  for (let index = start; index < rawValue.length; index += 1) {
    if (
      rawValue[index] === '#' &&
      index > start &&
      /\s/.test(rawValue[index - 1])
    ) {
      commentStart = index
      while (commentStart > start && /\s/.test(rawValue[commentStart - 1])) {
        commentStart -= 1
      }
      break
    }
  }

  const source = rawValue
    .slice(start, commentStart === -1 ? rawValue.length : commentStart)
    .trimEnd()
  if (source === '') {
    return scalarFailure(name)
  }
  if (isMalformedPlainScalar(source)) {
    return editFailure(
      'MALFORMED_FRONTMATTER',
      'Malformed frontmatter cannot be edited safely.'
    )
  }
  if (isUnsupportedTypedScalar(source)) return scalarFailure(name)

  return {
    value: source,
    comment: commentStart === -1 ? '' : rawValue.slice(commentStart)
  }
}

function unsupportedDocumentFailure(
  lines: FrontmatterLine[]
): FrontmatterEditFailure | null {
  for (const line of lines) {
    if (!line.topLevelField) continue
    const rawValue = line.topLevelField[2]
    const first = rawValue.search(/\S/)
    if (first === -1 || rawValue[first] === '#') continue
    if (rawValue[first] === '"' || rawValue[first] === "'") {
      const checked = parseEditableScalar(line.topLevelField[1], rawValue)
      if (isEditFailure(checked) && checked.code === 'MALFORMED_FRONTMATTER') {
        return checked
      }
    } else {
      const source = rawValue.trim()
      if (source.startsWith('[')) {
        if (isSimpleFlowList(source)) continue
        return source.endsWith(']')
          ? scalarFailure(line.topLevelField[1])
          : editFailure(
              'MALFORMED_FRONTMATTER',
              'Malformed frontmatter cannot be edited safely.'
            )
      }
      if (source.startsWith('{')) {
        return source.endsWith('}')
          ? scalarFailure(line.topLevelField[1])
          : editFailure(
              'MALFORMED_FRONTMATTER',
              'Malformed frontmatter cannot be edited safely.'
            )
      }
      if (/^[!&*|>]/.test(source)) return scalarFailure(line.topLevelField[1])
      if (isMalformedPlainScalar(source)) {
        return editFailure(
          'MALFORMED_FRONTMATTER',
          'Malformed frontmatter cannot be edited safely.'
        )
      }
    }
  }
  return null
}

function quoteScalar(value: string): string {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function locateFrontmatterProperty(
  markdown: string,
  name: string,
  parsed: FrontmatterParseResult
): FrontmatterLocationResult {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match || parsed.warnings.length > 0) {
    return editFailure(
      'MALFORMED_FRONTMATTER',
      'Malformed frontmatter cannot be edited safely.'
    )
  }

  const source = match[1] ?? ''
  const opening = /^(?:\uFEFF)?---(\r?\n)/.exec(markdown)
  if (!opening) {
    return editFailure(
      'MALFORMED_FRONTMATTER',
      'Malformed frontmatter cannot be edited safely.'
    )
  }

  const propertyPattern = new RegExp(`^${name}:(.*)$`)
  const lines: FrontmatterLine[] = []
  let offset = 0
  for (const text of source.split(/\r?\n/)) {
    const ending = source.startsWith('\r\n', offset + text.length)
      ? '\r\n'
      : source.startsWith('\n', offset + text.length)
        ? '\n'
        : ''
    lines.push({
      text,
      start: offset,
      ending,
      field: propertyPattern.exec(text),
      topLevelField: /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/.exec(text)
    })
    offset += text.length + ending.length
  }

  const matches = lines.filter((line) => line.field !== null)
  if (matches.length > 1) {
    return editFailure(
      'DUPLICATE_PROPERTY',
      `Property "${name}" appears more than once.`
    )
  }

  const documentFailure = unsupportedDocumentFailure(lines)
  if (documentFailure) return documentFailure

  const target = matches[0]
  if (target) {
    const targetIndex = lines.indexOf(target)
    let hasIndentedContinuation = false
    for (const line of lines.slice(targetIndex + 1)) {
      if (line.text.trim() === '' || line.text.trimStart().startsWith('#')) {
        continue
      }
      hasIndentedContinuation = /^\s/.test(line.text)
      break
    }
    if (hasIndentedContinuation) return scalarFailure(name)
    const checked = parseEditableScalar(name, target.field?.[1] ?? '')
    if (isEditFailure(checked)) return checked
  }

  return {
    ok: true,
    match,
    eol:
      markdown[match[0].lastIndexOf('---') - 2] === '\r'
        ? '\r\n'
        : opening[1],
    contentStart: opening[0].length,
    closingStart: match[0].lastIndexOf('---'),
    lines,
    target
  }
}

export function setFrontmatterScalar(
  markdown: string,
  name: string,
  value: string
): FrontmatterEditResult {
  const invalidName = validatePropertyName(name)
  if (invalidName) return invalidName

  const parsed = parseFrontmatter(markdown)
  if (!parsed.found) {
    const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
    const bom = markdown.startsWith('\uFEFF') ? '\uFEFF' : ''
    const body = markdown.slice(bom.length)
    return {
      ok: true,
      markdown: `${bom}---${eol}${name}: ${quoteScalar(value)}${eol}---${body ? eol : ''}${body}`
    }
  }

  const location = locateFrontmatterProperty(markdown, name, parsed)
  if (!location.ok) return location

  if (!location.target) {
    return {
      ok: true,
      markdown: `${markdown.slice(0, location.closingStart)}${name}: ${quoteScalar(value)}${location.eol}${markdown.slice(location.closingStart)}`
    }
  }

  const scalar = parseEditableScalar(name, location.target.field?.[1] ?? '')
  if (isEditFailure(scalar)) return scalar
  if (scalar.value === value) return { ok: true, markdown }

  const lineStart = location.contentStart + location.target.start
  const lineEnd = lineStart + location.target.text.length
  return {
    ok: true,
    markdown: `${markdown.slice(0, lineStart)}${name}: ${quoteScalar(value)}${scalar.comment}${markdown.slice(lineEnd)}`
  }
}

export function inspectFrontmatterScalar(
  markdown: string,
  name: string
): FrontmatterScalarInspection {
  const invalidName = validatePropertyName(name)
  if (invalidName) return inspectionFailure(invalidName.code, invalidName.message)

  const parsed = parseFrontmatter(markdown)
  if (!parsed.found) return { ok: true, value: null }

  const location = locateFrontmatterProperty(markdown, name, parsed)
  if (!location.ok) return inspectionFailure(location.code, location.message)
  if (!location.target) return { ok: true, value: null }

  const scalar = parseEditableScalar(name, location.target.field?.[1] ?? '')
  if (isEditFailure(scalar)) return inspectionFailure(scalar.code, scalar.message)
  return { ok: true, value: scalar.value }
}

export function deleteFrontmatterScalar(
  markdown: string,
  name: string
): FrontmatterEditResult {
  const invalidName = validatePropertyName(name)
  if (invalidName) return invalidName

  const parsed = parseFrontmatter(markdown)
  if (!parsed.found) {
    return editFailure('PROPERTY_NOT_FOUND', `Property "${name}" was not found.`)
  }

  const location = locateFrontmatterProperty(markdown, name, parsed)
  if (!location.ok) return location
  if (!location.target) {
    return editFailure('PROPERTY_NOT_FOUND', `Property "${name}" was not found.`)
  }

  const scalar = parseEditableScalar(name, location.target.field?.[1] ?? '')
  if (isEditFailure(scalar)) return scalar

  const lineStart = location.contentStart + location.target.start
  if (scalar.comment !== '') {
    const lineEnd = lineStart + location.target.text.length
    return {
      ok: true,
      markdown: `${markdown.slice(0, lineStart)}${scalar.comment.trimStart()}${markdown.slice(lineEnd)}`
    }
  }

  let lineEnd = lineStart + location.target.text.length
  if (location.lines.length > 1) {
    lineEnd +=
      location.target.ending.length > 0
        ? location.target.ending.length
        : location.closingStart - lineEnd
  }

  return {
    ok: true,
    markdown: `${markdown.slice(0, lineStart)}${markdown.slice(lineEnd)}`
  }
}

interface TypedPropertyLocation {
  eol: string
  contentStart: number
  closingStart: number
  lines: FrontmatterLine[]
  target?: FrontmatterLine
}

interface TypedPropertySource {
  property: FrontmatterProperty
  headerComment: string
  itemComments: string[]
  standaloneComments: string[]
  endIndex: number
}

function typedInspectionFailure(
  code: FrontmatterEditErrorCode,
  message: string
): Extract<FrontmatterPropertyInspection, { ok: false }> {
  return { ok: false, code, message }
}

function locateTypedProperty(
  markdown: string,
  name: string
): TypedPropertyLocation | FrontmatterEditFailure {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  const opening = /^(?:\uFEFF)?---(\r?\n)/.exec(markdown)
  if (!match || !opening) {
    return editFailure(
      'MALFORMED_FRONTMATTER',
      'Malformed frontmatter cannot be edited safely.'
    )
  }

  const source = match[1] ?? ''
  const propertyPattern = new RegExp(`^${name}:(?=$|[ \\t])(.*)$`)
  const lines: FrontmatterLine[] = []
  let offset = 0
  for (const text of source.split(/\r?\n/)) {
    const ending = source.startsWith('\r\n', offset + text.length)
      ? '\r\n'
      : source.startsWith('\n', offset + text.length)
        ? '\n'
        : ''
    lines.push({
      text,
      start: offset,
      ending,
      field: propertyPattern.exec(text),
      topLevelField: /^([A-Za-z_][A-Za-z0-9_-]*):(?=$|[ \t])(.*)$/.exec(text)
    })
    offset += text.length + ending.length
  }

  const matches = lines.filter((line) => line.field !== null)
  if (matches.length > 1) {
    return editFailure(
      'DUPLICATE_PROPERTY',
      `Property "${name}" appears more than once.`
    )
  }

  return {
    eol:
      markdown[match[0].lastIndexOf('---') - 2] === '\r' ? '\r\n' : opening[1],
    contentStart: opening[0].length,
    closingStart: match[0].lastIndexOf('---'),
    lines,
    target: matches[0]
  }
}

function splitComment(source: string): { value: string; comment: string } {
  let quote = ''
  let flowDepth = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote !== '') {
      if (quote === '"' && character === '\\') {
        index += 1
      } else if (character === quote) {
        if (quote === "'" && source[index + 1] === "'") index += 1
        else quote = ''
      }
    } else if (character === '[') {
      flowDepth += 1
    } else if (character === ']') {
      flowDepth -= 1
    } else if (
      (character === '"' || character === "'") &&
      (source.slice(0, index).trim() === '' ||
        (flowDepth > 0 && /(?:^|[\[,])\s*$/.test(source.slice(0, index))))
    ) {
      quote = character
    } else if (
      character === '#' &&
      flowDepth === 0 &&
      (index === 0 || /\s/.test(source[index - 1]))
    ) {
      let commentStart = index
      while (commentStart > 0 && /\s/.test(source[commentStart - 1])) {
        commentStart -= 1
      }
      return {
        value: source.slice(0, commentStart).trim(),
        comment: source.slice(commentStart)
      }
    }
  }
  return { value: source.trim(), comment: '' }
}

function parseTypedAtom(
  source: string
): { atom: FrontmatterAtom; comment: string } | FrontmatterEditFailure {
  const separated = splitComment(source)
  if (separated.value === '') {
    return scalarFailure('property', 'Property values must be text or decimal numbers.')
  }
  if (DECIMAL_NUMBER_PATTERN.test(separated.value)) {
    return { atom: { type: 'number', value: separated.value }, comment: separated.comment }
  }
  const text = parseEditableScalar('property', separated.value)
  if (isEditFailure(text)) return text
  return { atom: { type: 'text', value: text.value }, comment: separated.comment }
}

function parseFlowList(
  source: string
): { atoms: FrontmatterAtom[]; comment: string } | FrontmatterEditFailure {
  const separated = splitComment(source)
  if (!separated.value.startsWith('[')) {
    return scalarFailure('property')
  }
  if (!separated.value.endsWith(']')) {
    return editFailure('MALFORMED_FRONTMATTER', 'Malformed frontmatter cannot be edited safely.')
  }
  const inner = separated.value.slice(1, -1).trim()
  if (inner === '') return { atoms: [], comment: separated.comment }

  const values: string[] = []
  let quote = ''
  let start = 0
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index]
    if (quote !== '') {
      if (quote === '"' && character === '\\') {
        index += 1
      } else if (character === quote) {
        if (quote === "'" && inner[index + 1] === "'") index += 1
        else quote = ''
      }
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === ',') {
      values.push(inner.slice(start, index))
      start = index + 1
    } else if (character === '[' || character === ']' || character === '{' || character === '}') {
      return scalarFailure('property')
    }
  }
  if (quote !== '') {
    return editFailure('MALFORMED_FRONTMATTER', 'Malformed frontmatter cannot be edited safely.')
  }
  values.push(inner.slice(start))
  const atoms: FrontmatterAtom[] = []
  for (const value of values) {
    const atom = parseTypedAtom(value)
    if (isEditFailure(atom)) return atom
    if (atom.comment !== '') return scalarFailure('property')
    atoms.push(atom.atom)
  }
  return { atoms, comment: separated.comment }
}

function propertyEndIndex(location: TypedPropertyLocation, targetIndex: number): number {
  for (let index = targetIndex + 1; index < location.lines.length; index += 1) {
    if (location.lines[index].topLevelField) return index
  }
  return location.lines.length
}

function parseBlockList(
  lines: FrontmatterLine[],
  start: number,
  end: number,
  headerComment: string,
  allowEmpty = false
): TypedPropertySource | FrontmatterEditFailure {
  const atoms: FrontmatterAtom[] = []
  const itemComments: string[] = []
  const standaloneComments: string[] = []
  const pendingComments: string[] = []
  let indentation: string | null = null
  let lastItemEnd = start
  for (let index = start; index < end; index += 1) {
    const line = lines[index]
    if (line.text.trim() === '') continue
    if (line.text.trimStart().startsWith('#')) {
      pendingComments.push(line.text)
      continue
    }
    const item = /^( *)(- )(.*)$/.exec(line.text)
    if (!item) return scalarFailure('property')
    if (indentation === null) indentation = item[1]
    if (item[1] !== indentation || /^-\s/.test(item[3])) {
      return scalarFailure('property')
    }
    const parsed = parseTypedAtom(item[3])
    if (isEditFailure(parsed)) return parsed
    standaloneComments.push(...pendingComments)
    pendingComments.length = 0
    atoms.push(parsed.atom)
    itemComments.push(parsed.comment)
    lastItemEnd = index + 1
  }
  if (atoms.length === 0 && !allowEmpty) {
    return scalarFailure('property')
  }
  return {
    property: { type: 'list', value: atoms },
    headerComment,
    itemComments,
    standaloneComments,
    endIndex: lastItemEnd
  }
}

function parseTypedProperty(
  location: TypedPropertyLocation,
  target: FrontmatterLine
): TypedPropertySource | FrontmatterEditFailure {
  const targetIndex = location.lines.indexOf(target)
  const end = propertyEndIndex(location, targetIndex)
  const raw = target.field?.[1] ?? ''
  const separated = splitComment(raw)
  if (/^(?:true|false|True|False|TRUE|FALSE)$/.test(separated.value)) {
    return {
      property: { type: 'checkbox', value: separated.value.toLowerCase() === 'true' },
      headerComment: separated.comment,
      itemComments: [],
      standaloneComments: [],
      endIndex: targetIndex + 1
    }
  }
  if (separated.value === '') {
    return parseBlockList(location.lines, targetIndex + 1, end, separated.comment)
  }
  if (separated.value.startsWith('[')) {
    const list = parseFlowList(raw)
    if (isEditFailure(list)) return list
    return {
      property: { type: 'list', value: list.atoms },
      headerComment: list.comment,
      itemComments: [],
      standaloneComments: [],
      endIndex: targetIndex + 1
    }
  }
  const atom = parseTypedAtom(raw)
  if (isEditFailure(atom)) return atom
  return {
    property: atom.atom,
    headerComment: atom.comment,
    itemComments: [],
    standaloneComments: [],
    endIndex: targetIndex + 1
  }
}

function validateTypedDocument(
  location: TypedPropertyLocation
): FrontmatterEditFailure | null {
  for (let index = 0; index < location.lines.length; index += 1) {
    const line = location.lines[index]
    if (!line.topLevelField) {
      if (line.text.trim() === '' || line.text.trimStart().startsWith('#')) continue
      return editFailure('MALFORMED_FRONTMATTER', 'Malformed frontmatter cannot be edited safely.')
    }
    const end = propertyEndIndex(location, index)
    const separated = splitComment(line.topLevelField[2])
    if (separated.value === '') {
      const block = parseBlockList(
        location.lines,
        index + 1,
        end,
        separated.comment,
        true
      )
      if (isEditFailure(block)) return block
      index = block.endIndex - 1
    } else if (separated.value.startsWith('[')) {
      const list = parseFlowList(line.topLevelField[2])
      if (isEditFailure(list)) return list
    } else if (/^[{!&*|>]/.test(separated.value)) {
      return scalarFailure(line.topLevelField[1])
    } else {
      const atom = parseTypedAtom(line.topLevelField[2])
      if (isEditFailure(atom) && !isUnsupportedTypedScalar(separated.value)) {
        return atom
      }
    }
  }
  return null
}

function validInputProperty(property: FrontmatterProperty): FrontmatterEditFailure | null {
  if (property.type === 'checkbox') {
    return typeof property.value === 'boolean'
      ? null
      : scalarFailure('property', 'Checkbox values must be booleans.')
  }
  const atoms = property.type === 'list' ? property.value : [property]
  if (!Array.isArray(atoms)) return scalarFailure('property')
  for (const atom of atoms) {
    if (
      !atom ||
      (atom.type !== 'text' && atom.type !== 'number') ||
      typeof atom.value !== 'string' ||
      (atom.type === 'number' && !DECIMAL_NUMBER_PATTERN.test(atom.value))
    ) {
      return scalarFailure('property', 'Property values must be text or decimal numbers.')
    }
  }
  return null
}

function sameProperty(a: FrontmatterProperty, b: FrontmatterProperty): boolean {
  if (a.type !== b.type) return false
  if (a.type !== 'list' && b.type !== 'list') return a.value === b.value
  if (a.type !== 'list' || b.type !== 'list' || a.value.length !== b.value.length) return false
  return a.value.every((atom, index) => atom.type === b.value[index].type && atom.value === b.value[index].value)
}

function formatAtom(atom: FrontmatterAtom): string {
  return atom.type === 'number' ? atom.value : quoteScalar(atom.value)
}

function formatProperty(
  name: string,
  property: FrontmatterProperty,
  eol: string,
  source?: TypedPropertySource
): string {
  if (property.type === 'checkbox') {
    return `${name}: ${property.value}${source?.headerComment ?? ''}${eol}`
  }
  if (property.type !== 'list') {
    return `${name}: ${formatAtom(property)}${source?.headerComment ?? ''}${eol}`
  }
  const preservedComments = [
    ...(source?.standaloneComments ?? []).map((comment) => comment.trimStart()),
    ...(source?.itemComments ?? []).map((comment) => comment.trimStart())
  ].filter((comment) => comment !== '')
  if (property.value.length === 0) {
    return [`${name}: []${source?.headerComment ?? ''}`, ...preservedComments].join(eol) + eol
  }
  return [
    `${name}:${source?.headerComment ?? ''}`,
    ...property.value.map((atom) => `  - ${formatAtom(atom)}`),
    ...preservedComments
  ].join(eol) + eol
}

function propertyComments(source: TypedPropertySource): string[] {
  return [
    source.headerComment.trimStart(),
    ...source.itemComments.map((comment) => comment.trimStart()),
    ...source.standaloneComments.map((comment) => comment.trimStart())
  ].filter((comment) => comment !== '')
}

export function inspectFrontmatterProperty(
  markdown: string,
  name: string
): FrontmatterPropertyInspection {
  const invalidName = validatePropertyName(name)
  if (invalidName) return typedInspectionFailure(invalidName.code, invalidName.message)
  if (!parseFrontmatter(markdown).found) return { ok: true, property: null }
  const location = locateTypedProperty(markdown, name)
  if (isEditFailure(location)) return typedInspectionFailure(location.code, location.message)
  const documentFailure = validateTypedDocument(location)
  if (documentFailure) return typedInspectionFailure(documentFailure.code, documentFailure.message)
  if (!location.target) return { ok: true, property: null }
  const parsed = parseTypedProperty(location, location.target)
  if (isEditFailure(parsed)) return typedInspectionFailure(parsed.code, parsed.message)
  return { ok: true, property: parsed.property }
}

export function setFrontmatterProperty(
  markdown: string,
  name: string,
  property: FrontmatterProperty
): FrontmatterEditResult {
  const invalidName = validatePropertyName(name) ?? validInputProperty(property)
  if (invalidName) return invalidName
  if (!parseFrontmatter(markdown).found) {
    const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
    const bom = markdown.startsWith('\uFEFF') ? '\uFEFF' : ''
    const body = markdown.slice(bom.length)
    return {
      ok: true,
      markdown: `${bom}---${eol}${formatProperty(name, property, eol)}---${body ? eol : ''}${body}`
    }
  }
  const location = locateTypedProperty(markdown, name)
  if (isEditFailure(location)) return location
  const documentFailure = validateTypedDocument(location)
  if (documentFailure) return documentFailure
  if (!location.target) {
    return {
      ok: true,
      markdown: `${markdown.slice(0, location.closingStart)}${formatProperty(name, property, location.eol)}${markdown.slice(location.closingStart)}`
    }
  }
  const source = parseTypedProperty(location, location.target)
  if (isEditFailure(source)) return source
  if (source.property.type !== property.type) return scalarFailure(name, `Property "${name}" cannot change kind.`)
  if (sameProperty(source.property, property)) return { ok: true, markdown }
  const start = location.contentStart + location.target.start
  const endIndex = source.endIndex
  const end = endIndex < location.lines.length
    ? location.contentStart + location.lines[endIndex].start
    : location.closingStart
  return {
    ok: true,
    markdown: `${markdown.slice(0, start)}${formatProperty(name, property, location.eol, source)}${markdown.slice(end)}`
  }
}

export function deleteFrontmatterProperty(
  markdown: string,
  name: string
): FrontmatterEditResult {
  const invalidName = validatePropertyName(name)
  if (invalidName) return invalidName
  if (!parseFrontmatter(markdown).found) {
    return editFailure('PROPERTY_NOT_FOUND', `Property "${name}" was not found.`)
  }
  const location = locateTypedProperty(markdown, name)
  if (isEditFailure(location)) return location
  const documentFailure = validateTypedDocument(location)
  if (documentFailure) return documentFailure
  if (!location.target) return editFailure('PROPERTY_NOT_FOUND', `Property "${name}" was not found.`)
  const source = parseTypedProperty(location, location.target)
  if (isEditFailure(source)) return source
  const start = location.contentStart + location.target.start
  const endIndex = source.endIndex
  const end = endIndex < location.lines.length
    ? location.contentStart + location.lines[endIndex].start
    : location.closingStart
  const comments = propertyComments(source)
  const replacement = comments.length === 0 ? '' : `${comments.join(location.eol)}${location.eol}`
  return { ok: true, markdown: `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}` }
}
