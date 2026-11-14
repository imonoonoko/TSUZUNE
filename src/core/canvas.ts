import { MAX_CANVAS_BYTES, type CanvasData, type CanvasCreateInput, type CanvasSaveInput } from '../shared/canvas'
import { validateRelativePath } from './paths'
import { isAuditHistoryPath } from '../shared/ai-write-policy'

function fail(field: string): never { throw new Error(`Canvas: ${field} が不正または未対応です。`) }
function object(value: unknown, keys: string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field)
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !keys.includes(key))) fail(`${field} (unknown field)`)
  return result
}
function text(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') fail(field)
}
function id(value: unknown): asserts value is string {
  text(value, 'id')
  if (!value.trim() || value.length > 200) fail('id')
}
function path(value: unknown): void {
  text(value, 'file path')
  if (!value || !validateRelativePath(value).valid || isAuditHistoryPath(value)) fail('file path')
}
function optional(value: Record<string, unknown>, key: string, check: (value: unknown) => void): void {
  if (Object.hasOwn(value, key)) check(value[key])
}
function enumeration(value: unknown, choices: string[]): void {
  if (typeof value !== 'string' || !choices.includes(value)) fail('enum')
}
function color(value: unknown): void {
  if (typeof value !== 'string' || !/^(?:[1-6]|#[0-9a-fA-F]{6})$/.test(value)) fail('color')
}
export function isCanvasPath(value: unknown): value is string {
  return typeof value === 'string' && /\.canvas$/i.test(value) && validateRelativePath(value).valid
}
export function parseCanvas(content: string): CanvasData {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > MAX_CANVAS_BYTES) fail('容量 / size')
  let parsed: unknown
  try { parsed = JSON.parse(content) } catch { fail('JSON') }
  const data = object(parsed, ['nodes', 'edges'], 'document')
  const nodes = data.nodes === undefined ? [] : data.nodes
  const edges = data.edges === undefined ? [] : data.edges
  if (!Array.isArray(nodes) || nodes.length > 500 || !Array.isArray(edges) || edges.length > 1000) fail('nodes/edges limit')
  const ids = new Set<string>(), nodeIds = new Set<string>()
  const uniqueId = (value: unknown): string => {
    id(value)
    if (ids.has(value)) fail('duplicate id')
    ids.add(value)
    return value
  }
  const extras: Record<string, string[]> = { text: ['text'], file: ['file', 'subpath'], link: ['url'], group: ['label', 'background', 'backgroundStyle'] }
  for (const value of nodes) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(extras, value.type)) fail('node type')
    const node = object(value, ['id', 'type', 'x', 'y', 'width', 'height', 'color', ...extras[value.type]], 'node')
    nodeIds.add(uniqueId(node.id))
    for (const key of ['x', 'y', 'width', 'height']) {
      const n = node[key], position = key === 'x' || key === 'y'
      if (typeof n !== 'number' || !Number.isInteger(n) || n < (position ? -1000000 : 1) || n > (position ? 1000000 : 100000)) fail(key)
    }
    optional(node, 'color', color)
    if (node.type === 'text') text(node.text, 'text')
    if (node.type === 'file') { path(node.file); optional(node, 'subpath', (v) => { text(v, 'subpath'); if (!v.startsWith('#')) fail('subpath') }) }
    if (node.type === 'link') { text(node.url, 'url'); try { const u = new URL(node.url); if (!['http:', 'https:'].includes(u.protocol)) fail('url') } catch { fail('url') } }
    if (node.type === 'group') {
      optional(node, 'label', (v) => text(v, 'label'))
      optional(node, 'background', path)
      optional(node, 'backgroundStyle', (v) => enumeration(v, ['cover', 'ratio', 'repeat']))
    }
  }
  for (const value of edges) {
    const edge = object(value, ['id', 'fromNode', 'toNode', 'fromSide', 'toSide', 'fromEnd', 'toEnd', 'color', 'label'], 'edge')
    uniqueId(edge.id)
    if (!nodeIds.has(edge.fromNode as string) || !nodeIds.has(edge.toNode as string)) fail('edge reference')
    for (const key of ['fromSide', 'toSide']) optional(edge, key, (v) => enumeration(v, ['top', 'right', 'bottom', 'left']))
    for (const key of ['fromEnd', 'toEnd']) optional(edge, key, (v) => enumeration(v, ['none', 'arrow']))
    optional(edge, 'color', color)
    optional(edge, 'label', (v) => text(v, 'label'))
  }
  return { nodes, edges } as CanvasData
}
export function serializeCanvas(data: CanvasData): string {
  const content = JSON.stringify(data, null, 2) + '\n'
  parseCanvas(content)
  return content
}

export function parseCanvasInput(value: unknown, save: false): CanvasCreateInput
export function parseCanvasInput(value: unknown, save: true): CanvasSaveInput
export function parseCanvasInput(value: unknown, save: boolean): CanvasCreateInput | CanvasSaveInput {
  const input = object(value, ['scope', 'path', 'content', ...(save ? ['expectedRevision'] : [])], 'input')
  const scope = object(input.scope, ['rootPath', 'rootRevision'], 'scope')
  text(scope.rootPath, 'rootPath')
  if (!scope.rootPath || !Number.isSafeInteger(scope.rootRevision) || (scope.rootRevision as number) < 0) fail('scope')
  if (!isCanvasPath(input.path) || isAuditHistoryPath(input.path)) fail('path')
  text(input.content, 'content')
  parseCanvas(input.content)
  if (save && (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedRevision))) fail('expectedRevision')
  return input as unknown as CanvasCreateInput | CanvasSaveInput
}
