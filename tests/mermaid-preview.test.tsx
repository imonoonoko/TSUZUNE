// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'

const api = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: api }))
const svg = (text: string) => `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="diagram-title"><title id="diagram-title">${text}</title><text>${text}</text></svg>`
const props = { notePath: 'Diagram.md', attachments: [], onWikiLink: vi.fn() }
const fence = (code: string) => '```mermaid\n' + code + '\n```'
beforeEach(() => { api.render.mockReset(); api.render.mockImplementation(async (_id: string, code: string) => ({ svg: svg(code) })) })
afterEach(cleanup)

describe('Mermaid preview', () => {
  it('renders only Mermaid fences while retaining normal code and the following body', async () => {
    const content = fence('flowchart LR\nA --> B') + '\n\n```js\nconst n = 1\n```\n\n`mermaid`\n\n**続き**'
    const { container } = render(<MarkdownPreview {...props} content={content} />)
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg title')?.textContent).toContain('A --> B'))
    expect(container.querySelector('pre code')?.textContent).toBe('const n = 1\n')
    expect(container.querySelector('strong')?.textContent).toBe('続き')
    expect(api.render).toHaveBeenCalledTimes(1)
  })

  it('contains invalid syntax within the diagram and keeps its original source', async () => {
    api.render.mockRejectedValue(new Error('Syntax error'))
    const code = 'flowchart LR\ninvalid [['
    const { container } = render(<MarkdownPreview {...props} content={fence(code) + '\n\n**After**'} />)
    await waitFor(() => expect(container.querySelector('.mermaid-error')).not.toBeNull())
    expect(container.querySelector('.mermaid-error code')?.textContent).toBe(code + '\n')
    expect(container.querySelector('strong')?.textContent).toBe('After')
  })

  it('prints embedded diagrams without the preview controls', async () => {
    const source = fence('flowchart LR\nA-->B')
    const { container } = render(<MarkdownPreview {...props} content="![[Source]]" printAttachments notes={[{ path: 'Source.md', name: 'Source', content: source, size: source.length, modifiedAt: 1 }]} />)
    await waitFor(() => expect(container.querySelector('.note-embed .mermaid-diagram > svg')).not.toBeNull())
    expect(container.querySelector('.mermaid-diagram button')).toBeNull()
    expect(api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'neutral' }))
  })
  it('uses unique render identities for multiple and embedded diagrams', async () => {
    const content = fence('flowchart LR\nA-->B')
    const { container } = render(<MarkdownPreview {...props} content={content + '\n\n![[Source]]'} notes={[{ path: 'Source.md', name: 'Source', content, size: content.length, modifiedAt: 1 }]} />)
    await waitFor(() => expect(container.querySelectorAll('.mermaid-diagram svg')).toHaveLength(2))
    expect(new Set(api.render.mock.calls.map(call => call[0])).size).toBe(2)
    expect(container.querySelector('.note-embed .mermaid-diagram svg')).not.toBeNull()
  })
})
