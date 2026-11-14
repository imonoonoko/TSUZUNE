// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { CompletionContext, startCompletion } from '@codemirror/autocomplete'
import { undo, redo } from '@codemirror/commands'
import { EditorState, StateEffect } from '@codemirror/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/renderer/components/MarkdownEditor'
import { wikiLinkCompletionSource } from '../src/renderer/wiki-link-completion'
import { resolveWikiLink } from '../src/core/links'
import { compilePathAliases } from '../src/core/path-aliases'
import { resolveHeadingFragment } from '../src/core/note-navigation'
import type { NoteDocument } from '../src/shared/types'

afterEach(cleanup)
const note = (path: string, content = ''): NoteDocument => ({ path, content, name: path.split('/').at(-1)!.slice(0, -3), modifiedAt: 1, size: content.length })
function editor(value: string, props: Partial<React.ComponentProps<typeof MarkdownEditor>> = {}) {
  const result = render(<MarkdownEditor value={value} onChange={vi.fn()} notePath="Entry.md" {...props} />)
  const view = EditorView.findFromDOM(result.container.querySelector('.cm-editor') as HTMLElement)!
  view.focus(); view.dispatch({ selection: { anchor: value.length } })
  return { ...result, view }
}
function complete(view: EditorView, notes: NoteDocument[], pathAliases?: ReturnType<typeof compilePathAliases>) {
  const source = wikiLinkCompletionSource(() => ({ notes, notePath: 'Entry.md', pathAliases }))
  return source(new CompletionContext(view.state, view.state.selection.main.head, true, view))
}
describe('inline Wiki-link completion', () => {
  it('finds YAML aliases and inserts a canonical target with the selected display name', async () => {
    const notes = [note('資料/人工知能.md', '---\naliases: [AI, 日本語 別名]\n---\n本文')]
    const { view } = editor('前文 [[ai')
    const result = await complete(view, notes)
    expect(result!.options[0].label).toBe('AI')
    expect(result!.options[0].detail).toContain('資料/人工知能.md')
    const option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, result!.from, view.state.selection.main.head)
    expect(view.state.doc.toString()).toBe('前文 [[資料/人工知能|AI]]')
    expect(resolveWikiLink('資料/人工知能', notes).resolvedPath).toBe(notes[0].path)
    expect(resolveWikiLink('AI', notes).status).toBe('missing')
    expect(notes[0].content).toBe('---\naliases: [AI, 日本語 別名]\n---\n本文')
  })
  it('deduplicates one note, retains alias collisions and supports scalar, Japanese and spaced aliases', async () => {
    const notes = [note('資料/一.md', '---\naliases: [" 日本語 別名 ", 日本語 別名, 12]\n---'), note('研究/二.md', '---\naliases: 日本語 別名\n---')]
    const { view } = editor('[[別名')
    const result = await complete(view, notes)
    expect(result!.options.map(o => [o.label, o.detail])).toEqual([['日本語 別名', '一 · 資料/一.md'], ['日本語 別名', '二 · 研究/二.md']])
    const option = result!.options[1]
    if (typeof option.apply === 'function') option.apply(view, option, 0, 4)
    expect(view.state.doc.toString()).toBe('[[研究/二|日本語 別名]]')
    expect((await complete(editor('[[12').view, notes))!.options[0].label).toBe('候補がありません')
    expect((await complete(editor('[[').view, notes))!.options.map(o => o.label)).toEqual(['一', '二'])
  })
  it.each([['true', 'tr'], ['false', 'fa'], ['null', 'nu'], ['12', '12'], ['[broken', 'broken'], ['["bad|name", "bad#name", "bad[name", "bad]name", "  "]', 'name'], ['"line\\nname"', 'name']])(
    'does not turn unsupported or unsafe aliases into links: %s', async (aliases, query) => {
      const notes = [note('資料/対象.md', `---\naliases: ${aliases}\n---`)]
      expect((await complete(editor('[[' + query).view, notes))!.options[0].label).toBe('候補がありません')
    })
  it('preserves an explicitly typed display name and text after the link', async () => {
    const notes = [note('資料/対象.md', '---\naliases: AI\n---')]
    const { view } = editor('[[AI|自分の名前]] 続き')
    view.dispatch({ selection: { anchor: 4 } })
    const result = await complete(view, notes), option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, 0, 4)
    expect(view.state.doc.toString()).toBe('[[資料/対象|自分の名前]] 続き')
  })
  it('refreshes aliases with the note snapshot and rejects a previous alias choice', async () => {
    let notes = [note('資料/対象.md', '---\naliases: AI\n---')]
    const { view } = editor('[[AI')
    const source = wikiLinkCompletionSource(() => ({ notes, notePath: 'Entry.md' }))
    const result = await source(new CompletionContext(view.state, 4, true, view))
    notes = [note('資料/対象.md', '---\naliases: 別名\n---')]
    const option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, 0, 4)
    expect(view.state.doc.toString()).toBe('[[AI')
    expect((await source(new CompletionContext(view.state, 4, true, view)))!.options[0].label).toBe('候補がありません')
  })
  it('budgets frontmatter instead of unrelated body text, and reports scan and per-note limits', async () => {
    const notes = Array.from({ length: 20 }, (_, i) => note(`資料/対象${i}.md`, `---\naliases: alias${i}\n---\n${'x'.repeat(70_000)}`))
    expect((await complete(editor('[[alias19').view, notes))!.options[0].label).toBe('alias19')
    const huge = note('巨大.md', `---\naliases: AI\nlong: ${'x'.repeat(70_000)}\n---`)
    const limited = await complete(editor('[[AI').view, [huge])
    expect(limited!.options[0].label).toContain('別名候補を制限')
    const many = note('対象.md', `---\naliases: [${Array.from({ length: 101 }, (_, i) => `alias${i}`).join(', ')}]\n---`)
    expect((await complete(editor('[[alias100').view, [many]))!.options.at(-1)!.label).toContain('別名候補を制限')
    const exact = Array.from({ length: 16 }, (_, i) => {
      const opening = '---\naliases: AI\nlong: ', closing = '\n---\n'
      return note(`対象${i}.md`, opening + 'x'.repeat(62_500 - opening.length - closing.length) + closing)
    })
    const all = await complete(editor('[[AI').view, exact)
    expect(all!.options).toHaveLength(16)
    expect(all!.options.every(o => o.label === 'AI')).toBe(true)
    const beyond = await complete(editor('[[AI').view, [...exact, note('未走査.md', '---\naliases: AI\n---')])
    expect(beyond!.options.at(-1)!.label).toContain('別名候補を制限')
  })
  it('accepts an alias with Tab and keeps completion as one Undo/Redo step', async () => {
    const notes = [note('資料/対象.md', '---\naliases: AI\n---')]
    const { view, container } = editor('[[AI', { notes })
    startCompletion(view)
    await waitFor(() => expect(container.querySelector('[role=option]')?.textContent).toContain('AI'))
    fireEvent.keyDown(view.contentDOM, { key: 'Tab' })
    expect(view.state.doc.toString()).toBe('[[資料/対象|AI]]')
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('[[AI')
    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('[[資料/対象|AI]]')
  })
  it('leaves a literal slash and offers no Wiki completion outside a link', async () => {
    const { view } = editor('/')
    expect(await complete(view, [note('資料.md')])).toBeNull()
    fireEvent.keyDown(view.contentDOM, { key: 'Tab' })
    expect(view.state.doc.toString()).toBe('/')
  })
  it('offers Japanese notes by name/path and inserts a resolving target', async () => {
    const notes = [note('知識/日本語.md')]
    const { view } = editor('前文 [[日本')
    const result = await complete(view, notes)
    expect(result!.options[0].label).toBe('日本語')
    const option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, result!.from, view.state.selection.main.head)
    expect(view.state.doc.toString()).toBe('前文 [[知識/日本語]]')
    expect(resolveWikiLink('知識/日本語', notes).resolvedPath).toBe(notes[0].path)
  })
  it('disambiguates root and nested basenames and matches old-path aliases without inserting a stale alias', async () => {
    const notes = [note('共通.md'), note('研究/共通.md')]
    const aliases = compilePathAliases({ '旧名.md': '研究/共通.md' })
    const { view } = editor('[[共通')
    const result = await complete(view, notes, aliases)
    expect(result!.options.map(o => o.detail)).toEqual(['共通.md', '研究/共通.md'])
    expect(resolveWikiLink('共通', notes).status).toBe('ambiguous')
    expect(resolveWikiLink('共通.md', notes).resolvedPath).toBe('共通.md')
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '[[旧名' }, selection: { anchor: 4 } })
    const aliased = await complete(view, notes, aliases)
    expect(aliased!.options[0].detail).toContain('研究/共通.md')
    const option = aliased!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, 0, 5)
    expect(view.state.doc.toString()).toBe('[[研究/共通]]')
  })
  it('completes unsaved current headings, duplicate headings and existing unique blocks', async () => {
    const body = '# 日本語\n\n## 同じ\n\n## 同じ\n\n本文 ^unique\n\n重複 ^dup\n\n重複 ^dup\n\n````\n偽 ^fake\n````\n\n'
    const notes = [note('Entry.md', '# 古い'), note('研究/対象.md', body)]
    const { view } = editor(body + '[[#')
    const own = await complete(view, notes)
    expect(own!.options.map(o => o.label)).toEqual(['日本語', '同じ', '同じ'])
    const second = own!.options[2]
    if (typeof second.apply === 'function') second.apply(view, second, own!.from, view.state.selection.main.head)
    const target = view.state.doc.toString().match(/\[\[#([^\]]+)\]\]$/)![1]
    expect(resolveHeadingFragment(body, target)?.line).toBe(5)
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '[[研究/対象#^' }, selection: { anchor: 9 } })
    const blocks = await complete(view, notes)
    expect(blocks!.options.map(o => o.label)).toEqual(['^unique'])
    if (typeof blocks!.options[0].apply === 'function') blocks!.options[0].apply(view, blocks!.options[0], blocks!.from, 10)
    expect(view.state.doc.toString()).toBe('[[研究/対象#^unique]]')
  })
  it.each([false, true])('accepts by keyboard and pointer, cancels literally and undoes as one edit (live=%s)', async livePreview => {
    const notes = [note('資料/日本語.md')]
    const { view, container } = editor('前文 ', { notes, livePreview })
    view.dispatch({ changes: { from: 3, insert: '[[日本' }, selection: { anchor: 7 }, userEvent: 'input.type' })
    await waitFor(() => expect(container.querySelector('[role=option]')?.textContent).toContain('資料/日本語.md'))
    fireEvent.keyDown(view.contentDOM, { key: 'Escape' })
    expect(view.state.doc.toString()).toBe('前文 [[日本')
    startCompletion(view)
    await waitFor(() => expect(container.querySelector('[role=option]')).not.toBeNull())
    if (livePreview) fireEvent.mouseDown(container.querySelector('[role=option]')!)
    else fireEvent.keyDown(view.contentDOM, { key: 'Tab' })
    expect(view.state.doc.toString()).toBe('前文 [[資料/日本語]]')
    undo(view); expect(view.state.doc.toString()).toBe('前文 [[日本')
    redo(view); expect(view.state.doc.toString()).toBe('前文 [[資料/日本語]]')
  })
  it('replaces an existing target and preserves its display alias and following text', async () => {
    const { view } = editor('before [[古い名前|表示 日本語]] after')
    view.dispatch({ selection: { anchor: 'before [[古'.length } })
    const result = await complete(view, [note('古い資料.md')])
    const option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, result!.from, view.state.selection.main.head)
    expect(view.state.doc.toString()).toBe('before [[古い資料|表示 日本語]] after')
  })
  it('preserves a separate link after an unfinished target', async () => {
    const { view } = editor('[[日本 and [[Other]]')
    view.dispatch({ selection: { anchor: '[[日本'.length } })
    const result = await complete(view, [note('資料/日本語.md')])
    const option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, result!.from, view.state.selection.main.head)
    expect(view.state.doc.toString()).toBe('[[資料/日本語]] and [[Other]]')
  })
  it.each(['`[[日`', '```\n[[日\n```', '    [[日', '<!-- [[日 -->', '---\nkey: [[日\n---\n', '\uFEFF---\nkey: [[日', '\\[[日'])('does not complete excluded context %s', async text => {
    const { view } = editor(text)
    const pos = text.indexOf('[[日') + 3
    view.dispatch({ selection: { anchor: pos } })
    expect(await complete(view, [note('日本.md')])).toBeNull()
  })
  it('does not offer destinations while editing the display alias', async () => {
    const { view } = editor('[[日|表示')
    expect(await complete(view, [note('日本.md')])).toBeNull()
  })
  it('refreshes suggestions after a note snapshot update and yields Enter to composition', async () => {
    const notes = [note('日本.md')]
    const { view, container, rerender } = editor('[[日', { notes })
    startCompletion(view)
    await waitFor(() => expect(container.querySelector('[role=option]')?.textContent).toContain('日本.md'))
    rerender(<MarkdownEditor value="[[日" onChange={vi.fn()} notePath="Entry.md" notes={[note('日記.md')]} />)
    await waitFor(() => expect(container.querySelector('[role=option]')?.textContent).toContain('日記.md'))
    fireEvent.compositionStart(view.contentDOM)
    fireEvent.keyDown(view.contentDOM, { key: 'Enter', keyCode: 229, isComposing: true })
    expect(view.state.doc.toString()).toBe('[[日')
    await waitFor(() => expect(container.querySelector('[role=option]')).toBeNull())
    fireEvent.compositionEnd(view.contentDOM)
  })
  it('does not offer a duplicate heading slug that resolves to a different literal title', async () => {
    const body = '# A\n\n# A\n\n# a-1\n\n'
    const { view } = editor(body + '[[#')
    const result = await complete(view, [])
    expect(result!.options.map(o => o.label)).toEqual(['A', 'a-1'])
  })
  it.each(['context', 'notes', 'alias', 'source', 'selection', 'readonly', 'ime'])('rejects a stale choice after %s changes', async changed => {
    const notes = [note('日本.md')]
    const { view } = editor('[[日')
    let context = { notes, notePath: 'Entry.md', vaultPath: 'A', pathAliases: undefined as ReturnType<typeof compilePathAliases> | undefined }
    let composing = false
    const source = wikiLinkCompletionSource(() => context, () => composing)
    const result = await source(new CompletionContext(view.state, 3, true, view))
    if (changed === 'context') context = { ...context, vaultPath: 'B' }
    if (changed === 'notes') context = { ...context, notes: [] }
    if (changed === 'alias') context = { ...context, pathAliases: compilePathAliases({}) }
    if (changed === 'source') view.dispatch({ changes: { from: 0, insert: 'changed' } })
    if (changed === 'selection') view.dispatch({ selection: { anchor: 0, head: 3 } })
    if (changed === 'readonly') view.dispatch({ effects: StateEffect.reconfigure.of(EditorState.readOnly.of(true)) })
    if (changed === 'ime') composing = true
    const before = view.state.doc.toString(), option = result!.options[0]
    if (typeof option.apply === 'function') option.apply(view, option, 0, 3)
    expect(view.state.doc.toString()).toBe(before)
  })
  it('distinguishes empty results, truncated candidates and aborted large input', async () => {
    const { view } = editor('[[日')
    expect((await complete(view, []))!.options[0].label).toBe('候補がありません')
    const many = Array.from({ length: 101 }, (_, i) => note(`日本${i}.md`))
    const result = await complete(view, many)
    expect(result!.options).toHaveLength(100)
    expect(result!.options.at(-1)!.label).toContain('候補表示を制限')
    expect((await complete(view, Array(10001).fill(note('日本.md'))))!.options[0].label).toContain('中止')
  })
})

