import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyClassificationMigrationPrototype,
  PROTOTYPE_MUTATION_STAGES,
  rollbackClassificationMigrationPrototype
} from '../src/cli/classification-migration-prototype'
import {
  parseClassificationMigrationPlan,
  type ClassificationMigrationPlan
} from '../src/cli/classification-migration-preview'

const sourcePath = '30_知識/旧ノート.md'
const destinationPath = '30_知識/ソフトウェア開発/旧ノート.md'
const auditPath = '40_情報源/分類監査.md'
const activePath = '10_プロジェクト/利用中.md'
const historyPath = '50_履歴/過去記録.md'
const otherPath = '30_知識/別ノート.md'
const sidecarPath = '.tsuzune/path-aliases.json'
const ownershipPath = '.tsuzune/o2-p3-owned.json'

interface PrototypeFixture {
  root: string
  vaultRoot: string
  preimagesDirectory: string
  ownershipToken: string
  plan: ClassificationMigrationPlan
  contents: Record<string, string | Buffer>
}

interface TreeSnapshot {
  files: Array<{ path: string; bytesHex: string }>
  directories: string[]
  sidecarBytesHex: string | null
}

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function byteLength(value: string | Buffer): number {
  return Buffer.isBuffer(value) ? value.length : Buffer.byteLength(value, 'utf8')
}

async function writeVaultFile(
  vaultRoot: string,
  path: string,
  content: string | Buffer
): Promise<void> {
  const absolutePath = join(vaultRoot, ...path.split('/'))
  await mkdir(join(absolutePath, '..'), { recursive: true })
  await writeFile(absolutePath, content)
}

async function pathExists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false
  )
}

async function listPreimages(directory: string): Promise<string[]> {
  return (await readdir(directory)).sort()
}

async function snapshotTree(vaultRoot: string): Promise<TreeSnapshot> {
  const files: Array<{ path: string; bytesHex: string }> = []
  const directories: string[] = []
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      const info = await lstat(absolutePath)
      if (entry.isDirectory()) {
        directories.push(relative(vaultRoot, absolutePath).replaceAll('\\', '/'))
        await walk(absolutePath)
      } else if (entry.isFile()) {
        files.push({
          path: relative(vaultRoot, absolutePath).replaceAll('\\', '/'),
          bytesHex: (await readFile(absolutePath)).toString('hex')
        })
      }
    }
  }
  await walk(vaultRoot)
  files.sort((left, right) => left.path.localeCompare(right.path))
  directories.sort((left, right) => left.localeCompare(right))
  const sidecar = files.find((file) => file.path === sidecarPath)
  return { files, directories, sidecarBytesHex: sidecar ? sidecar.bytesHex : null }
}

