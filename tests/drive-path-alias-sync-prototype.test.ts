import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyDrivePathAliasSyncPrototype,
  previewDrivePathAliasSyncPrototype,
  type DrivePathAliasRemote,
  type RemotePathAliasObject
} from '../src/cli/drive-path-alias-sync-prototype'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  )
})

class MemoryAliasRemote implements DrivePathAliasRemote {
  readonly objects: RemotePathAliasObject[] = []
  creates = 0
  updates = 0

  async list(): Promise<RemotePathAliasObject[]> {
    return this.objects.map((object) => ({ ...object, bytes: Buffer.from(object.bytes) }))
  }

  async create(input: {
    vaultId: string
    parentId: string
    bytes: Buffer
  }): Promise<RemotePathAliasObject> {
    this.creates += 1
    const object: RemotePathAliasObject = {
      id: 'alias-1',
      vaultId: input.vaultId,
      role: 'pathAliases',
      parentId: input.parentId,
      version: '1',
      bytes: Buffer.from(input.bytes)
    }
    this.objects.push(object)
    return { ...object, bytes: Buffer.from(object.bytes) }
  }

  async update(input: {
    fileId: string
    vaultId: string
    parentId: string
    expectedVersion: string
    bytes: Buffer
  }): Promise<RemotePathAliasObject> {
    this.updates += 1
    const object = this.objects.find((candidate) => candidate.id === input.fileId)
    if (!object || object.version !== input.expectedVersion) {
      throw new Error('REMOTE_VERSION_MISMATCH')
    }
    object.version = String(Number(object.version) + 1)
    object.bytes = Buffer.from(input.bytes)
    return { ...object, bytes: Buffer.from(object.bytes) }
  }
}

async function fixture(): Promise<{
  vaultRoot: string
  ledgerPath: string
  sidecarPath: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-o2-p4a-'))
  temporaryDirectories.push(root)
  const vaultRoot = join(root, 'vault')
  const sidecarPath = join(vaultRoot, '.tsuzune', 'path-aliases.json')
  await mkdir(join(vaultRoot, '.tsuzune'), { recursive: true })
  return {
    vaultRoot,
    sidecarPath,
    ledgerPath: join(root, 'path-alias-ledger.json')
  }
}