it('finds vault-wide headings and blocks with disambiguating paths and inserts a valid canonical link', async () => {
 const notes=[note('A/One.md','# Shared\n\nBlock ^same'),note('B/Two.md','# Shared\n\nOther ^same')]
 for (const [query,label,target] of [['[[## Shared','Shared','B/Two#Shared'],['[[^^same','^same','B/Two#^same']]) {
  const {view}=editor(query), result=await complete(view,notes)
  expect(result!.options).toHaveLength(2)
  expect(result!.options[1].label).toBe(label)
  expect(result!.options[1].detail).toContain('B/Two.md')
  const option=result!.options[1]; if(typeof option.apply==='function') option.apply(view,option,result!.from,view.state.selection.main.head)
  expect(view.state.doc.toString()).toBe(`[[${target}]]`)
  undo(view); expect(view.state.doc.toString()).toBe(query)
 }
})

it('accepts a Japanese Wiki destination by Tab', async () => {
  const { view, container } = editor('前文 ', { notes: [note('資料/日本語.md')] })
  view.dispatch({ changes: { from: 3, insert: '[[日本' }, selection: { anchor: 7 }, userEvent: 'input.type' })
  await waitFor(() => expect(container.querySelector('[role=option]')?.textContent).toContain('資料/日本語.md'))
  fireEvent.keyDown(view.contentDOM, { key: 'Tab' })
  expect(view.state.doc.toString()).toBe('前文 [[資料/日本語]]')
})
