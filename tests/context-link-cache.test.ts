import { mkdir, mkdtemp, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { commonmarkLanguage } from '@codemirror/lang-markdown'
import { VaultMcpService } from '../src/mcp/service'
import { NoteLinkCache } from '../src/core/note-link-cache'

let root: string
let service: VaultMcpService
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime('2026-11-09T02:00:00.000Z')
  root = await mkdtemp(join(tmpdir(), 'tsuzune-context-reuse-'))
  await writeFile(join(root, 'Home.md'), '# Home\n\n[[Target]]')
  await writeFile(join(root, 'Target.md'), '# Target\n\n本文')
  for (let i = 0; i < 32; i++) await writeFile(join(root, `Back-${i}.md`), `# Back ${i}\n\n[[Home]]`)
  service = new VaultMcpService({ explicitVaultPath: root, settingsPath: join(root, 'settings.json') })
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await rm(root, { recursive: true, force: true })
})

it('reuses unchanged link parsing across context requests without changing the result', async () => {
  const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
  const cold = await service.buildContext('Home.md')
  const coldCalls = parse.mock.calls.length
  parse.mockClear()
  const warm = await service.buildContext('Home.md')
  expect(warm).toEqual(cold)
  expect(parse.mock.calls.length).toBeLessThan(coldCalls / 2)
  expect(await readFile(join(root, 'Home.md'), 'utf8')).toBe('# Home\n\n[[Target]]')
})

function fresh(): VaultMcpService {
  return new VaultMcpService({ explicitVaultPath: root, settingsPath: join(root, 'settings.json') })
}

it('uses edited links and source revisions even when mtime and byte length are unchanged', async () => {
  const before = await service.buildContext('Home.md')
  const back = join(root, 'Back-0.md')
  const previous = await stat(back)
  await writeFile(back, '# Back 0\n\n[[Gone]]')
  await utimes(back, previous.atime, previous.mtime)
  const after = await service.buildContext('Home.md')
  expect(after).toEqual(await fresh().buildContext('Home.md'))
  expect(after.included.some(source => source.path === 'Back-0.md')).toBe(false)
  expect(before.included.some(source => source.path === 'Back-0.md')).toBe(true)

  await writeFile(join(root, 'Target.md'), '# Target\n\n更新後の本文')
  const edited = await service.buildContext('Home.md')
  expect(edited).toEqual(await fresh().buildContext('Home.md'))
  expect(edited.markdown).toContain('更新後の本文')
  expect(edited.included.find(source => source.path === 'Target.md')?.revision)
    .not.toBe(before.included.find(source => source.path === 'Target.md')?.revision)
})

it('resolves cached syntax against current aliases and added or deleted targets', async () => {
  await mkdir(join(root, '.tsuzune'))
  const aliases = join(root, '.tsuzune/path-aliases.json')
  await writeFile(join(root, 'Home.md'), '# Home\n\n[[Old]]')
  await writeFile(aliases, JSON.stringify({ 'Old.md': 'Target.md' }))
  await service.buildContext('Home.md')
  await writeFile(join(root, 'Next.md'), '# Next\n\n次のノート')
  await writeFile(aliases, JSON.stringify({ 'Old.md': 'Next.md' }))
  expect(await service.buildContext('Home.md')).toEqual(await fresh().buildContext('Home.md'))
  expect((await service.buildContext('Home.md')).included.map(source => source.path)).toContain('Next.md')
  await writeFile(join(root, 'Old.md'), '# Old\n\n実在するノートを優先')
  expect((await service.buildContext('Home.md')).included.map(source => source.path)).toContain('Old.md')
  await rm(join(root, 'Old.md'))
  expect(await service.buildContext('Home.md')).toEqual(await fresh().buildContext('Home.md'))
})

it('uses the new source directory for relative links after a rename', async () => {
  await mkdir(join(root, 'A'))
  await mkdir(join(root, 'B/Deep'), { recursive: true })
  await writeFile(join(root, 'A/Source.md'), '# Source\n\n[相対リンク](../Target.md)')
  await writeFile(join(root, 'B/Target.md'), '# Target\n\n移動先のリンク先')
  expect((await service.buildContext('A/Source.md')).included.map(source => source.path)).toContain('Target.md')
  await rename(join(root, 'A/Source.md'), join(root, 'B/Deep/Source.md'))
  const after = await service.buildContext('B/Deep/Source.md')
  expect(after).toEqual(await fresh().buildContext('B/Deep/Source.md'))
  expect(after.included.map(source => source.path)).toContain('B/Target.md')
  expect(after.included.map(source => source.path)).not.toContain('Target.md')
})

it('refreshes multi-seed contexts after an edit and shares extraction with single-seed contexts', async () => {
  await service.buildContext('Home.md')
  const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
  await service.buildContextSet(['Home.md', 'Target.md'])
  const warmCalls = parse.mock.calls.length
  parse.mockClear()
  await fresh().buildContextSet(['Home.md', 'Target.md'])
  expect(warmCalls).toBeLessThan(parse.mock.calls.length / 2)
  await writeFile(join(root, 'Home.md'), '# Home\n\n[[Back-4]]')
  expect(await service.buildContextSet(['Home.md', 'Target.md']))
    .toEqual(await fresh().buildContextSet(['Home.md', 'Target.md']))
})

it('uses current ignore settings and clears reuse when the selected Vault changes', async () => {
  const second = await mkdtemp(join(tmpdir(), 'tsuzune-context-vault-'))
  try {
    const settingsPath = join(root, 'settings.json')
    const settings = (lastVaultPath: string, userIgnoreFilters: string[] = []) =>
      writeFile(settingsPath, JSON.stringify({ lastVaultPath, userIgnoreFilters }))
    const switching = new VaultMcpService({ settingsPath })
    await settings(root)
    await switching.buildContext('Home.md')
    await settings(root, ['Target.md'])
    const ignored = await switching.buildContext('Home.md')
    expect(ignored.included.map(source => source.path)).not.toContain('Target.md')
    expect(ignored).toEqual(await new VaultMcpService({ settingsPath }).buildContext('Home.md'))
    await writeFile(join(second, 'Home.md'), '# Home\n\n[[Target]]')
    await writeFile(join(second, 'Target.md'), '# Target\n\n別Vaultの本文')
    await settings(second)
    const switched = await switching.buildContext('Home.md')
    expect(switched).toEqual(await new VaultMcpService({ settingsPath }).buildContext('Home.md'))
    expect(switched.markdown).toContain('別Vaultの本文')
  } finally {
    await rm(second, { recursive: true, force: true })
  }
})

it('does not let caller mutation change retained syntax, and reparses evicted entries', () => {
  const cache = new NoteLinkCache()
  const links = cache.extract('[[Home]]', 'Source.md')
  links[0].target = 'Wrong'
  links[0].range.from = 999
  expect(cache.extract('[[Home]]', 'Source.md')[0]).toMatchObject({ target: 'Home', range: { from: 0 } })
  for (let i = 0; i < 2048; i++) cache.extract('[[Home]]', `Note-${i}.md`)
  const parse = vi.spyOn(commonmarkLanguage.parser, 'parse')
  expect(cache.extract('[[Home]]', 'Source.md')[0].target).toBe('Home')
  expect(parse).toHaveBeenCalledTimes(1)
})