describe('O2-P4A Drive Path Alias sync prototype', () => {
  it('uploads one local-only sidecar with exact bytes and checkpoints a clean ledger', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{\r\n  "Old.md": "New.md"\r\n}\r\n', 'utf8')
    await writeFile(paths.sidecarPath, bytes)

    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })

    expect(preview.action).toBe('upload')
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview
    })

    expect(remote.objects).toHaveLength(1)
    expect(remote.objects[0]?.bytes.equals(bytes)).toBe(true)
    expect(JSON.parse(await readFile(paths.ledgerPath, 'utf8'))).toMatchObject({
      kind: 'o2-p4a-path-alias-ledger',
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      fileId: 'alias-1'
    })
  })

  it('downloads one remote-only sidecar with exact bytes and checkpoints it', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{\n  "Legacy.md": "Current.md"\n}\n', 'utf8')
    remote.objects.push({
      id: 'alias-remote',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '7',
      bytes
    })

    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })

    expect(preview.action).toBe('download')
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview
    })

    expect((await readFile(paths.sidecarPath)).equals(bytes)).toBe(true)
    expect(JSON.parse(await readFile(paths.ledgerPath, 'utf8'))).toMatchObject({
      fileId: 'alias-remote',
      remoteVersion: '7'
    })
  })

  it('does not transfer when local and remote exact bytes already match', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, bytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes
    })

    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    expect(preview.action).toBe('none')

    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview
    })

    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(0)
    expect(JSON.parse(await readFile(paths.ledgerPath, 'utf8'))).toMatchObject({
      fileId: 'alias-existing',
      remoteVersion: '3'
    })
  })

  it('updates the owned remote when only the checkpointed local sidecar changed', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const oldBytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, oldBytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes: oldBytes
    })
    const baseline = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview: baseline
    })

    const newBytes = Buffer.from('{\r\n  "Old.md": "Latest.md"\r\n}\r\n', 'utf8')
    await writeFile(paths.sidecarPath, newBytes)
    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })

    expect(preview.action).toBe('upload')
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview
    })

    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(1)
    expect(remote.objects[0]?.bytes.equals(newBytes)).toBe(true)
    expect(JSON.parse(await readFile(paths.ledgerPath, 'utf8'))).toMatchObject({
      fileId: 'alias-existing',
      remoteVersion: '4'
    })
  })

  it('downloads exact bytes when only the checkpointed remote sidecar changed', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const oldBytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, oldBytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes: oldBytes
    })
    const baseline = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview: baseline
    })

    const newBytes = Buffer.from('{\r\n  "Old.md": "Remote.md"\r\n}\r\n', 'utf8')
    remote.objects[0]!.bytes = newBytes
    remote.objects[0]!.version = '4'
    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })

    expect(preview.action).toBe('download')
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview
    })

    expect((await readFile(paths.sidecarPath)).equals(newBytes)).toBe(true)
    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(0)
  })

  it('reports a conflict and makes no write when divergent sides have no checkpoint', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const localBytes = Buffer.from('{"Old.md":"Local.md"}\n', 'utf8')
    const remoteBytes = Buffer.from('{"Old.md":"Remote.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, localBytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes: remoteBytes
    })
    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })

    expect(preview.action).toBe('conflict')
    await expect(
      applyDrivePathAliasSyncPrototype({
        ...paths,
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote,
        preview
      })
    ).rejects.toThrow('競合')
    expect((await readFile(paths.sidecarPath)).equals(localBytes)).toBe(true)
    expect(remote.objects[0]?.bytes.equals(remoteBytes)).toBe(true)
    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(0)
  })

  it('revalidates the preview fingerprint before any apply write', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const originalBytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, originalBytes)
    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    await writeFile(paths.sidecarPath, '{"Old.md":"Changed.md"}\n', 'utf8')

    await expect(
      applyDrivePathAliasSyncPrototype({
        ...paths,
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote,
        preview
      })
    ).rejects.toThrow('changed after preview')
    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(0)
  })

  it('fails closed when more than one remote object has the owned identity', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, bytes)
    remote.objects.push(
      {
        id: 'alias-1',
        vaultId: 'vault-1',
        role: 'pathAliases',
        parentId: 'root-1',
        version: '1',
        bytes
      },
      {
        id: 'alias-2',
        vaultId: 'vault-1',
        role: 'pathAliases',
        parentId: 'root-1',
        version: '1',
        bytes
      }
    )

    await expect(
      previewDrivePathAliasSyncPrototype({
        ...paths,
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote
      })
    ).rejects.toThrow('複数')
  })

  it.each([
    ['invalid JSON', Buffer.from('{', 'utf8')],
    ['case collision', Buffer.from('{"A.md":"B.md","a.md":"C.md"}', 'utf8')],
    ['alias cycle', Buffer.from('{"A.md":"B.md","B.md":"A.md"}', 'utf8')]
  ])('rejects malformed local sidecar content: %s', async (_label, bytes) => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    await writeFile(paths.sidecarPath, bytes)

    await expect(
      previewDrivePathAliasSyncPrototype({
        ...paths,
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote
      })
    ).rejects.toThrow()
    expect(remote.creates).toBe(0)
    expect(remote.updates).toBe(0)
  })

  it('restores the local preimage when ledger persistence fails after download', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{"Old.md":"Remote.md"}\n', 'utf8')
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes
    })
    const blockedParent = join(paths.ledgerPath, 'blocked')
    await writeFile(paths.ledgerPath, 'not-a-directory', 'utf8')
    const options = {
      ...paths,
      ledgerPath: blockedParent,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    }
    const preview = await previewDrivePathAliasSyncPrototype(options)

    await expect(
      applyDrivePathAliasSyncPrototype({ ...options, preview })
    ).rejects.toThrow()
    await expect(readFile(paths.sidecarPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects sidecar or ledger paths outside their frozen ownership boundaries', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const outsideSidecar = join(paths.vaultRoot, 'path-aliases.json')
    await writeFile(outsideSidecar, '{"Old.md":"New.md"}\n', 'utf8')

    await expect(
      previewDrivePathAliasSyncPrototype({
        ...paths,
        sidecarPath: outsideSidecar,
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote
      })
    ).rejects.toThrow('sidecar path')

    await writeFile(paths.sidecarPath, '{"Old.md":"New.md"}\n', 'utf8')
    await expect(
      previewDrivePathAliasSyncPrototype({
        ...paths,
        ledgerPath: join(paths.vaultRoot, '.tsuzune', 'ledger.json'),
        vaultId: 'vault-1',
        rootFolderId: 'root-1',
        remote
      })
    ).rejects.toThrow('ledger path')
  })

  it('does not treat a remote version drift as an unchanged checkpoint side', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, bytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes
    })
    const baseline = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview: baseline
    })
    await writeFile(paths.sidecarPath, '{"Old.md":"Local.md"}\n', 'utf8')
    remote.objects[0]!.version = '4'

    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    expect(preview.action).toBe('conflict')
  })

  it('reports a conflict when both sides changed after the clean checkpoint', async () => {
    const paths = await fixture()
    const remote = new MemoryAliasRemote()
    const bytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, bytes)
    remote.objects.push({
      id: 'alias-existing',
      vaultId: 'vault-1',
      role: 'pathAliases',
      parentId: 'root-1',
      version: '3',
      bytes
    })
    const baseline = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    await applyDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote,
      preview: baseline
    })
    await writeFile(paths.sidecarPath, '{"Old.md":"Local.md"}\n', 'utf8')
    remote.objects[0]!.bytes = Buffer.from('{"Old.md":"Remote.md"}\n', 'utf8')
    remote.objects[0]!.version = '4'

    const preview = await previewDrivePathAliasSyncPrototype({
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    })
    expect(preview.action).toBe('conflict')
  })

  it('does not checkpoint a remote mutation response with changed bytes', async () => {
    const paths = await fixture()
    const localBytes = Buffer.from('{"Old.md":"New.md"}\n', 'utf8')
    await writeFile(paths.sidecarPath, localBytes)
    const remote: DrivePathAliasRemote = {
      async list() {
        return []
      },
      async create(input) {
        return {
          id: 'alias-1',
          vaultId: input.vaultId,
          role: 'pathAliases',
          parentId: input.parentId,
          version: '1',
          bytes: Buffer.from('{"Old.md":"Wrong.md"}\n', 'utf8')
        }
      },
      async update() {
        throw new Error('UNEXPECTED_UPDATE')
      }
    }
    const options = {
      ...paths,
      vaultId: 'vault-1',
      rootFolderId: 'root-1',
      remote
    }
    const preview = await previewDrivePathAliasSyncPrototype(options)

    await expect(
      applyDrivePathAliasSyncPrototype({ ...options, preview })
    ).rejects.toThrow('bytes')
    await expect(readFile(paths.ledgerPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
