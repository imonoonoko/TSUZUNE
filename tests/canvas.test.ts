import { describe, expect, it } from 'vitest'
import { parseCanvas, serializeCanvas } from '../src/core/canvas'

describe('JSON Canvas', () => {
  it('reads optional arrays and preserves documented metadata without losing it', () => {
    expect(parseCanvas('{}')).toEqual({ nodes: [], edges: [] })
    const data = { nodes: [{ id: 'a', type: 'file', x: 0, y: -1, width: 100, height: 100, file: 'notes/a.md', subpath: '#heading', color: '#FF0000' }], edges: [{ id: 'e', fromNode: 'a', toNode: 'a', fromEnd: 'arrow', toEnd: 'none', label: 'self' }] }
    expect(parseCanvas(serializeCanvas(data as never))).toEqual(data)
  })
  it('rejects unknown fields, invalid references, unsafe paths, enums and resource overflow', () => {
    const node = { id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 100, text: '' }
    for (const value of [
      { nodes: [{ ...node, extension: true }] },
      { nodes: [node, node] },
      { nodes: [{ ...node, x: 1.5 }] },
      { nodes: [{ ...node, type: 'file', text: undefined, file: '../escape.md' }] },
      { nodes: [node], edges: [{ id: 'e', fromNode: 'a', toNode: 'missing' }] },
      { nodes: [{ ...node, color: 'red' }] },
      { nodes: Array.from({ length: 501 }, (_, i) => ({ ...node, id: String(i) })) }
    ]) expect(() => parseCanvas(JSON.stringify(value))).toThrow()
    expect(() => parseCanvas(' '.repeat(4 * 1024 * 1024 + 1))).toThrow(/size|大き|容量/i)
  })
  it('retains all four node types and every documented optional field', () => {
    const geometry = { x: -1000000, y: 1000000, width: 1, height: 100000 }
    const data = {
      nodes: [
        { ...geometry, id: 'text', type: 'text', text: '# Markdown', color: '1' },
        { ...geometry, id: 'file', type: 'file', file: '画像.png', subpath: '#^block' },
        { ...geometry, id: 'link', type: 'link', url: 'https://example.com/?q=1' },
        { ...geometry, id: 'group', type: 'group', label: 'Group', background: 'missing/image.png', backgroundStyle: 'ratio', color: '#aBcDeF' }
      ],
      edges: [{ id: 'edge', fromNode: 'text', toNode: 'file', fromSide: 'right', toSide: 'left', fromEnd: 'none', toEnd: 'arrow', color: '6', label: 'reference' }]
    }
    expect(parseCanvas(serializeCanvas(data as never))).toEqual(data)
  })
  it('rejects invalid standard metadata, duplicate ids and excess edges', () => {
    const node = { id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' }
    for (const value of [
      { extension: true }, { nodes: null }, { edges: {} },
      { nodes: [{ ...node, id: '' }] }, { nodes: [{ ...node, id: 'x'.repeat(201) }] },
      { nodes: [{ ...node, width: 0 }] }, { nodes: [{ ...node, x: 1000001 }] },
      { nodes: [{ ...node, type: 'unknown' }] },
      { nodes: [{ id: 'a', type: 'file', x: 0, y: 0, width: 1, height: 1, file: 'a.md', subpath: 'heading' }] },
      { nodes: [{ ...node, type: 'link', text: undefined, url: 'javascript:alert(1)' }] },
      { nodes: [node], edges: [{ id: 'e', fromNode: 'a', toNode: 'a', fromSide: 'center' }] },
      { nodes: [node], edges: [{ id: 'a', fromNode: 'a', toNode: 'a' }] },
      { nodes: [node], edges: Array.from({ length: 1001 }, (_, i) => ({ id: `e${i}`, fromNode: 'a', toNode: 'a' })) }
    ]) expect(() => parseCanvas(JSON.stringify(value))).toThrow()
    expect(() => parseCanvas(JSON.stringify({ nodes: [{ ...node, text: 'あ'.repeat(1400000) }] }))).toThrow(/size|容量/)
  })
})
