import { describe, expect, it } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import { buildWikiLinkIndex, extractNoteLinks, findLinkImpact, getBacklinks, getOutgoingLinks, resolveIndexedNoteLink } from '../src/core/links'
import { rewriteMovedLinks } from '../src/core/move-links'
import { buildWikiGraph, getLocalWikiGraph } from '../src/core/graph'
import { findUnlinkedMentions } from '../src/core/unlinked-mentions'
import { compilePathAliases } from '../src/core/path-aliases'
const note = (path: string, content = ''): NoteDocument => ({ path, name: path.split('/').at(-1)!.replace(/\.md$/, ''), content, size: content.length, modifiedAt: 1 })

describe('source-aware note links', () => {
  it('decodes Markdown entities while retaining original source ranges for links and moves', () => {
    const content = '[decimal](T&#97;rget.md#part) [hex][ref] [named](A&amp;B.md)\n\n[ref]: T&#x61;rget.md\n'
    const source = note('Source.md', content)
    const notes = [source, note('Target.md'), note('A&B.md')]
    const links = extractNoteLinks(content, source.path)
    expect(links.map(link => link.target)).toEqual(['Target.md#part', 'Target.md', 'A&B.md'])
    expect(content.slice(links[0].destinationRange.from, links[0].destinationRange.to)).toBe('T&#97;rget.md#part')
    expect(getBacklinks('Target.md', notes).map(item => item.path)).toEqual(['Source.md'])
    expect(buildWikiGraph(notes).edges).toContainEqual({ sourcePath: 'Source.md', targetPath: 'Target.md' })
    const moved = rewriteMovedLinks(source, buildWikiLinkIndex(notes), 'Target.md', 'New.md')
    expect(moved).toContain('(New.md#part)')
    expect(moved).toContain('[ref]: New.md')
    expect(moved).toContain('(A&amp;B.md)')
  })
  it('preserves encoded fragment bytes when rewriting entity destinations', () => {
    for (const suffix of ['#part&#32;name', '#part&#40;name', '&#35;part&#32;name', '\\#part&#32;name']) {
      const source = note('Source.md', `[a](T&#97;rget.md${suffix})`)
      const notes = [source, note('Target.md')]
      const moved = rewriteMovedLinks(source, buildWikiLinkIndex(notes), 'Target.md', 'New.md')
      expect(moved).toBe(`[a](New.md${suffix})`)
      expect(extractNoteLinks(moved, source.path)[0].target).toBe(extractNoteLinks(source.content, source.path)[0].target.replace('Target.md', 'New.md'))
    }
  })
  it('keeps frontmatter Wiki links in structural indexes while excluding Markdown and mentions there', () => {
    const content = '\uFEFF---\r\nsubject: "[[Target]]"\r\nrelated:\r\n    - "[[Other]]"\r\nmarkdown: "[hidden](Other.md)"\r\ncode: "`[[Hidden]]`"\r\n---\r\nTarget\r\n'
    const notes = [note('Source.md', content), note('Target.md'), note('Other.md'), note('Hidden.md')]
    const links = extractNoteLinks(content, 'Source.md')
    expect(links.map(link => [link.kind, link.target])).toEqual([['wiki', 'Target'], ['wiki', 'Other']])
    expect(links.every(link => content.slice(link.range.from, link.range.to) === link.raw)).toBe(true)
    expect(getOutgoingLinks(content, notes, undefined, 'Source.md').map(link => link.resolvedPath)).toEqual(['Target.md', 'Other.md'])
    expect(getBacklinks('Target.md', notes).map(item => item.path)).toEqual(['Source.md'])
    expect(buildWikiGraph(notes).edges).toEqual([{ sourcePath: 'Source.md', targetPath: 'Other.md' }, { sourcePath: 'Source.md', targetPath: 'Target.md' }])
    expect(findUnlinkedMentions('Target.md', notes).map(item => item.range.from)).toEqual([content.lastIndexOf('Target')])
  })
  it('extracts inline and used full/collapsed/shortcut reference links with source ranges', () => {
    const content = '[inline](../Target.md#Part) [full][id] [collapsed][] [shortcut]\n\n[id]: ../Target.md\n[collapsed]: ../Target.md\n[shortcut]: ../Target.md\n[unused]: ../Other.md\n<!-- [comment](../Other.md) -->\n`[code](../Other.md)`'
    const links = extractNoteLinks(content, 'Folder/Source.md')
    expect(links).toHaveLength(4)
    expect(links[0]).toMatchObject({ kind: 'markdown', sourcePath: 'Folder/Source.md', fragment: 'Part' })
    expect(content.slice(links[0].destinationRange.from, links[0].destinationRange.to)).toBe('../Target.md#Part')
    const notes = [note('Folder/Source.md', content), note('Target.md')]
    expect(getOutgoingLinks(content, notes, undefined, notes[0].path)).toHaveLength(2)
    expect(getBacklinks('Target.md', notes).map(item => item.path)).toEqual(['Folder/Source.md'])
    expect(buildWikiGraph(notes).edges).toEqual([{ sourcePath: 'Folder/Source.md', targetPath: 'Target.md' }])
  })
  it('resolves exact relative destinations before aliases and never falls back to basename', () => {
    const notes = [note('Folder/Target.md'), note('Other/Target.md'), note('New.md')]
    const index = buildWikiLinkIndex(notes, compilePathAliases({ 'Folder/Target.md': 'New.md', 'Folder/Old.md': 'New.md' }))
    expect(resolveIndexedNoteLink({ kind: 'markdown', sourcePath: 'Folder/Source.md', target: 'Target.md' }, index)).toMatchObject({ status: 'resolved', path: 'Folder/Target.md' })
    expect(resolveIndexedNoteLink({ kind: 'markdown', sourcePath: 'Folder/Source.md', target: 'Old.md' }, index)).toMatchObject({ status: 'resolved', path: 'New.md' })
    expect(resolveIndexedNoteLink({ kind: 'markdown', sourcePath: 'Root.md', target: 'Target.md' }, index).status).toBe('missing')
  })
  it('detects the moving source relative link impact', () => {
    const notes = [note('Old/Source.md', '[target](Target.md)'), note('Old/Target.md')]
    expect(findLinkImpact(notes, new Map([['Old/Source.md', 'New/Source.md']])).sourcePaths).toEqual(['Old/Source.md'])
  })
  it('rebases moving note own notes, images, attachments and missing references preserving bytes', () => {
    const content = '\uFEFF# Source\r\n[a](Target.md#part) ![image](images/p.png) [asset](../asset.pdf) [missing](Missing.md) [ref][r]\r\n\r\n[r]: ./missing.bin\r\n<!-- [keep](Target.md) -->\r\n`[keep](Target.md)` [external](https://example.com/Target.md)\r\n'
    const source = note('Old/Source.md', content)
    const result = rewriteMovedLinks(source, buildWikiLinkIndex([source]), source.path, 'New/Deep/Source.md')
    expect(result).toBe(content.replace('(Target.md#part)', '(../../Old/Target.md#part)').replace('(images/p.png)', '(../../Old/images/p.png)').replace('(../asset.pdf)', '(../../asset.pdf)').replace('(Missing.md)', '(../../Old/Missing.md)').replace('./missing.bin', './../../Old/missing.bin'))
  })
  it('expands a cyclic local graph up to depth three with directed traversal edges', () => {
    const graph = buildWikiGraph([note('A.md', '[[B]]'), note('B.md', '[[C]]'), note('C.md', '[[D]]'), note('D.md', '[[A]]')])
    const options = { outgoingLinks: true, incomingLinks: false, neighborLinks: false }
    expect(getLocalWikiGraph(graph, 'A.md', options).nodes.map(item => item.path)).toEqual(['A.md', 'B.md'])
    expect(getLocalWikiGraph(graph, 'A.md', { ...options, depth: 2 }).edges).toEqual([{ sourcePath: 'A.md', targetPath: 'B.md' }, { sourcePath: 'B.md', targetPath: 'C.md' }])
    expect(getLocalWikiGraph(graph, 'A.md', { ...options, depth: 3 }).nodes).toHaveLength(4)
  })
  it('only permits creating unresolved notes with Wiki references, merging mixed references', () => {
    const markdownOnly = buildWikiGraph([note('Source.md', '[missing](Missing.md)')], { includeUnresolved: true })
    expect(markdownOnly.nodes.find(item => item.path === 'Missing')?.canCreate).toBe(false)
    for (const content of ['[missing](Missing.md) [[Missing]]', '[[Missing]] [missing](Missing.md)']) {
      const graph = buildWikiGraph([note('Source.md', content)], { includeUnresolved: true })
      expect(graph.nodes.find(item => item.path === 'Missing')?.canCreate).toBe(true)
    }
  })
  it('finds literal filename and aliases outside links, code, frontmatter and comments', () => {
    const notes = [note('Target.md', '---\naliases: [別名, Alias]\n---\n'), note('Other/Target.md'), note('Source.md', '---\nname: Target\n---\nTarget Targeting 別名を含む Alias. [[Target]] [Target](Target.md) [Target](https://example.com) ![Target](x.png) `Target` <!-- Target -->\n```\nTarget\n```')]
    const mentions = findUnlinkedMentions('Target.md', notes)
    expect(mentions.map(item => item.text)).toEqual(['Target', '別名', 'Alias'])
    expect(mentions[0]).toMatchObject({ ambiguous: true, candidates: ['Other/Target.md', 'Target.md'] })
    expect(mentions.every(item => notes[2].content.slice(item.range.from, item.range.to) === item.text)).toBe(true)
  })
})
