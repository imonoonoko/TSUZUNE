import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VaultService } from '../src/main/vault'
import { serializeCanvas } from '../src/core/canvas'
import type { CanvasData } from '../src/shared/canvas'

let root: string
let vault: VaultService
let scope: { rootPath: string; rootRevision: number }
const empty: CanvasData = { nodes: [], edges: [] }

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-canvas-test-'))
  await mkdir(join(root, 'boards'))
  vault = new VaultService()
  await vault.setRootPath(root)
  scope = { rootPath: vault.getRootPath()!, rootRevision: vault.getRootRevision() }
})

afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('Vault Canvas documents', () => {
  it('creates without overwriting and lists local Canvas files', async () => {
    const content = serializeCanvas(empty)
    await vault.createCanvas({ scope, path: 'boards/ideas.canvas', content })
    await expect(vault.createCanvas({ scope, path: 'boards/ideas.canvas', content: serializeCanvas({ nodes: [], edges: [] }) }))
      .rejects.toMatchObject({ appError: { code: 'ALREADY_EXISTS' } })
    expect(await readFile(join(root, 'boards/ideas.canvas'), 'utf8')).toBe(content)
    expect(await vault.listCanvases(root)).toEqual(['boards/ideas.canvas'])
  })

  it('rejects stale revisions, protected paths, and a mismatched Vault scope', async () => {
    const original = serializeCanvas(empty)
    const created = await vault.createCanvas({ scope, path: 'boards/ideas.canvas', content: original })
    const changed: CanvasData = { nodes: [{ id: 'text', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'edited' }], edges: [] }
    const saved = await vault.saveCanvas({ scope, path: created.path, expectedRevision: created.revision, content: serializeCanvas(changed) })
    await expect(vault.saveCanvas({ scope, path: created.path, expectedRevision: created.revision, content: original }))
      .rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect((await vault.readCanvas(created.path, root)).revision).toBe(saved.revision)
    await expect(vault.createCanvas({ scope, path: '50_履歴/protected.canvas', content: original })).rejects.toThrow()
    await expect(vault.readCanvas(created.path, join(root, 'other-vault'))).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  })

  it('rejects Canvas file references that traverse a symbolic link', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'tsuzune-canvas-outside-'))
    try {
      await writeFile(join(outside, 'secret.md'), 'private')
      const { symlink } = await import('node:fs/promises')
      await symlink(outside, join(root, 'linked'), 'junction')
      const content = serializeCanvas({ nodes: [{ id: 'file', type: 'file', x: 0, y: 0, width: 100, height: 100, file: 'linked/secret.md' }], edges: [] })
      await expect(vault.createCanvas({ scope, path: 'boards/unsafe.canvas', content })).rejects.toThrow()
    } finally { await rm(outside, { recursive: true, force: true }) }
  })
})
