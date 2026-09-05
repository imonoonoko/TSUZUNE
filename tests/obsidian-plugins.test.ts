import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listObsidianPluginCandidates } from '../src/main/obsidian-plugins'

const temporaryDirectories: string[] = []

async function temporaryDirectory(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  return root
}

async function vaultFixture(): Promise<string> {
  const root = await temporaryDirectory('tsuzune-obsidian-plugins-')
  await mkdir(join(root, '.obsidian', 'plugins'), { recursive: true })
  return root
}

const manifest = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    id: 'demo-plugin',
    name: 'Demo Plugin',
    version: '1.0.0',
    description: 'A demo',
    author: 'TSUZUNE',
    minAppVersion: '1.0.0',
    isDesktopOnly: false,
    ...overrides
  })

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  )
})

describe('Obsidian plugin candidate scanner', () => {
  it('returns no candidates for a missing or null Vault root', async () => {
    await expect(listObsidianPluginCandidates(null)).resolves.toEqual([])
    await expect(listObsidianPluginCandidates(join(tmpdir(), 'does-not-exist'))).resolves.toEqual([])
  })

  it('reads manifests without reading or executing plugin code', async () => {
    const root = await vaultFixture()
    const dir = join(root, '.obsidian', 'plugins', 'demo-plugin')
    await mkdir(dir)
    await writeFile(join(dir, 'manifest.json'), manifest())
    await writeFile(join(dir, 'main.js'), 'throw new Error("must not execute")')
    await writeFile(join(dir, 'styles.css'), 'body { color: red }')
    await expect(listObsidianPluginCandidates(root)).resolves.toEqual([
      expect.objectContaining({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        version: '1.0.0',
        hasMain: true,
        hasStyles: true,
        status: 'detected',
        reason: null
      })
    ])
  })

  it('reports incomplete and invalid manifests with reasons', async () => {
    const root = await vaultFixture()
    const incomplete = join(root, '.obsidian', 'plugins', 'incomplete')
    await mkdir(incomplete)
    await writeFile(join(incomplete, 'manifest.json'), manifest({ id: 'other-id' }))
    const invalid = join(root, '.obsidian', 'plugins', 'invalid')
    await mkdir(invalid)
    await writeFile(join(invalid, 'manifest.json'), '{not-json')
    const result = await listObsidianPluginCandidates(root)
    expect(result.find((item) => item.id === 'other-id')).toMatchObject({ status: 'invalid' })
    expect(result.find((item) => item.id === 'invalid')).toMatchObject({ status: 'invalid' })
    expect(result.filter((item) => item.status !== 'detected').every((item) => item.reason !== null)).toBe(true)
  })

  it('marks missing main and styles as incomplete and caps results at 200', async () => {
    const root = await vaultFixture()
    for (let i = 0; i < 205; i += 1) {
      const id = `plugin-${String(i).padStart(3, '0')}`
      const dir = join(root, '.obsidian', 'plugins', id)
      await mkdir(dir)
      await writeFile(join(dir, 'manifest.json'), manifest({ id }))
    }
    const result = await listObsidianPluginCandidates(root)
    expect(result).toHaveLength(200)
    expect(result[0]).toMatchObject({ hasMain: false, hasStyles: false, status: 'incomplete' })
  })

  it('rejects an oversized manifest before parsing it', async () => {
    const root = await vaultFixture()
    const directory = join(root, '.obsidian', 'plugins', 'oversized')
    await mkdir(directory)
    await writeFile(join(directory, 'manifest.json'), ' '.repeat(64 * 1024 + 1))

    await expect(listObsidianPluginCandidates(root)).resolves.toEqual([
      expect.objectContaining({
        id: 'oversized',
        status: 'invalid',
        reason: 'manifest.jsonが大きすぎます'
      })
    ])
  })

  it('rejects symlinked plugin paths or manifests', async () => {
    const root = await vaultFixture()
    const outside = await temporaryDirectory('tsuzune-plugin-outside-')
    await writeFile(join(outside, 'manifest.json'), manifest({ id: 'linked' }))
    await symlink(outside, join(root, '.obsidian', 'plugins', 'linked-dir'), 'junction')
    const regular = join(root, '.obsidian', 'plugins', 'linked-manifest')
    await mkdir(regular)
    let manifestLinked = true
    try {
      await symlink(join(outside, 'manifest.json'), join(regular, 'manifest.json'), 'file')
    } catch {
      manifestLinked = false
    }
    const result = await listObsidianPluginCandidates(root)
    expect(result.find((item) => item.id === 'linked-dir')).toMatchObject({ status: 'invalid' })
    expect(result.find((item) => item.id === 'linked-manifest')).toMatchObject({
      status: manifestLinked ? 'invalid' : 'incomplete'
    })
  })
})