async function createPrototypeFixture(options: {
  existingSidecar?: boolean
  destinationCollision?: boolean
  ownershipToken?: string
} = {}): Promise<PrototypeFixture> {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-o2-p3-'))
  temporaryRoots.push(root)
  const vaultRoot = join(root, 'anonymous-vault')
  const preimagesDirectory = join(root, 'preimages')
  await Promise.all([
    mkdir(vaultRoot, { recursive: true }),
    mkdir(preimagesDirectory, { recursive: true })
  ])
  const ownershipToken = options.ownershipToken ?? randomUUID()

  const contents: Record<string, string | Buffer> = {
    [sourcePath]: '# 旧ノート\n\n本文\n',
    [auditPath]: '# 分類監査\n\n[[30_知識/旧ノート]]\n',
    [historyPath]: '# 過去記録\n\n[[30_知識/旧ノート]]\n',
    [activePath]: [
      '# 利用中',
      '',
      '[[30_知識/旧ノート]]',
      '[[30_知識/旧ノート#判断|表示名]]',
      '[[30_知識/旧ノート.md]]',
      '[[旧ノート]]',
      '[[30_知識/別ノート]]'
    ].join('\n'),
    [otherPath]: '# 別ノート\n\n独立したノートです。\n',
    [ownershipPath]: `${JSON.stringify({ token: ownershipToken })}\n`,
    'attachments/fixture.bin': Buffer.from([0, 1, 2, 253, 254, 255])
  }
  if (options.existingSidecar) {
    contents[sidecarPath] = '{"過去/旧パス.md":"30_知識/別ノート.md"}\n'
  }
  if (options.destinationCollision) {
    contents['30_知識/ソフトウェア開発/旧ノート.MD'] = '# 衝突\n'
  }
  for (const [path, content] of Object.entries(contents)) {
    await writeVaultFile(vaultRoot, path, content)
  }

  const sourceContent = contents[sourcePath]
  const auditContent = contents[auditPath]
  const planValue = {
    schemaVersion: 1,
    planId: 'anonymous-o2-p3',
    analysisAsOf: '2026-08-13T00:00:00.000Z',
    auditSource: {
      path: auditPath,
      expectedSizeBytes: byteLength(auditContent),
      expectedSha256: sha256(auditContent).toLowerCase()
    },
    moves: [
      {
        sourcePath,
        destinationPath,
        expectedSizeBytes: byteLength(sourceContent),
        expectedSha256: sha256(sourceContent).toLowerCase(),
        expectedReferences: {
          active: 4,
          source: 1,
          history: 1,
          mcpBacklinks: 3
        }
      }
    ]
  }
  const plan = parseClassificationMigrationPlan(planValue)
  return { root, vaultRoot, preimagesDirectory, ownershipToken, plan, contents }
}

function applyOptions(
  fixture: PrototypeFixture,
  overrides: Partial<{
    vaultRoot: string
    ownershipToken: string
    preimagesDirectory: string
    failAfter: (typeof PROTOTYPE_MUTATION_STAGES)[number]
  }> = {}
) {
  return {
    vaultRoot: overrides.vaultRoot ?? fixture.vaultRoot,
    plan: fixture.plan,
    ownershipToken: overrides.ownershipToken ?? fixture.ownershipToken,
    preimagesDirectory: overrides.preimagesDirectory ?? fixture.preimagesDirectory,
    ...(overrides.failAfter ? { failAfter: overrides.failAfter } : {})
  }
}

