import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { WorkspaceSnapshotV1 } from '../src/shared/workspace-state'

const appData = vi.hoisted(() => ({ path: '' }))
vi.mock('electron', () => ({ app: { getPath: () => appData.path } }))

import { VaultService } from '../src/main/vault'
import { WorkspaceService } from '../src/main/workspaces'

const snapshot: WorkspaceSnapshotV1 = {
  tabs: [{ kind: 'note', path: 'Research/仮説.md' }],
  activeIndex: 0,
  noteView: 'preview',
  left: { open: true, view: 'files', query: '' },
  right: { open: false, view: 'outline' }
}

describe('per-Vault workspace persistence', () => {
  let root = ''
  let vaultA = ''
  let vaultB = ''
  let vault: VaultService
  let service: WorkspaceService

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-workspaces-'))
    appData.path = join(root, 'profile')
    vaultA = join(root, 'VaultA')
    vaultB = join(root, 'VaultB')
    const { mkdir } = await import('node:fs/promises')
    await Promise.all([
      mkdir(appData.path),
      mkdir(vaultA),
      mkdir(vaultB)
    ])
    vault = new VaultService()
    await vault.setRootPath(vaultA)
    service = new WorkspaceService(vault, () => new Date('2026-09-06T00:00:00.000Z'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates, replaces, deletes, and no-ops only the current Vault collection', async () => {
    await writeFile(
      join(appData.path, 'settings.json'),
      JSON.stringify({ unknown: { keep: true }, workspaceStateByVault: { opaque: { version: 9 } } }),
      'utf8'
    )
    const initial = await service.getWorkspaces(vaultA.toUpperCase())
    expect(initial.state).toEqual({ version: 1, lastSession: null, named: [] })

    const saved = await service.saveWorkspace(initial.scope, '  調査  ', snapshot, false)
    expect(saved.state.named).toEqual([
      { name: '調査', savedAt: '2026-09-06T00:00:00.000Z', snapshot }
    ])
    const savedBytes = await readFile(join(appData.path, 'settings.json'), 'utf8')

    await service.saveWorkspace(saved.scope, '調査', snapshot, true)
    expect(await readFile(join(appData.path, 'settings.json'), 'utf8')).toBe(savedBytes)
    await expect(service.saveWorkspace(saved.scope, '調査', snapshot, false)).rejects.toMatchObject({
      appError: { code: 'ALREADY_EXISTS' }
    })

    const deleted = await service.deleteWorkspace(saved.scope, '調査')
    expect(deleted.state.named).toEqual([])
    const raw = JSON.parse(await readFile(join(appData.path, 'settings.json'), 'utf8'))
    expect(raw).toMatchObject({
      unknown: { keep: true },
      workspaceStateByVault: { opaque: { version: 9 } }
    })
  })

  it('rejects an A to B to A stale mutation by root revision without writing', async () => {
    const collection = await service.getWorkspaces(vaultA)
    await writeFile(join(appData.path, 'settings.json'), '{"sentinel":true}', 'utf8')
    const before = await readFile(join(appData.path, 'settings.json'), 'utf8')

    await vault.setRootPath(vaultB)
    await vault.setRootPath(vaultA)

    await expect(
      service.saveLastWorkspaceSession(collection.scope, snapshot)
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    await expect(readFile(join(appData.path, 'settings.json'), 'utf8')).resolves.toBe(before)
  })

  it('rejects bad scope, snapshot, and unsupported current-Vault state without writing', async () => {
    const collection = await service.getWorkspaces(vaultA)
    const path = join(appData.path, 'settings.json')
    await writeFile(
      path,
      JSON.stringify({
        workspaceStateByVault: {
          [collection.scope.rootPath.toLocaleLowerCase()]: { version: 2, future: true }
        }
      }),
      'utf8'
    )
    const before = await readFile(path, 'utf8')

    await expect(service.getWorkspaces(vaultA)).rejects.toThrow()
    await expect(
      service.saveWorkspace(collection.scope, 'bad', { ...snapshot, extra: true } as never, false)
    ).rejects.toThrow()
    await expect(readFile(path, 'utf8')).resolves.toBe(before)
  })
})
