import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const appData = vi.hoisted(() => ({ path: '' }))
vi.mock('electron', () => ({ app: { getPath: () => appData.path } }))

import { PropertyTypeSettingsService } from '../src/main/property-type-settings'
import { VaultService } from '../src/main/vault'
import { canonicalWorkspaceVaultKey } from '../src/main/workspaces'

describe('Property type settings', () => {
  let rootA: string
  let rootB: string
  let vault: VaultService
  let service: PropertyTypeSettingsService

  beforeEach(async () => {
    appData.path = await mkdtemp(join(tmpdir(), 'tsuzune-property-settings-'))
    rootA = await mkdtemp(join(tmpdir(), 'tsuzune-property-a-'))
    rootB = await mkdtemp(join(tmpdir(), 'tsuzune-property-b-'))
    await writeFile(join(rootA, 'Note.md'), '---\ndue: "2026-09-30"\n---\nBody A')
    await writeFile(join(rootB, 'Note.md'), '---\ndue: "2026-10-01"\n---\nBody B')
    vault = new VaultService()
    service = new PropertyTypeSettingsService(vault)
  })

  afterEach(async () => {
    await Promise.all([appData.path, rootA, rootB].map((path) => rm(path, { recursive: true, force: true })))
  })

  it('isolates each Vault registry, preserves unrelated settings, and never changes Markdown', async () => {
    const settingsPath = join(appData.path, 'settings.json')
    await writeFile(settingsPath, JSON.stringify({ custom: { keep: true }, lastNotePath: 'Note.md' }))
    const contentA = await readFile(join(rootA, 'Note.md'), 'utf8')
    const contentB = await readFile(join(rootB, 'Note.md'), 'utf8')

    await vault.setRootPath(rootA)
    const scopeA = { rootPath: await canonicalWorkspaceVaultKey(rootA), rootRevision: vault.getRootRevision() }
    await service.set(scopeA, { due: 'date', when: 'datetime', label: 'text', count: 'number', done: 'checkbox', tags: 'list' })
    expect(await service.get(scopeA)).toEqual({ due: 'date', when: 'datetime', label: 'text', count: 'number', done: 'checkbox', tags: 'list' })

    await vault.setRootPath(rootB)
    const scopeB = { rootPath: await canonicalWorkspaceVaultKey(rootB), rootRevision: vault.getRootRevision() }
    expect(await service.get(scopeB)).toEqual({})
    await service.set(scopeB, { due: 'text' })
    expect(await service.get(scopeB)).toEqual({ due: 'text' })
    await vault.setRootPath(rootA)
    const reopenedA = { ...scopeA, rootRevision: vault.getRootRevision() }
    expect(await service.get(reopenedA)).toEqual({ due: 'date', when: 'datetime', label: 'text', count: 'number', done: 'checkbox', tags: 'list' })
    expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toMatchObject({ custom: { keep: true }, lastNotePath: 'Note.md' })
    expect(await readFile(join(rootA, 'Note.md'), 'utf8')).toBe(contentA)
    expect(await readFile(join(rootB, 'Note.md'), 'utf8')).toBe(contentB)
  })

  it('rejects invalid names and types before touching existing settings', async () => {
    const settingsPath = join(appData.path, 'settings.json')
    const original = JSON.stringify({ custom: 'keep', propertyTypesByVault: { unrelated: { legacy: 'text' } } })
    await writeFile(settingsPath, original)
    await vault.setRootPath(rootA)
    const scope = { rootPath: await canonicalWorkspaceVaultKey(rootA), rootRevision: vault.getRootRevision() }
    await expect(service.set(scope, { 'bad.name': 'date' })).rejects.toThrow()
    await expect(service.set(scope, { due: 'invalid' } as never)).rejects.toThrow()
    expect(await readFile(settingsPath, 'utf8')).toBe(original)
  })

  it('rejects a stale root revision without changing settings', async () => {
    const settingsPath = join(appData.path, 'settings.json')
    const original = JSON.stringify({ custom: 'keep' })
    await writeFile(settingsPath, original)
    await vault.setRootPath(rootA)
    const stale = { rootPath: await canonicalWorkspaceVaultKey(rootA), rootRevision: vault.getRootRevision() }
    await vault.setRootPath(rootA)
    await expect(service.set(stale, { due: 'date' })).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    await expect(service.get(stale)).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect(await readFile(settingsPath, 'utf8')).toBe(original)
  })
})
