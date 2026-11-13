import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { VaultError, VaultService } from '../src/main/vault'

const roots: string[] = []

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-create-base-'))
  roots.push(root)
  await mkdir(join(root, 'views'))
  const vault = new VaultService()
  await vault.setRootPath(root)
  return { root, vault }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('VaultService.createBase', () => {
  it('creates complete Base contents and returns the stored document', async () => {
    const { root, vault } = await setup()
    const content = '{"filters":[],"views":[]}'

    await expect(vault.createBase('views/Projects.base', content)).resolves.toMatchObject({
      path: 'views/Projects.base', content
    })
    expect(await readFile(join(root, 'views', 'Projects.base'), 'utf8')).toBe(content)
  })

  it('preserves an existing file when the requested path collides', async () => {
    const { root, vault } = await setup()
    const existing = 'keep this file'
    await writeFile(join(root, 'views', 'Projects.base'), existing)

    await expect(vault.createBase('views/Projects.base', 'new content')).rejects.toMatchObject({
      appError: { code: 'ALREADY_EXISTS' }
    })
    expect(await readFile(join(root, 'views', 'Projects.base'), 'utf8')).toBe(existing)
  })

  it('rejects unsafe paths, history paths, and missing parent folders', async () => {
    const { vault } = await setup()
    for (const path of ['../Outside.base', '.hidden/Private.base', '50_履歴/Old.base', 'missing/New.base']) {
      await expect(vault.createBase(path, '{}')).rejects.toBeInstanceOf(VaultError)
    }
  })
})
