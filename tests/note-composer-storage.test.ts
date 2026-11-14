import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'
import { NoteComposerService } from '../src/main/note-composer'

vi.mock('node:fs/promises', async importOriginal => {
 const fs = await importOriginal<typeof import('node:fs/promises')>()
 return { ...fs, open: async (...args: Parameters<typeof fs.open>) => {
  const handle = await fs.open(...args)
  const stage = process.env.TSUZUNE_COMPOSE_CRASH_STAGE
  const path = String(args[0])
  if (args[1] === 'wx' && (stage === 'journal-staging' && path.includes('pending-note-compose.json') ||
      stage === 'target-staging' && basename(path).startsWith('.tsuzune-composer-'))) {
   const write = handle.writeFile.bind(handle)
   handle.writeFile = async () => {
    await write('{"version":', 'utf8')
    await handle.sync()
    process.kill(process.pid, 'SIGKILL')
   }
  }
  return handle
 } }
})

async function terminateApply(root: string, input: Parameters<NoteComposerService['preview']>[0], stage: string): Promise<number | null> {
 return new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(process.cwd(), 'node_modules/vitest/vitest.mjs'), 'run', 'tests/note-composer-storage.test.ts', '--maxWorkers=1'], { cwd: process.cwd(), env: { ...process.env, TSUZUNE_COMPOSE_CRASH_ROOT: root, TSUZUNE_COMPOSE_CRASH_INPUT: JSON.stringify(input), TSUZUNE_COMPOSE_CRASH_STAGE: stage }, stdio: 'ignore' })
  child.once('error', reject); child.once('close', resolve)
 })
}
async function fixture() {
 const root = await mkdtemp(join(tmpdir(), 'tsuzune-composer-'))
 await writeFile(join(root, 'A.md'), 'first\nselected\nlast\n')
 const vault = new VaultService(); await vault.setRootPath(root)
 const service = new NoteComposerService(vault, () => [])
 const input = { scope: { rootPath: await canonicalWorkspaceVaultKey(root), rootRevision: vault.getRootRevision() }, mode: 'extract' as const, sourcePath: 'A.md', expectedSourceContent: 'first\nselected\nlast\n', targetPath: 'B.md', targetMode: 'new' as const, placement: 'append' as const, range: { from: 6, to: 15 } }
 return { root, vault, service, input }
}
if (process.env.TSUZUNE_COMPOSE_CRASH_ROOT) {
 it('process crash fixture', async () => {
  const root = process.env.TSUZUNE_COMPOSE_CRASH_ROOT!
  const vault = new VaultService(); await vault.setRootPath(root)
  const input = JSON.parse(process.env.TSUZUNE_COMPOSE_CRASH_INPUT!)
  input.scope.rootRevision = vault.getRootRevision()
  const service = new NoteComposerService(vault, () => [], async path => { if (path === process.env.TSUZUNE_COMPOSE_CRASH_STAGE) process.exit(73) })
  const preview = await service.preview(input); await service.apply({ input, fingerprint: preview.fingerprint })
 })
} else {
describe('journaled note composition', () => {
 it.each(['new', 'existing'] as const)('saves no source replacement with a %s target and rejects a post-preview collision', async targetMode => {
  const f = await fixture()
  if (targetMode === 'existing') await writeFile(join(f.root, 'B.md'), 'target\n')
  const input = { ...f.input, sourceReplacement: 'none' as const, targetMode }
  const preview = await f.service.preview(input)
  await writeFile(join(f.root, 'B.md'), 'external collision')
  await expect(f.service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('external collision')
  if (targetMode === 'existing') await writeFile(join(f.root, 'B.md'), 'target\n')
  else await rm(join(f.root, 'B.md'))
  const fresh = await f.service.preview(input)
  await f.service.apply({ input, fingerprint: fresh.fingerprint })
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\nlast\n')
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe(targetMode === 'existing' ? 'target\n\nselected\n' : 'selected\n')
 })
 it('binds the trusted template and options, refusing changes or removal after preview', async () => {
  const f = await fixture(); await mkdir(join(f.root, 'Templates')); await writeFile(join(f.root, 'Templates/T.md'), '# {{title}}\n\n{{content}}')
  let options = { directory: 'Templates', includeBuiltIns: true }
  const service = new NoteComposerService(f.vault, () => [], undefined, () => options)
  const input = { ...f.input, targetTemplate: { path: 'Templates/T.md', now: '2026-10-27T01:02:03.000Z' }, sourceReplacement: 'none' as const }
  const preview = await service.preview(input)
  expect(preview.changes[0].after).toBe('# B\n\nselected\n')
  options = { ...options, includeBuiltIns: false }
  await expect(service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow()
  options = { ...options, includeBuiltIns: true }
  await writeFile(join(f.root, 'Templates/T.md'), 'different\n\n{{content}}')
  await expect(service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow()
  await rm(join(f.root, 'Templates/T.md'))
  await expect(service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
  await expect(readFile(join(f.root, 'B.md'))).rejects.toMatchObject({ code: 'ENOENT' })
 })
 it('uses enabled builtins and rejects paths outside the configured template list or invalid UTF8', async () => {
  const f = await fixture()
  const service = new NoteComposerService(f.vault, () => [], undefined, () => ({ directory: 'Templates', includeBuiltIns: true }))
  const input = { ...f.input, targetTemplate: { path: 'Templates/アイデアメモ.md', now: '2026-10-27T01:02:03.000Z' } }
  expect((await service.preview(input)).changes[0].after).toContain('# B')
  await expect(service.preview({ ...input, targetTemplate: { ...input.targetTemplate, path: 'A.md' } })).rejects.toThrow()
  await mkdir(join(f.root, 'Templates')); await writeFile(join(f.root, 'Templates/T.md'), Buffer.from([255, 10]))
  await expect(service.preview({ ...input, targetTemplate: { ...input.targetTemplate, path: 'Templates/T.md' } })).rejects.toThrow('UTF-8')
 })
 it.each(['new', 'existing'] as const)('previews and saves an embed into a %s target, refusing a changed choice', async targetMode => {
  const f = await fixture()
  if (targetMode === 'existing') await writeFile(join(f.root, 'B.md'), 'target\n')
  const input = { ...f.input, sourceReplacement: 'embed' as const, targetMode }
  const preview = await f.service.preview(input)
  expect(preview.changes.find(change => change.path === 'A.md')?.after).toBe('first\n![[B]]\nlast\n')
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
  await expect(f.service.apply({ input: { ...input, sourceReplacement: 'link' }, fingerprint: preview.fingerprint })).rejects.toThrow()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
  if (targetMode === 'new') await expect(readFile(join(f.root, 'B.md'))).rejects.toMatchObject({ code: 'ENOENT' })
  else expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('target\n')
  await f.service.apply({ input, fingerprint: preview.fingerprint })
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\n![[B]]\nlast\n')
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe(targetMode === 'new' ? 'selected\n' : 'target\n\nselected\n')
 })
 it('rebuilds preview and refuses stale destination without changing source', async () => {
  const f = await fixture(); const preview = await f.service.preview(f.input)
  await writeFile(join(f.root, 'B.md'), 'external')
  await expect(f.service.apply({ input: f.input, fingerprint: preview.fingerprint })).rejects.toThrow()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
 })
 it('applies extraction without losing selected bytes', async () => {
  const f = await fixture(); const preview = await f.service.preview(f.input)
  await f.service.apply({ input: f.input, fingerprint: preview.fingerprint })
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('selected\n')
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\n[[B]]\nlast\n')
 })
})

describe('interrupted batches', () => {
 it('recovers a template target-first write with no source replacement, preserving external edits', async () => {
  const f = await fixture(); await mkdir(join(f.root, 'Templates')); await writeFile(join(f.root, 'Templates/T.md'), '{{content}}\n\nend')
  const service = new NoteComposerService(f.vault, () => [], async () => { throw new Error('interrupt') }, () => ({ directory: 'Templates' }))
  const input = { ...f.input, sourceReplacement: 'none' as const, targetTemplate: { path: 'Templates/T.md', now: '2026-10-27T01:02:03.000Z' } }
  const preview = await service.preview(input)
  await expect(service.apply({ input, fingerprint: preview.fingerprint })).rejects.toThrow('RECOVERY_REQUIRED')
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('selected\n\nend')
  await writeFile(join(f.root, 'Templates/T.md'), 'edited later')
  await writeFile(join(f.root, 'A.md'), 'external')
  await expect(f.service.recover()).rejects.toThrow('外部変更')
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('external')
  await writeFile(join(f.root, 'A.md'), f.input.expectedSourceContent)
  await f.service.recover()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\nlast\n')
  expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('selected\n\nend')
 })
 it('resumes a durable partial batch after reopening and preserves external conflicts', async () => {
  const f = await fixture(); let once = true
  const service = new NoteComposerService(f.vault, () => [], async () => { if (once) { once = false; throw new Error('interruption') } })
  const preview = await service.preview(f.input)
  await expect(service.apply({ input: f.input, fingerprint: preview.fingerprint })).rejects.toThrow('RECOVERY_REQUIRED')
  await writeFile(join(f.root, 'A.md'), 'external bytes')
  await expect(new NoteComposerService(f.vault, () => []).recover()).rejects.toThrow('外部変更')
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('external bytes')
  expect(await readFile(join(f.root, '.tsuzune/pending-note-compose.json'), 'utf8')).toContain('selected')
  await writeFile(join(f.root, 'A.md'), f.input.expectedSourceContent)
  const reopened = new VaultService(); await reopened.setRootPath(f.root)
  await new NoteComposerService(reopened, () => []).recover()
  expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\n[[B]]\nlast\n')
 })
 it('merges into existing note, redirects references and keeps exact original bytes in trash', async () => {
  const f = await fixture(); await writeFile(join(f.root, 'B.md'), 'target\n'); await writeFile(join(f.root, 'C.md'), '[[A|alias]]')
  const input = { ...f.input, mode: 'merge' as const, targetMode: 'existing' as const }
  const preview = await f.service.preview(input)
  const result = await f.service.apply({ input, fingerprint: preview.fingerprint })
  expect(await readFile(join(f.root, result.trashedPath!), 'utf8')).toBe(input.expectedSourceContent)
  expect(await readFile(join(f.root, 'C.md'), 'utf8')).toBe('[[B|alias]]')
 })
 it('rejects protected incoming referrers and invalid UTF8 before writes', async () => {
  const f = await fixture(); await f.vault.createDirectory({ parent: '', name: '40_情報源' }); await writeFile(join(f.root, 'B.md'), 'target')
  await writeFile(join(f.root, '40_情報源/ref.md'), '[[A]]')
  await expect(f.service.preview({ ...f.input, mode: 'merge', targetMode: 'existing' })).rejects.toThrow('保護領域')
  await rm(join(f.root, '40_情報源/ref.md'))
  await writeFile(join(f.root, 'A.md'), Buffer.from([255, 10]))
  await expect(f.service.preview({ ...f.input, targetPath: 'C.md', expectedSourceContent: '\ufffd\n', range: { from: 0, to: 2 } })).rejects.toThrow('UTF-8')
 })
})

 describe('real process termination', () => {
  it('reopens and applies again after an interruption while staging the journal', async () => {
   const f = await fixture()
   try {
    expect(await terminateApply(f.root, f.input, 'journal-staging')).not.toBe(0)
    const directory = join(f.root, '.tsuzune')
    const [partialJournal] = (await readdir(directory)).filter(name => name.startsWith('pending-note-compose.json'))
    expect(await readFile(join(directory, partialJournal), 'utf8')).toBe('{"version":')
    expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
    await expect(readFile(join(f.root, 'B.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    const reopened = new VaultService(); await reopened.setRootPath(f.root)
    const service = new NoteComposerService(reopened, () => [])
    await service.recover()
    const input = { ...f.input, scope: { ...f.input.scope, rootRevision: reopened.getRootRevision() } }
    const preview = await service.preview(input)
    await service.apply({ input, fingerprint: preview.fingerprint })
    expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('selected\n')
   } finally {
    await rm(f.root, { recursive: true, force: true })
   }
  }, 15_000)
  // A nested Vitest process needs startup time alongside the full production suite.
  it('replays the published journal after an interruption while staging the target', async () => {
   const f = await fixture()
   try {
    expect(await terminateApply(f.root, f.input, 'target-staging')).not.toBe(0)
    const [partialTarget] = (await readdir(f.root)).filter(name => name.startsWith('.tsuzune-composer-'))
    expect(await readFile(join(f.root, partialTarget), 'utf8')).toBe('{"version":')
    await expect(readFile(join(f.root, 'B.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe(f.input.expectedSourceContent)
    const reopened = new VaultService(); await reopened.setRootPath(f.root)
    await new NoteComposerService(reopened, () => []).recover()
    expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe('selected\n')
    expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\n[[B]]\nlast\n')
   } finally {
    await rm(f.root, { recursive: true, force: true })
   }
  }, 15_000)
  it.each(['new-target', 'source-updated', 'source-trashed'])('recovers %s without duplicated content', async stage => {
   const f = await fixture()
   const input = stage === 'source-trashed' ? { ...f.input, mode: 'merge' as const, targetMode: 'existing' as const } : f.input
   if (stage === 'source-trashed') await writeFile(join(f.root, 'B.md'), 'target\n')
   const code = await terminateApply(f.root, input, stage === 'new-target' ? 'B.md' : 'A.md')
   expect(code).not.toBe(0)
   const journal = JSON.parse(await readFile(join(f.root, '.tsuzune/pending-note-compose.json'), 'utf8'))
   const reopened = new VaultService(); await reopened.setRootPath(f.root)
   await new NoteComposerService(reopened, () => []).recover()
   expect(await readFile(join(f.root, 'B.md'), 'utf8')).toBe(stage === 'source-trashed' ? 'target\n\n' + input.expectedSourceContent : 'selected\n')
   if (stage === 'source-trashed') expect(await readFile(join(f.root, `.trash/onoko-op-${journal.id}/A.md`), 'utf8')).toBe(input.expectedSourceContent)
   else expect(await readFile(join(f.root, 'A.md'), 'utf8')).toBe('first\n[[B]]\nlast\n')
  }, 15_000)
 })
}
