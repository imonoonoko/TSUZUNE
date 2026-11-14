import { mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'

let root: string
let vault: VaultService
async function createNote(input: { directory: string; name: string; content: string }) {
  const created = await vault.createNote(input)
  return vault.readNote(created.path)
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-note-history-'))
  vault = new VaultService()
  await vault.setRootPath(root)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('keeps the previous exact Markdown across a restart without exposing it as a normal note', async () => {
  const content = '\uFEFF---\r\ntitle: 元の版\r\n---\r\n# 本文\r\n'
  const note = await createNote({ directory: '', name: '研究', content })
  await vault.saveNoteWithHistory({ path: note.path, content: '# 編集後', expectedModifiedAt: note.modifiedAt, expectedContent: content })
  const restarted = new VaultService()
  await restarted.setRootPath(root)
  const versions = await restarted.listNoteVersions(note.path)
  expect(versions).toHaveLength(1)
  expect(await restarted.readNoteVersion(note.path, versions[0].id)).toMatchObject({ content })
  expect((await restarted.scan()).notes.map(item => item.path)).toEqual(['研究.md'])
  const rawPaths = await readdir(join(root, '.tsuzune/note-history'), { recursive: true })
  const raw = rawPaths.find(path => String(path).endsWith('.md'))!
  expect(await readFile(join(root, '.tsuzune/note-history', raw), 'utf8')).toBe(content)
})

it('restores a chosen version only against the viewed current note and keeps a way back', async () => {
  const note = await createNote({ directory: '', name: '戻す', content: '最初' })
  await vault.saveNoteWithHistory({ path: note.path, content: '現在', expectedModifiedAt: note.modifiedAt, expectedContent: '最初' })
  const view = await vault.getNoteHistory(note.path, root)
  const restored = await vault.restoreNoteVersion({ scope: view.scope, path: note.path, id: view.versions[0].id,
    expectedContent: view.content, expectedModifiedAt: view.modifiedAt })
  expect(restored.content).toBe('最初')
  const next = await vault.getNoteHistory(note.path, root)
  const bodies = await Promise.all(next.versions.map(version => vault.readNoteVersion(note.path, version.id)))
  expect(bodies.map(item => item.content)).toContain('現在')
  const previousId = next.versions[bodies.findIndex(item => item.content === '現在')].id
  expect((await vault.restoreNoteVersion({ scope: next.scope, path: note.path, id: previousId,
    expectedContent: next.content, expectedModifiedAt: next.modifiedAt })).content).toBe('現在')
})

it('does not create versions for no-op saves or the existing history-free save API', async () => {
  const note = await createNote({ directory: '', name: '同一', content: '同じ本文' })
  await vault.saveNoteWithHistory({ path: note.path, content: '同じ本文', expectedModifiedAt: note.modifiedAt, expectedContent: '同じ本文' })
  expect(await vault.listNoteVersions(note.path)).toEqual([])
  await vault.saveNote({ path: note.path, content: 'MCP等の更新', expectedModifiedAt: note.modifiedAt })
  expect(await vault.listNoteVersions(note.path)).toEqual([])
})

it('rejects a restore after an external same-size same-time edit, preserving both sides', async () => {
  const note = await createNote({ directory: '', name: '競合', content: 'older' })
  await vault.saveNoteWithHistory({ path: note.path, content: 'local', expectedModifiedAt: note.modifiedAt })
  const view = await vault.getNoteHistory(note.path, root)
  await writeFile(join(root, note.path), 'other')
  await utimes(join(root, note.path), new Date(view.modifiedAt), new Date(view.modifiedAt))
  await expect(vault.restoreNoteVersion({ scope: view.scope, path: note.path, id: view.versions[0].id,
    expectedContent: view.content, expectedModifiedAt: view.modifiedAt })).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  expect((await vault.readNote(note.path)).content).toBe('other')
  expect(await vault.readNoteVersion(note.path, view.versions[0].id)).toEqual({ content: 'older' })
})

it('rejects stale Vault scope even when reopening the same root', async () => {
  const note = await createNote({ directory: '', name: 'Scope', content: 'first' })
  await vault.saveNoteWithHistory({ path: note.path, content: 'second', expectedModifiedAt: note.modifiedAt })
  const view = await vault.getNoteHistory(note.path, root)
  await vault.setRootPath(root)
  await expect(vault.restoreNoteVersion({ scope: view.scope, path: note.path, id: view.versions[0].id,
    expectedContent: view.content, expectedModifiedAt: view.modifiedAt })).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  expect((await vault.readNote(note.path)).content).toBe('second')
})

it.each(['40_情報源/source.md', '50_履歴/audit.md', '.tsuzune/private.md', '../outside.md'])('does not expose protected or unsafe history: %s', async path => {
  await expect(vault.listNoteVersions(path)).rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
})

it('rejects a modified snapshot and never overwrites the current note with it', async () => {
  const note = await createNote({ directory: '', name: '破損', content: 'before' })
  await vault.saveNoteWithHistory({ path: note.path, content: 'after', expectedModifiedAt: note.modifiedAt })
  const view = await vault.getNoteHistory(note.path, root)
  const paths = await readdir(join(root, '.tsuzune/note-history'), { recursive: true })
  const file = paths.find(path => String(path).endsWith(view.versions[0].id))!
  await writeFile(join(root, '.tsuzune/note-history', file), 'corrupt')
  await expect(vault.restoreNoteVersion({ scope: view.scope, path: note.path, id: view.versions[0].id,
    expectedContent: view.content, expectedModifiedAt: view.modifiedAt })).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  expect((await vault.readNote(note.path)).content).toBe('after')
})

it('refuses snapshot storage through a junction and keeps the original note', async () => {
  const note = await createNote({ directory: '', name: '安全', content: 'original' })
  const outside = await mkdtemp(join(tmpdir(), 'tsuzune-history-outside-'))
  try {
    await mkdir(join(root, '.tsuzune'), { recursive: true })
    await symlink(outside, join(root, '.tsuzune/note-history'), 'junction')
    await expect(vault.saveNoteWithHistory({ path: note.path, content: 'replacement', expectedModifiedAt: note.modifiedAt }))
      .rejects.toMatchObject({ appError: { code: 'INVALID_PATH' } })
    expect((await vault.readNote(note.path)).content).toBe('original')
    expect(await readdir(outside)).toEqual([])
  } finally { await rm(outside, { recursive: true, force: true }) }
})

it('keeps the previous version under the original path after a rename', async () => {
  const note = await createNote({ directory: '', name: '旧題', content: 'before' })
  await vault.saveNoteWithHistory({ path: note.path, content: 'after', expectedModifiedAt: note.modifiedAt })
  const renamed = await vault.renameEntry({ path: note.path, newName: '新題' })
  expect((await vault.getNoteHistory(renamed.path, root)).versions).toEqual([])
  const originalVersions = await vault.listNoteVersions(note.path)
  expect(originalVersions).toHaveLength(1)
  expect(await vault.readNoteVersion(note.path, originalVersions[0].id)).toEqual({ content: 'before' })
})

it('rejects corrupt snapshot bytes that decode to the same replacement character', async () => {
  const note = await createNote({ directory: '', name: 'UTF-8', content: '\uFFFD' })
  await vault.saveNoteWithHistory({ path: note.path, content: 'after', expectedModifiedAt: note.modifiedAt })
  const view = await vault.getNoteHistory(note.path, root)
  const paths = await readdir(join(root, '.tsuzune/note-history'), { recursive: true })
  const file = paths.find(path => String(path).endsWith(view.versions[0].id))!
  await writeFile(join(root, '.tsuzune/note-history', file), Buffer.from([0xff]))
  await expect(vault.getNoteVersion({ scope: view.scope, path: note.path, id: view.versions[0].id }))
    .rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
})