describe('classification migration test-only apply/rollback prototype', () => {
  it('applies a validated plan and restores the exact whole tree on explicit rollback', async () => {
    const fixture = await createPrototypeFixture()
    const before = await snapshotTree(fixture.vaultRoot)

    const result = await applyClassificationMigrationPrototype(applyOptions(fixture))
    expect(result.status).toBe('applied')
    expect(result.failpoint).toBeNull()
    expect(result.remainingBlockers).toEqual(['DRIVE_PATH_ALIAS_UNSUPPORTED'])
    // The only new file is the alias sidecar; rewrite/move bytes are verified below.
    expect(result.appliedFingerprint.fileCount).toBe(result.beforeFingerprint.fileCount + 1)
    expect(result.appliedFingerprint.filesSha256).not.toBe(result.beforeFingerprint.filesSha256)
    const rollbackPacket = JSON.parse(await readFile(result.rollbackPacketPath, 'utf8'))
    expect(rollbackPacket.createdDirectories).toEqual(['30_知識/ソフトウェア開発'])

    // Applied state: source absent, destination present with identical bytes.
    expect(await pathExists(join(fixture.vaultRoot, ...sourcePath.split('/')))).toBe(false)
    const destinationContent = await readFile(
      join(fixture.vaultRoot, ...destinationPath.split('/')),
      'utf8'
    )
    expect(destinationContent).toBe(fixture.contents[sourcePath] as string)

    // Immutable source/history notes remain byte-identical.
    expect(await readFile(join(fixture.vaultRoot, ...auditPath.split('/')), 'utf8')).toBe(
      fixture.contents[auditPath] as string
    )
    expect(await readFile(join(fixture.vaultRoot, ...historyPath.split('/')), 'utf8')).toBe(
      fixture.contents[historyPath] as string
    )

    // Exactly one alias sidecar is created with the planned mapping.
    const sidecarAfterApply = JSON.parse(
      await readFile(join(fixture.vaultRoot, ...sidecarPath.split('/')), 'utf8')
    )
    expect(sidecarAfterApply).toEqual({ [sourcePath]: destinationPath })

    // Attachments and the ownership marker are untouched.
    expect(
      (await readFile(join(fixture.vaultRoot, 'attachments', 'fixture.bin'))).toString('hex')
    ).toBe(Buffer.from([0, 1, 2, 253, 254, 255]).toString('hex'))
    expect(await pathExists(join(fixture.vaultRoot, ...ownershipPath.split('/')))).toBe(true)

    const outcome = await rollbackClassificationMigrationPrototype({
      vaultRoot: fixture.vaultRoot,
      rollbackPacketPath: result.rollbackPacketPath,
      ownershipToken: fixture.ownershipToken
    })
    expect(outcome).toEqual({
      status: 'restored',
      failpoint: null,
      restoredFingerprint: result.beforeFingerprint,
      unrestoredPaths: []
    })
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)

    const second = await rollbackClassificationMigrationPrototype({
      vaultRoot: fixture.vaultRoot,
      rollbackPacketPath: result.rollbackPacketPath,
      ownershipToken: fixture.ownershipToken
    })
    expect(second).toEqual({
      status: 'already-restored',
      failpoint: null,
      restoredFingerprint: result.beforeFingerprint,
      unrestoredPaths: []
    })
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
  })

  it('rewrites only resolved path-qualified links, preserving fragments, aliases, and unrelated text', async () => {
    const fixture = await createPrototypeFixture()
    const result = await applyClassificationMigrationPrototype(applyOptions(fixture))
    expect(result.status).toBe('applied')
    const active = await readFile(join(fixture.vaultRoot, ...activePath.split('/')), 'utf8')
    expect(active).toBe(
      [
        '# 利用中',
        '',
        '[[30_知識/ソフトウェア開発/旧ノート]]',
        '[[30_知識/ソフトウェア開発/旧ノート#判断|表示名]]',
        '[[30_知識/ソフトウェア開発/旧ノート.md]]',
        '[[旧ノート]]',
        '[[30_知識/別ノート]]'
      ].join('\n')
    )
  })

  it('preserves existing alias sidecar entries and restores the exact original sidecar bytes', async () => {
    const fixture = await createPrototypeFixture({ existingSidecar: true })
    const absoluteSidecarPath = join(fixture.vaultRoot, ...sidecarPath.split('/'))
    const originalSidecarBytes = await readFile(absoluteSidecarPath)
    const before = await snapshotTree(fixture.vaultRoot)

    const result = await applyClassificationMigrationPrototype(applyOptions(fixture))
    expect(result.status).toBe('applied')
    const sidecarAfterApply = JSON.parse(await readFile(absoluteSidecarPath, 'utf8'))
    expect(sidecarAfterApply).toEqual({
      '過去/旧パス.md': '30_知識/別ノート.md',
      [sourcePath]: destinationPath
    })

    const outcome = await rollbackClassificationMigrationPrototype({
      vaultRoot: fixture.vaultRoot,
      rollbackPacketPath: result.rollbackPacketPath,
      ownershipToken: fixture.ownershipToken
    })
    expect(outcome).toMatchObject({ status: 'restored', failpoint: null, unrestoredPaths: [] })
    expect(await readFile(absoluteSidecarPath)).toEqual(originalSidecarBytes)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
  })

  it('fails before any write when a planned source digest has drifted', async () => {
    const fixture = await createPrototypeFixture()
    await writeVaultFile(fixture.vaultRoot, sourcePath, '# 変更済み\n')
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(applyOptions(fixture))
    ).rejects.toThrow(/Migration source changed/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
    expect(await listPreimages(fixture.preimagesDirectory)).toEqual([])
  })

  it('fails before any write on a case-insensitive destination collision', async () => {
    const fixture = await createPrototypeFixture({ destinationCollision: true })
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(applyOptions(fixture))
    ).rejects.toThrow(/Migration destination already exists/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
    expect(await listPreimages(fixture.preimagesDirectory)).toEqual([])
  })

  it('fails before any write when the ownership token does not match', async () => {
    const fixture = await createPrototypeFixture()
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(applyOptions(fixture, { ownershipToken: 'wrong' }))
    ).rejects.toThrow(/ownership token does not match/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
    expect(await listPreimages(fixture.preimagesDirectory)).toEqual([])
  })

  it('fails before any write when the ownership marker is missing', async () => {
    const fixture = await createPrototypeFixture()
    await rm(join(fixture.vaultRoot, ...ownershipPath.split('/')))
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(applyOptions(fixture))
    ).rejects.toThrow(/not marked as owned/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
    expect(await listPreimages(fixture.preimagesDirectory)).toEqual([])
  })

  it('rejects rollback when the ownership token does not match', async () => {
    const fixture = await createPrototypeFixture()
    const result = await applyClassificationMigrationPrototype(applyOptions(fixture))
    const applied = await snapshotTree(fixture.vaultRoot)

    await expect(
      rollbackClassificationMigrationPrototype({
        vaultRoot: fixture.vaultRoot,
        rollbackPacketPath: result.rollbackPacketPath,
        ownershipToken: 'wrong'
      })
    ).rejects.toThrow(/ownership token does not match/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(applied)
  })

  it('rejects unsafe paths in a rollback packet before any Vault write', async () => {
    const fixture = await createPrototypeFixture()
    const result = await applyClassificationMigrationPrototype(applyOptions(fixture))
    const applied = await snapshotTree(fixture.vaultRoot)
    const packet = JSON.parse(await readFile(result.rollbackPacketPath, 'utf8'))
    packet.inverseMoves[0].to = '../outside.md'
    await writeFile(result.rollbackPacketPath, `${JSON.stringify(packet, null, 2)}\n`)

    await expect(
      rollbackClassificationMigrationPrototype({
        vaultRoot: fixture.vaultRoot,
        rollbackPacketPath: result.rollbackPacketPath,
        ownershipToken: fixture.ownershipToken
      })
    ).rejects.toThrow(/safe normalized relative path/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(applied)
  })

  it('fails before any write when the preimages directory is inside the Vault', async () => {
    const fixture = await createPrototypeFixture()
    const insidePreimages = join(fixture.vaultRoot, '.preimages')
    await mkdir(insidePreimages, { recursive: true })
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(
        applyOptions(fixture, { preimagesDirectory: insidePreimages })
      )
    ).rejects.toThrow(/must be outside the Vault/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
  })

  it('rejects a symlinked Vault root before any write', async () => {
    const fixture = await createPrototypeFixture()
    const linkRoot = join(fixture.root, 'linked-vault')
    let created = false
    try {
      await symlink(fixture.vaultRoot, linkRoot, 'dir')
      created = true
    } catch {
      // Windows directory symlinks may require developer mode; skip when unsupported.
    }
    if (!created) return
    const before = await snapshotTree(fixture.vaultRoot)
    await expect(
      applyClassificationMigrationPrototype(applyOptions(fixture, { vaultRoot: linkRoot }))
    ).rejects.toThrow(/must be a real directory/)
    expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
  })

  for (const stage of PROTOTYPE_MUTATION_STAGES) {
    it(`automatically restores the exact tree after an injected ${stage} failure`, async () => {
      const fixture = await createPrototypeFixture()
      const before = await snapshotTree(fixture.vaultRoot)
      await expect(
        applyClassificationMigrationPrototype(applyOptions(fixture, { failAfter: stage }))
      ).rejects.toMatchObject({
        name: 'PrototypeFailpointError',
        stage,
        rollbackOutcome: {
          status: 'restored',
          failpoint: stage,
          unrestoredPaths: []
        }
      })
      expect(await snapshotTree(fixture.vaultRoot)).toEqual(before)
      expect(await listPreimages(fixture.preimagesDirectory).then((names) => names.length)).toBe(1)
    })
  }
})
