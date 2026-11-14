import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const electron = vi.hoisted(() => ({ appData: '', handlers: new Map<string, (...args: unknown[]) => Promise<any>>() }))
vi.mock('electron', () => ({ app: { getPath: () => electron.appData }, BrowserWindow: class {}, clipboard: {}, dialog: {}, ipcMain: { handle: (name: string, handler: any) => electron.handlers.set(name, handler), on: vi.fn() }, shell: {} }))
import { registerIpc } from '../src/main/ipc'
import { VaultService } from '../src/main/vault'
import { NoteComposerService, parseNoteComposeInput } from '../src/main/note-composer'
import { updateSettings, readSettings } from '../src/main/settings'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'
describe('Note composer IPC', () => {
 let root: string, vault: VaultService
 const contents = { mainFrame: {} }, trusted = { sender: contents, senderFrame: contents.mainFrame }
 beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-composer-ipc-')); electron.appData = join(root, 'profile'); await mkdir(electron.appData)
  vault = new VaultService(); await vault.setRootPath(root); await writeFile(join(root, 'A.md'), 'hello world')
  electron.handlers.clear(); registerIpc(vault, {} as never, { connection: {}, driveSync: {} } as never, {} as never, () => ({ webContents: contents }) as never, () => undefined)
 })
 afterEach(async () => { await rm(root, { recursive: true, force: true }) })
 it('guards trusted sender, malformed input, path traversal and stale scopes', async () => {
  const preview = electron.handlers.get('note:composePreview')!
  const input = { scope: { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }, sourcePath: 'A.md', expectedSourceContent: 'hello world', targetPath: 'B.md', mode: 'extract', targetMode: 'new', placement: 'append', range: { from: 0, to: 5 } }
  expect(await preview({ sender: {}, senderFrame: {} }, input)).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
  for (const invalid of [null, {}, { ...input, scope: { ...input.scope, rootRevision: -1 } }, { ...input, range: { from: '0', to: 5 } }, { ...input, targetPath: '../outside.md' }, ...[null, 'unknown', {}, 1].map(sourceReplacement => ({ ...input, sourceReplacement }))]) expect(await preview(trusted, invalid)).toMatchObject({ ok: false })
  const ready = await preview(trusted, input)
  expect(ready.ok).toBe(true)
  const apply = electron.handlers.get('note:composeApply')!
  expect(await apply(trusted, { input, fingerprint: '0'.repeat(64), changes: [{ after: 'injected' }] })).toMatchObject({ ok: false })
  expect(await apply(trusted, { input, fingerprint: ready.value.fingerprint, changes: [{ after: 'injected' }] })).toMatchObject({ ok: true, value: { path: 'B.md' } })
  expect(await readFile(join(root, 'B.md'), 'utf8')).toBe('hello')
 })

 it('renames a binary attachment and rewrites only its resolved Markdown references', async () => {
  const asset = Buffer.from([0, 255, 11, 128])
  await mkdir(join(root, 'assets'))
  await mkdir(join(root, 'notes'))
  await mkdir(join(root, '01_受信箱'))
  await writeFile(join(root, 'assets', 'scan.pdf'), asset)
  await writeFile(join(root, 'assets', 'taken.pdf'), 'existing attachment')
  const references = '![[assets/scan.pdf#page=2|scan]]\n[PDF](../assets/scan.pdf#page=2)\n`[[assets/scan.pdf]]`\n'
  const referencePath = join(root, 'notes', 'Ref.md')
  const protectedPath = join(root, '01_受信箱', 'Raw.md')
  await writeFile(referencePath, references)
  await writeFile(protectedPath, references)
  electron.handlers.clear()
  registerIpc(vault, {} as never, { connection: {}, driveSync: {
    inspectLocalMoves: vi.fn(async () => ({ tracked: 0, untracked: 1, pendingMoves: {} })),
    recordLocalMoves: vi.fn(async () => undefined),
  } } as never, {} as never, () => ({ webContents: contents }) as never, () => undefined)
  const rename = electron.handlers.get('entry:rename')!
  expect(await rename({ sender: {}, senderFrame: {} }, { path: 'assets/scan.pdf', newName: 'Review.pdf' })).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } })
  expect(await rename(trusted, { path: 'assets/scan.pdf', newName: 'taken.pdf' })).toMatchObject({ ok: false })
  expect(await readFile(referencePath, 'utf8')).toBe(references)
  expect(await readFile(join(root, 'assets', 'scan.pdf'))).toEqual(asset)
  expect(await readFile(join(root, 'assets', 'taken.pdf'), 'utf8')).toBe('existing attachment')
  expect(await rename(trusted, { path: 'assets/scan.pdf', newName: 'Review.pdf' })).toMatchObject({ ok: true, value: { oldPath: 'assets/scan.pdf', path: 'assets/Review.pdf' } })
  expect(await readFile(join(root, 'assets', 'Review.pdf'))).toEqual(asset)
  await expect(readFile(join(root, 'assets', 'scan.pdf'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(referencePath, 'utf8')).toBe('![[assets/Review.pdf#page=2|scan]]\n[PDF](../assets/Review.pdf#page=2)\n`[[assets/scan.pdf]]`\n')
  expect(await readFile(protectedPath, 'utf8')).toBe(references)
 })
 it('surfaces recovery conflict on openLast while retaining the configured Vault', async () => {
  const input = { scope: { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }, sourcePath: 'A.md', expectedSourceContent: 'hello world', targetPath: 'B.md', mode: 'extract' as const, targetMode: 'new' as const, placement: 'append' as const, range: { from: 0, to: 5 } }
  const service = new NoteComposerService(vault, () => [], async () => { throw new Error('interrupt') })
  const preview = await service.preview(input)
  await expect(service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow('RECOVERY_REQUIRED')
  await writeFile(join(root, 'A.md'), 'external')
  await updateSettings({ lastVaultPath: root })
  const stop = vi.fn(async () => undefined)
  registerIpc(vault, { stop, start: vi.fn() } as never, { connection: {}, driveSync: {} } as never, {} as never, () => ({ webContents: contents }) as never, () => undefined, undefined, { recover: async () => undefined } as never)
  const result = await electron.handlers.get('vault:openLast')!(trusted)
  expect(result).toMatchObject({ ok: false })
  expect((await readSettings()).lastVaultPath).toBe(root)
  expect(vault.getRootPath()).toBe(root)
 })
 it('validates template timestamps, mode and configured list at the IPC boundary', async () => {
  const input = { scope: { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }, sourcePath: 'A.md', expectedSourceContent: 'hello world', targetPath: 'B.md', mode: 'extract' as const, targetMode: 'new' as const, placement: 'append' as const, range: { from: 0, to: 5 }, targetTemplate: { path: 'Templates/T.md', now: '2026-10-27T01:02:03.000Z' } }
  for (const now of ['bad', '2026-02-30T01:02:03.000Z', '2026-10-27', '2026-10-27T01:02:03+09:00']) expect(() => parseNoteComposeInput({ ...input, targetTemplate: { ...input.targetTemplate, now } })).toThrow()
  for (const change of [{ mode: 'merge' }, { targetMode: 'existing' }, { targetTemplate: null }, { targetTemplate: { path: 1, now: input.targetTemplate.now } }]) expect(() => parseNoteComposeInput({ ...input, ...change })).toThrow()
  await mkdir(join(root, 'Templates')); await writeFile(join(root, 'Templates/T.md'), '# {{title}}\n\n{{content}}')
  await updateSettings({ templateDirectory: 'Templates', showBuiltInTemplates: false })
  const preview = electron.handlers.get('note:composePreview')!
  expect(await preview(trusted, input)).toMatchObject({ ok: true, value: { changes: [{ after: '# B\n\nhello' }, { after: '[[B]] world' }] } })
  expect(await preview(trusted, { ...input, targetTemplate: { ...input.targetTemplate, path: 'Templates/アイデアメモ.md' } })).toMatchObject({ ok: false })
  expect(await preview(trusted, { ...input, sourceReplacement: 'none', targetTemplate: undefined })).toMatchObject({ ok: true, value: { changes: [{ after: 'hello' }, { after: ' world' }] } })
 })

})
