import moment from 'moment'

/** Structured-cloneable values: never expose JS constructors or prototype methods. */
export interface BaseSpecial { baseType: 'date' | 'duration' | 'file' | 'link' | 'html' | 'image' | 'icon' | 'regexp'; value: string; display?: string; label?: BaseValue }
export type BaseValue = null | string | number | boolean | BaseValue[] | BaseSpecial | { [key: string]: BaseValue }
export type BaseExpression =
  | { kind: 'literal'; value: BaseValue }
  | { kind: 'identifier'; name: string }
  | { kind: 'array'; items: BaseExpression[] }
  | { kind: 'object'; items: [string, BaseExpression][] }
  | { kind: 'unary'; operator: string; value: BaseExpression }
  | { kind: 'binary'; operator: string; left: BaseExpression; right: BaseExpression }
  | { kind: 'member'; object: BaseExpression; property: BaseExpression }
  | { kind: 'call'; callee: BaseExpression; args: BaseExpression[] }
export const BASE_GLOBAL_FUNCTIONS = ['escapeHTML', 'date', 'duration', 'file', 'html', 'if', 'image', 'icon', 'link', 'list', 'max', 'min', 'now', 'number', 'today', 'random'] as const
export const BASE_METHODS = ['isTruthy', 'isType', 'toString', 'date', 'format', 'time', 'relative', 'isEmpty', 'contains', 'containsAll', 'containsAny', 'endsWith', 'lower', 'replace', 'repeat', 'reverse', 'slice', 'split', 'startsWith', 'title', 'trim', 'abs', 'ceil', 'floor', 'round', 'toFixed', 'filter', 'flat', 'join', 'map', 'reduce', 'sort', 'unique', 'asFile', 'linksTo', 'asLink', 'hasLink', 'hasProperty', 'hasTag', 'inFolder', 'keys', 'values', 'matches', 'mean'] as const
const forbidden = new Set(['__proto__', 'constructor', 'prototype', 'caller', 'callee', 'arguments'])
const precedence: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '>': 4, '<': 4, '>=': 4, '<=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '**': 7 }
type Token = { text: string; value?: BaseValue; type: 'value' | 'identifier' | 'operator' | 'end' }
class Parser {
  private offset = 0
  private current: Token = { text: '', type: 'end' }
  private depth = 0
  constructor(private source: string) { this.next(true) }
  private next(expectValue = false): void {
    while (/\s/.test(this.source[this.offset] ?? '') && this.offset < this.source.length) this.offset++
    if (this.offset >= this.source.length) { this.current = { text: '', type: 'end' }; return }
    const rest = this.source.slice(this.offset); const first = rest[0]
    if (first === '"' || first === "'") {
      let value = ''; let index = 1
      for (; index < rest.length; index++) {
        const char = rest[index]
        if (char === first) break
        if (char === '\\') {
          index++; const escaped = rest[index]
          if (escaped == null) throw new Error('Unterminated string.')
          if (escaped === 'u') { const hex = rest.slice(index + 1, index + 5); if (!/^[\da-f]{4}$/i.test(hex)) throw new Error('Invalid Unicode escape.'); value += String.fromCharCode(parseInt(hex, 16)); index += 4 }
          else value += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[escaped] ?? escaped
        } else value += char
      }
      if (rest[index] !== first) throw new Error('Unterminated string.')
      this.offset += index + 1; this.current = { text: rest.slice(0, index + 1), value, type: 'value' }; return
    }
    if (first === '/' && expectValue) {
      let index = 1; let bracket = false
      for (; index < rest.length; index++) {
        if (rest[index] === '\\') { index++; continue }
        if (rest[index] === '[') bracket = true
        if (rest[index] === ']') bracket = false
        if (rest[index] === '/' && !bracket) break
      }
      if (rest[index] !== '/') throw new Error('Unterminated regular expression.')
      const flags = /^[a-z]*/.exec(rest.slice(index + 1))?.[0] ?? ''
      // Validation only: matching runs inside a disposable worker in the renderer.
      new RegExp(rest.slice(1, index), flags)
      this.offset += index + 1 + flags.length
      this.current = { text: rest.slice(0, index + 1 + flags.length), value: { baseType: 'regexp', value: rest.slice(1, index), display: flags }, type: 'value' }; return
    }
    const number = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest)
    if (number) { this.offset += number[0].length; this.current = { text: number[0], value: Number(number[0]), type: 'value' }; return }
    const identifier = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(rest)
    if (identifier) { this.offset += identifier[0].length; this.current = { text: identifier[0], type: 'identifier' }; return }
    const operator = /^(?:===|!==|==|!=|>=|<=|&&|\|\||\*\*|[+\-*/%><!.,()[\]{}:])/.exec(rest)
    if (!operator) throw new Error(`Unexpected token at ${this.offset + 1}.`)
    this.offset += operator[0].length; this.current = { text: operator[0], type: 'operator' }
  }
  private take(text: string, expectValue = true): void { if (this.current.text !== text) throw new Error(`Expected ${text}.`); this.next(expectValue) }
  parse(minimum = 0): BaseExpression {
    if (++this.depth > 100) throw new Error('Expression nesting limit exceeded.')
    let left: BaseExpression
    const token = this.current
    if (token.type === 'value') { left = { kind: 'literal', value: token.value ?? null }; this.next() }
    else if (token.text === '!' || token.text === '-' || token.text === '+') { this.next(true); left = { kind: 'unary', operator: token.text, value: this.parse(8) } }
    else if (token.text === '(') { this.next(true); left = this.parse(); this.take(')', false) }
    else if (token.text === '[') {
      this.next(true); const items: BaseExpression[] = []
      while (this.current.text !== ']') { items.push(this.parse()); if ((this.current as Token).text !== ',') break; this.next(true) }
      this.take(']', false); left = { kind: 'array', items }
    } else if (token.text === '{') {
      this.next(true); const items: [string, BaseExpression][] = []
      while (this.current.text !== '}') {
        const key = this.current.type === 'value' ? String(this.current.value) : this.current.text
        if (!key || forbidden.has(key)) throw new Error('Unsafe object key.')
        this.next(); this.take(':'); items.push([key, this.parse()]); if ((this.current as Token).text !== ',') break; this.next(true)
      }
      this.take('}', false); left = { kind: 'object', items }
    } else if (token.type === 'identifier') {
      if (forbidden.has(token.text)) throw new Error('Unsafe identifier.')
      left = token.text === 'true' || token.text === 'false' || token.text === 'null' ? { kind: 'literal', value: token.text === 'null' ? null : token.text === 'true' } : { kind: 'identifier', name: token.text }; this.next()
    } else throw new Error(`Expected a value near ${token.text || 'end'}.`)
    while (true) {
      const next = this.current.text
      if (next === '.') { this.next(); const property = this.current.text; if (this.current.type !== 'identifier' || forbidden.has(property)) throw new Error('Unsafe member.'); this.next(); left = { kind: 'member', object: left, property: { kind: 'literal', value: property } }; continue }
      if (next === '[') { this.next(true); const property = this.parse(); this.take(']', false); left = { kind: 'member', object: left, property }; continue }
      if (next === '(') {
        this.next(true); const args: BaseExpression[] = []
        while (this.current.text !== ')') { args.push(this.parse()); if ((this.current as Token).text !== ',') break; this.next(true) }
        this.take(')', false); left = { kind: 'call', callee: left, args }; continue
      }
      const priority = precedence[next]
      if (priority == null || priority < minimum) break
      this.next(true); left = { kind: 'binary', operator: next, left, right: this.parse(priority + (next === '**' ? 0 : 1)) }
    }
    this.depth--; return left
  }
  finish(): BaseExpression { const result = this.parse(); if (this.current.type !== 'end') throw new Error(`Unexpected ${this.current.text}.`); return result }
}
export function parseBaseExpression(source: string): BaseExpression { if (source.length > 20_000) throw new Error('Expression too long.'); return new Parser(source).finish() }
export function validateBaseExpression(ast: BaseExpression): void {
  if (ast.kind === 'call') {
    if (ast.callee.kind === 'identifier') { if (!(BASE_GLOBAL_FUNCTIONS as readonly string[]).includes(ast.callee.name)) throw new Error(`Unsupported function ${ast.callee.name}.`) }
    else if (ast.callee.kind === 'member' && ast.callee.property.kind === 'literal' && typeof ast.callee.property.value === 'string') { if (!(BASE_METHODS as readonly string[]).includes(ast.callee.property.value)) throw new Error(`Unsupported method ${ast.callee.property.value}.`) }
    else throw new Error('Dynamic function calls are not allowed.')
    validateBaseExpression(ast.callee); ast.args.forEach(validateBaseExpression)
  } else if (ast.kind === 'member') { validateBaseExpression(ast.object); validateBaseExpression(ast.property) }
  else if (ast.kind === 'array') ast.items.forEach(validateBaseExpression)
  else if (ast.kind === 'object') ast.items.forEach(([, value]) => validateBaseExpression(value))
  else if (ast.kind === 'binary') { validateBaseExpression(ast.left); validateBaseExpression(ast.right) }
  else if (ast.kind === 'unary') validateBaseExpression(ast.value)
}
export function special(value: BaseValue, type?: BaseSpecial['baseType']): value is BaseSpecial { return value !== null && !Array.isArray(value) && typeof value === 'object' && typeof value.baseType === 'string' && (!type || value.baseType === type) }
export function baseValueText(value: BaseValue): string {
  if (value == null) return ''
  if (special(value)) return value.label != null ? baseValueText(value.label) : value.display ?? value.value
  if (Array.isArray(value)) return value.map(baseValueText).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
export function baseValueEqual(left: BaseValue, right: BaseValue): boolean {
  if (special(left, 'date') && special(right, 'date')) return dateMoment(left).valueOf() === dateMoment(right).valueOf()
  if (special(left, 'link') && special(right, 'link')) return left.value === right.value
  if (special(left, 'file') && special(right, 'file')) return left.value === right.value
  return JSON.stringify(left) === JSON.stringify(right)
}
function explicitDateOffset(value: string): boolean { return /[T ].*(?:Z|[+-]\d\d(?::?\d\d)?)$/i.test(value) }
function dateMoment(value: BaseSpecial): moment.Moment { return explicitDateOffset(value.value) ? moment.parseZone(value.value, moment.ISO_8601, true) : moment(value.value, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss'], true) }
export function baseDate(source: string | number): BaseSpecial {
  const parsed = typeof source === 'number' ? moment(source) : dateMoment({ baseType: 'date', value: source })
  if (!parsed.isValid()) throw new Error('Invalid date.')
  return { baseType: 'date', value: typeof source === 'string' ? source : parsed.format('YYYY-MM-DDTHH:mm:ss.SSSZ') }
}
function duration(source: string): BaseSpecial {
  if (!/^\s*[+-]?(?:\d+(?:\.\d+)?\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?|milliseconds?|ms|y|M|w|d|h|m|s)\s*)+$/i.test(source)) throw new Error('Invalid duration.')
  return { baseType: 'duration', value: source.trim() }
}
function durationParts(source: string): moment.Duration {
  const result = moment.duration(0)
  for (const match of source.matchAll(/([+-]?\d+(?:\.\d+)?)\s*([A-Za-z]+)/g)) {
    const unit = ({ y: 'years', M: 'months', w: 'weeks', d: 'days', h: 'hours', m: 'minutes', s: 'seconds', ms: 'milliseconds' } as Record<string, string>)[match[2]] ?? match[2]
    result.add(Number(match[1]), unit as moment.unitOfTime.DurationConstructor)
  }
  return result
}
function numeric(value: BaseValue): number {
  const result = special(value, 'date') ? dateMoment(value).valueOf() : special(value, 'duration') ? durationParts(value.value).asMilliseconds() : Number(value)
  if (!Number.isFinite(result) || typeof value === 'object' && value !== null && !special(value, 'date') && !special(value, 'duration')) throw new Error('Invalid number.')
  return result
}
function regex(value: BaseValue): string | RegExp { return special(value, 'regexp') ? new RegExp(value.value, value.display ?? '') : baseValueText(value) }
export interface BaseExpressionContext { resolve: (name: string) => BaseValue; file: (path: BaseValue) => BaseValue; now?: number; random?: () => number; deadline?: number; maxSteps?: number }
export function evaluateBaseExpression(source: string | BaseExpression, context: BaseExpressionContext, locals: Record<string, BaseValue> = {}): BaseValue {
  const ast = typeof source === 'string' ? parseBaseExpression(source) : source
  validateBaseExpression(ast)
  let steps = 0
  const equal = (left: BaseValue, right: BaseValue): boolean => {
    if (special(left, 'link') || special(left, 'file') || special(right, 'link') || special(right, 'file')) {
      if (!(special(left, 'link') || special(left, 'file')) || !(special(right, 'link') || special(right, 'file'))) return false
      const a = context.file(left); const b = context.file(right)
      return a != null && b != null ? baseValueEqual(a, b) : baseValueEqual(left, right)
    }
    return baseValueEqual(left, right)
  }
  const execute = (node: BaseExpression, scope: Record<string, BaseValue>): BaseValue => {
    if (++steps > (context.maxSteps ?? 100_000) || context.deadline != null && Date.now() > context.deadline) throw new Error('Expression execution limit exceeded.')
    const run = (item: BaseExpression): BaseValue => execute(item, scope)
    if (node.kind === 'literal') return node.value
    if (node.kind === 'identifier') return Object.hasOwn(scope, node.name) ? scope[node.name] : context.resolve(node.name)
    if (node.kind === 'array') return node.items.map(run)
    if (node.kind === 'object') return Object.fromEntries(node.items.map(([name, item]) => [name, run(item)]))
    if (node.kind === 'unary') { const value = run(node.value); return node.operator === '!' ? !value : node.operator === '-' ? -numeric(value) : numeric(value) }
    if (node.kind === 'member') {
      const name = baseValueText(run(node.property))
      if (forbidden.has(name)) throw new Error('Unsafe member access.')
      if (node.object.kind === 'identifier' && ['formula', 'note', 'file'].includes(node.object.name)) return context.resolve(`${node.object.name}.${name}`)
      return member(run(node.object), name)
    }
    if (node.kind === 'binary') {
      const left = run(node.left)
      if (node.operator === '&&') return left ? run(node.right) : left
      if (node.operator === '||') return left ? left : run(node.right)
      const right = run(node.right)
      if (['==', '===', '!=', '!=='].includes(node.operator)) return equal(left, right) === ['==', '==='].includes(node.operator)
      if (['>', '<', '>=', '<='].includes(node.operator)) {
        const a = special(left, 'date') ? numeric(left) : left; const b = special(right, 'date') ? numeric(right) : right
        if (typeof a !== typeof b || a == null || b == null || typeof a === 'object' || typeof b === 'object') return false
        return node.operator === '>' ? a > b : node.operator === '<' ? a < b : node.operator === '>=' ? a >= b : a <= b
      }
      if (special(left, 'date') && (node.operator === '+' || node.operator === '-')) {
        if (special(right, 'date') && node.operator === '-') return numeric(left) - numeric(right)
        const amount = typeof right === 'string' ? duration(right) : right
        if (!special(amount, 'duration')) throw new Error('Date arithmetic requires a duration.')
        const date = dateMoment(left); if (node.operator === '+') date.add(durationParts(amount.value)); else date.subtract(durationParts(amount.value))
        return { baseType: 'date', value: date.format('YYYY-MM-DDTHH:mm:ss.SSSZ') }
      }
      if (special(left, 'duration')) {
        if (special(right, 'duration') && (node.operator === '+' || node.operator === '-')) return { baseType: 'duration', value: `${numeric(left) + (node.operator === '+' ? 1 : -1) * numeric(right)}ms` }
        if (node.operator === '*' || node.operator === '/') {
          const factor = node.operator === '*' ? numeric(right) : 1 / numeric(right)
          if (!Number.isFinite(factor)) throw new Error('Duration result is not finite.')
          const parts = durationParts(left.value)
          return { baseType: 'duration', value: `${parts.years() * factor}y ${parts.months() * factor}M ${parts.days() * factor}d ${parts.hours() * factor}h ${parts.minutes() * factor}m ${parts.seconds() * factor}s ${parts.milliseconds() * factor}ms` }
        }
      }
      if (special(right, 'duration')) throw new Error('Duration arithmetic requires the duration on the left.')
      if (node.operator === '+' && (typeof left === 'string' || typeof right === 'string')) return baseValueText(left) + baseValueText(right)
      const a = numeric(left); const b = numeric(right)
      const result = node.operator === '+' ? a + b : node.operator === '-' ? a - b : node.operator === '*' ? a * b : node.operator === '/' ? a / b : node.operator === '**' ? a ** b : a % b
      if (!Number.isFinite(result)) throw new Error('Arithmetic result is not finite.')
      return result
    }
    if (node.callee.kind === 'identifier') {
      const name = node.callee.name
      if (name === 'if') return run(node.args[0]) ? run(node.args[1]) : node.args[2] ? run(node.args[2]) : null
      return globalFunction(name, node.args.map(run))
    }
    if (node.callee.kind !== 'member') throw new Error('Invalid function.')
    const object = run(node.callee.object); const name = baseValueText(run(node.callee.property))
    if (Array.isArray(object) && ['map', 'filter', 'reduce'].includes(name)) {
      const expression = node.args[0]; if (!expression) throw new Error(`${name} requires an expression.`)
      if (name === 'reduce') return object.reduce<BaseValue>((acc, value, index) => execute(expression, { ...scope, value, index, acc }), node.args[1] ? run(node.args[1]) : null)
      return name === 'map' ? object.map((value, index) => execute(expression, { ...scope, value, index })) : object.filter((value, index) => execute(expression, { ...scope, value, index }))
    }
    return method(object, name, node.args.map(run))
  }
  const member = (object: BaseValue, name: string): BaseValue => {
    if (forbidden.has(name)) throw new Error('Unsafe member access.')
    if (special(object, 'date')) {
      const date = dateMoment(object)
      const fields: Record<string, number> = { year: date.year(), month: date.month() + 1, day: date.date(), hour: date.hour(), minute: date.minute(), second: date.second(), millisecond: date.millisecond() }
      return fields[name] ?? null
    }
    if ((typeof object === 'string' || Array.isArray(object)) && name === 'length') return object.length
    if (Array.isArray(object)) return /^\d+$/.test(name) ? object[Number(name)] ?? null : null
    if (special(object, 'file')) {
      if (name === 'file') return object
      if (!['name', 'basename', 'path', 'folder', 'ext', 'size', 'ctime', 'mtime', 'properties', 'tags', 'links', 'backlinks', 'embeds'].includes(name)) return null
      if (name === 'properties') {
        const error = (object as Record<string, BaseValue>).basePropertiesError
        if (error) throw new Error(baseValueText(error))
      }
    }
    if (object && typeof object === 'object') return Object.hasOwn(object, name) ? (object as Record<string, BaseValue>)[name] : null
    return null
  }
  const globalFunction = (name: string, args: BaseValue[]): BaseValue => {
    const value = args[0] ?? null; const string = baseValueText(value)
    switch (name) {
      case 'escapeHTML': return string.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
      case 'date': return baseDate(string)
      case 'duration': return duration(string)
      case 'file': return context.file(value)
      case 'html': case 'image': case 'icon': return { baseType: name, value: special(value, 'file') ? baseValueText(member(value, 'path')) : string }
      case 'link': { const path = special(value, 'file') ? baseValueText(member(value, 'path')) : string; const wiki = /^\[\[(.*?)(?:\|(.*))?\]\]$/.exec(path); return { baseType: 'link', value: wiki?.[1] ?? path, ...(args[1] != null ? { label: args[1] } : wiki?.[2] ? { display: wiki[2] } : {}) } }
      case 'list': return Array.isArray(value) ? value : [value]
      case 'max': return Math.max(...args.map(numeric))
      case 'min': return Math.min(...args.map(numeric))
      case 'now': return baseDate(context.now ?? Date.now())
      case 'today': return baseDate(moment(context.now ?? Date.now()).startOf('day').valueOf())
      case 'number': return numeric(value)
      case 'random': return context.random?.() ?? Math.random()
      default: throw new Error(`Unsupported function ${name}.`)
    }
  }
  const method = (object: BaseValue, name: string, args: BaseValue[]): BaseValue => {
    const value = args[0] ?? null; const string = baseValueText(value)
    if (name === 'isTruthy') return Boolean(object)
    if (name === 'toString') return baseValueText(object)
    if (name === 'isType') return (special(object) ? object.baseType : Array.isArray(object) ? 'list' : object === null ? 'null' : typeof object) === string
    if (name === 'isEmpty') return object == null || object === '' || Array.isArray(object) && object.length === 0 || typeof object === 'object' && object !== null && !special(object) && Object.keys(object).length === 0
    if (special(object, 'date')) {
      const date = dateMoment(object)
      if (name === 'date') return { baseType: 'date', value: date.startOf('day').format('YYYY-MM-DDTHH:mm:ss.SSSZ') }
      if (name === 'format') return date.format(string)
      if (name === 'time') return date.format('HH:mm:ss')
      if (name === 'relative') return date.from(moment(context.now ?? Date.now()))
    }
    if (special(object, 'regexp') && name === 'matches') return (regex(object) as RegExp).test(string)
    if (special(object, 'link')) {
      if (name === 'asFile') return context.file(object)
      if (name === 'linksTo') { const file = context.file(object); return special(file, 'file') ? method(file, 'hasLink', args) : false }
    }
    if (special(object, 'file')) {
      const path = baseValueText(member(object, 'path'))
      if (name === 'asLink') return { baseType: 'link', value: path, ...(value != null ? { display: string } : {}) }
      if (name === 'inFolder') { const folder = string.replace(/^\/+|\/+$/g, ''); return folder === '' || path.startsWith(`${folder}/`) }
      if (name === 'hasProperty') {
        const metadata = object as unknown as Record<string, BaseValue>
        const error = metadata.basePropertyError; if (error) throw new Error(baseValueText(error))
        const names = metadata.basePropertyNames; if (Array.isArray(names)) return names.includes(string)
        const props = member(object, 'properties'); return props != null && typeof props === 'object' && Object.hasOwn(props, string)
      }
      if (name === 'hasTag') { const tags = member(object, 'tags'); return Array.isArray(tags) && args.some((tag) => tags.some((actual) => { const query = baseValueText(tag).replace(/^#/, ''); const text = baseValueText(actual).replace(/^#/, ''); return text === query || text.startsWith(`${query}/`) })) }
      if (name === 'hasLink') { const links = member(object, 'links'); const target = context.file(value); const targetPath = special(target, 'file') ? baseValueText(member(target, 'path')) : string; return Array.isArray(links) && links.some((link) => { const resolved = context.file(link); return special(resolved, 'file') && baseValueText(member(resolved, 'path')) === targetPath }) }
    }
    if (typeof object === 'string') {
      if (name === 'contains') return object.includes(string)
      if (name === 'containsAll') return args.every((item) => object.includes(baseValueText(item)))
      if (name === 'containsAny') return args.some((item) => object.includes(baseValueText(item)))
      if (name === 'startsWith') return object.startsWith(string)
      if (name === 'endsWith') return object.endsWith(string)
      if (name === 'lower') return object.toLowerCase()
      if (name === 'replace') return special(value, 'regexp') ? object.replace(regex(value), baseValueText(args[1] ?? null)) : object.replaceAll(string, baseValueText(args[1] ?? null))
      if (name === 'repeat') { const count = numeric(value); if (!Number.isInteger(count) || count < 0 || count * object.length > 1_000_000) throw new Error('Repeat limit exceeded.'); return object.repeat(count) }
      if (name === 'reverse') return Array.from(object).reverse().join('')
      if (name === 'slice') return object.slice(numeric(value), args[1] == null ? undefined : numeric(args[1]))
      if (name === 'split') return object.split(regex(value), args[1] == null ? undefined : numeric(args[1]))
      if (name === 'title') return object.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
      if (name === 'trim') return object.trim()
    }
    if (typeof object === 'number') {
      if (name === 'abs') return Math.abs(object)
      if (name === 'ceil') return Math.ceil(object)
      if (name === 'floor') return Math.floor(object)
      if (name === 'round') { const digits = value == null ? 0 : numeric(value); const scale = 10 ** digits; return Math.round(object * scale) / scale }
      if (name === 'toFixed') return object.toFixed(value == null ? 0 : numeric(value))
    }
    if (Array.isArray(object)) {
      const contains = (item: BaseValue): boolean => object.some((actual) => equal(actual, item))
      if (name === 'contains') return contains(value)
      if (name === 'containsAll') return args.every(contains)
      if (name === 'containsAny') return args.some(contains)
      if (name === 'flat') return object.flat()
      if (name === 'join') return object.map(baseValueText).join(string)
      if (name === 'reverse') return [...object].reverse()
      if (name === 'slice') return object.slice(numeric(value), args[1] == null ? undefined : numeric(args[1]))
      if (name === 'sort') return [...object].sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : baseValueText(a).localeCompare(baseValueText(b)))
      if (name === 'unique') return object.filter((item, index) => object.findIndex((other) => baseValueEqual(item, other)) === index)
      if (name === 'mean') { const numbers = object.filter((item): item is number => typeof item === 'number'); return numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : null }
    }
    if (object && typeof object === 'object' && !special(object) && !Array.isArray(object)) {
      if (name === 'keys') return Object.keys(object)
      if (name === 'values') return Object.values(object)
    }
    throw new Error(`${name} is not available for this value type.`)
  }
  return execute(ast, locals)
}
