import { createHash } from 'node:crypto'
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  analyzeClassificationMigration,
  parseClassificationMigrationPlan,
  runClassificationMigrationPreview,
  type ClassificationMigrationPlan
} from '../src/cli/classification-migration-preview'
import type { NoteDocument } from '../src/shared/types'

const sourcePath = '30_知識/旧ノート.md'
const destinationPath = '30_知識/ソフトウェア開発/旧ノート.md'
const auditPath = '40_情報源/分類監査.md'
const activePath = '10_プロジェクト/利用中.md'
const historyPath = '50_履歴/過去記録.md'

interface AnonymousFixture {
  root: string
  vaultRoot: string
  outputDirectory: string
  planPath: string
  planValue: unknown
  contents: Record<string, string | Buffer>
}

interface TreeFileSnapshot {
  path: string
  bytesHex: string
  modifiedAtMs: number
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

async function createAnonymousFixture(options: {
  expectedActiveReferences?: number
  destinationCollision?: boolean
  aliasTerminalMissing?: boolean
} = {}): Promise<AnonymousFixture> {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-o2-p2-'))
  temporaryRoots.push(root)
  const vaultRoot = join(root, 'anonymous-vault')
  const outputDirectory = join(root, 'outputs')
  const planPath = join(root, 'migration-plan.json')
  await Promise.all([
    mkdir(vaultRoot, { recursive: true }),
    mkdir(outputDirectory, { recursive: true })
  ])

  const contents: Record<string, string | Buffer> = {
    [sourcePath]: [
      '# 旧ノート',
      '',
      'PRIVATE_BODY_SENTINEL',
      `[[${activePath.slice(0, -3)}]]`
    ].join('\n'),
    [auditPath]: `# 分類監査\n\n[[${sourcePath.slice(0, -3)}]]`,
    [activePath]: [
      '# 利用中',
      '',
      `[[${sourcePath.slice(0, -3)}]]`,
      `[[${sourcePath.slice(0, -3)}#判断|表示名]]`
    ].join('\n'),
    [historyPath]: `# 過去記録\n\n[[${sourcePath.slice(0, -3)}]]`,
    '.tsuzune/fixture-marker.json': '{"fixture":true}\n',
    'attachments/fixture.bin': Buffer.from([0, 1, 2, 253, 254, 255])
  }
  if (options.destinationCollision) {
    contents['30_知識/ソフトウェア開発/旧ノート.MD'] = '# 衝突'
  }
  if (options.aliasTerminalMissing) {
    contents['.tsuzune/path-aliases.json'] = JSON.stringify({
      '過去/旧パス.md': '存在しない/終端.md'
    })
  }
  for (const [path, content] of Object.entries(contents)) {
    await writeVaultFile(vaultRoot, path, content)
  }

  const sourceContent = contents[sourcePath]
  const auditContent = contents[auditPath]
  const planValue = {
    schemaVersion: 1,
    planId: 'anonymous-o2-p2',
    analysisAsOf: '2026-08-10T00:00:00.000Z',
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
          active: options.expectedActiveReferences ?? 2,
          source: 1,
          history: 1,
          mcpBacklinks: 3
        }
      }
    ]
  }
  await writeFile(planPath, `${JSON.stringify(planValue, null, 2)}\n`, 'utf8')
  return { root, vaultRoot, outputDirectory, planPath, planValue, contents }
}

function fixtureNotes(contents: Record<string, string | Buffer>): NoteDocument[] {
  return Object.entries(contents)
    .filter(
      ([path, content]) =>
        path.toLocaleLowerCase().endsWith('.md') &&
        !path.split('/').some((part) => part.startsWith('.')) &&
        typeof content === 'string'
    )
    .map(([path, content]) => ({
      path,
      name: basename(path, '.md'),
      content: content as string,
      modifiedAt: 0,
      createdAt: null,
      size: Buffer.byteLength(content as string, 'utf8')
    }))
}

async function snapshotFiles(root: string): Promise<TreeFileSnapshot[]> {
  const files: TreeFileSnapshot[] = []
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      const info = await lstat(absolutePath)
      if (entry.isDirectory()) {
        await walk(absolutePath)
      } else if (entry.isFile()) {
        files.push({
          path: relative(root, absolutePath).replaceAll('\\', '/'),
          bytesHex: (await readFile(absolutePath)).toString('hex'),
          modifiedAtMs: info.mtimeMs
        })
      }
    }
  }
  await walk(root)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

async function expectPreviewFailure(
  fixture: AnonymousFixture,
  outputPath: string,
  message: string | RegExp
): Promise<void> {
  const before = await snapshotFiles(fixture.vaultRoot)
  await expect(
    runClassificationMigrationPreview({
      vaultRoot: fixture.vaultRoot,
      planPath: fixture.planPath,
      outputPath
    })
  ).rejects.toThrow(message)
  expect(await pathExists(outputPath)).toBe(false)
  expect(await snapshotFiles(fixture.vaultRoot)).toEqual(before)
}

describe('classification migration dry-run preview', () => {
  it('projects references, Graph, Context, Wiki links, and MCP IDs without writing the Vault', async () => {
    const fixture = await createAnonymousFixture()
    const parsedPlan = parseClassificationMigrationPlan(
      fixture.planValue
    ) as ClassificationMigrationPlan
    const directAnalysis = analyzeClassificationMigration(
      fixtureNotes(fixture.contents),
      parsedPlan
    )

    expect(parsedPlan.moves[0].expectedSha256).toBe(
      sha256(fixture.contents[sourcePath])
    )
    expect(directAnalysis.operations[0].references).toEqual({
      active: { occurrences: 2, paths: [activePath] },
      '40_情報源': { occurrences: 1, paths: [auditPath] },
      '50_履歴': { occurrences: 1, paths: [historyPath] }
    })
    expect(directAnalysis.operations[0].projectedMcpBacklinks).toEqual({
      total: 3,
      ids: [activePath, historyPath, auditPath].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0
      )
    })
    expect(directAnalysis.totals).toMatchObject({
      moveCount: 1,
      referenceOccurrences: 4,
      referenceFiles: 3,
      activeReferences: 2,
      sourceReferences: 1,
      historyReferences: 1,
      projectedMcpBacklinks: 3
    })
    expect(directAnalysis.linkImpact).toEqual({
      withoutPlannedAliases: 3,
      withPlannedAliases: 0
    })
    expect(directAnalysis.wikiResolutionProjection).toMatchObject({
      equivalentAfterPathMapping: true,
      occurrences: 5
    })
    expect(directAnalysis.wikiResolutionProjection.afterSha256).toBe(
      directAnalysis.wikiResolutionProjection.beforeSha256
    )
    expect(directAnalysis.graphProjection).toMatchObject({
      equivalentAfterPathMapping: true,
      oldNodesRemaining: 0,
      aliasNodesCreated: 0
    })
    expect(directAnalysis.graphProjection.after).toEqual(
      directAnalysis.graphProjection.before
    )
    expect(directAnalysis.contextProjection).toEqual([
      expect.objectContaining({
        sourcePath,
        destinationPath,
        includedSetEquivalent: true,
        warningSetEquivalent: true
      })
    ])
    expect(directAnalysis.mcpProjection).toEqual([
      {
        oldId: sourcePath,
        newId: destinationPath,
        oldIdResolvesToCanonical: true,
        newIdResolvesToCanonical: true,
        oldPhysicalIdAbsent: true,
        searchReturnsCanonicalOnly: true
      }
    ])
    expect(directAnalysis).toMatchObject({
      analysisStatus: 'ready-for-review',
      applyAllowed: false,
      rollback: { ready: false, aliasSidecarState: 'absent' },
      effects: {
        vaultWrites: 0,
        physicalMoves: 0,
        markdownWrites: 0,
        driveOperations: 0
      },
      privacy: {
        noteBodiesIncluded: false,
        snippetsIncluded: false,
        absolutePathsIncluded: false
      }
    })

    const before = await snapshotFiles(fixture.vaultRoot)
    const output1 = join(fixture.outputDirectory, 'manifest-1.json')
    const output2 = join(fixture.outputDirectory, 'manifest-2.json')
    const first = await runClassificationMigrationPreview({
      vaultRoot: fixture.vaultRoot,
      planPath: fixture.planPath,
      outputPath: output1
    })
    const second = await runClassificationMigrationPreview({
      vaultRoot: fixture.vaultRoot,
      planPath: fixture.planPath,
      outputPath: output2
    })
    const after = await snapshotFiles(fixture.vaultRoot)
    const firstBytes = await readFile(output1)
    const secondBytes = await readFile(output2)

    expect(after).toEqual(before)
    expect(first.vault.unchanged).toBe(true)
    expect(first.vault.before).toEqual(first.vault.after)
    expect(first.analysis.effects.vaultWrites).toBe(0)
    expect(second).toEqual(first)
    expect(second.manifestSha256).toBe(first.manifestSha256)
    expect(secondBytes).toEqual(firstBytes)
    expect(sha256(secondBytes)).toBe(sha256(firstBytes))
    expect(firstBytes.toString('utf8')).not.toContain('PRIVATE_BODY_SENTINEL')
    expect(firstBytes.toString('utf8')).not.toContain(fixture.vaultRoot)
    expect(await pathExists(join(fixture.vaultRoot, '.tsuzune/path-aliases.json'))).toBe(
      false
    )
    expect(await pathExists(join(fixture.vaultRoot, ...destinationPath.split('/')))).toBe(
      false
    )
  })

  it('fails closed when a planned source digest has drifted', async () => {
    const fixture = await createAnonymousFixture()
    await writeVaultFile(fixture.vaultRoot, sourcePath, '# 変更済み')
    await expectPreviewFailure(
      fixture,
      join(fixture.outputDirectory, 'hash-drift.json'),
      /Migration source changed/
    )
  })

  it('fails closed when the reference baseline has drifted', async () => {
    const fixture = await createAnonymousFixture({ expectedActiveReferences: 1 })
    await expectPreviewFailure(
      fixture,
      join(fixture.outputDirectory, 'reference-drift.json'),
      /Reference baseline changed/
    )
  })

  it('fails closed on a case-insensitive destination collision', async () => {
    const fixture = await createAnonymousFixture({ destinationCollision: true })
    await expectPreviewFailure(
      fixture,
      join(fixture.outputDirectory, 'collision.json'),
      /Migration destination already exists/
    )
  })

  it('rejects an output path inside the Vault before writing it', async () => {
    const fixture = await createAnonymousFixture()
    const outputDirectory = join(fixture.vaultRoot, '.preview')
    await mkdir(outputDirectory)
    await expectPreviewFailure(
      fixture,
      join(outputDirectory, 'manifest.json'),
      /output must be outside the Vault/
    )
  })

  it('fails closed on a malformed plan', async () => {
    const fixture = await createAnonymousFixture()
    const malformed = { schemaVersion: 1 }
    expect(() => parseClassificationMigrationPlan(malformed)).toThrow(
      /planId is required/
    )
    await writeFile(fixture.planPath, JSON.stringify(malformed), 'utf8')
    await expectPreviewFailure(
      fixture,
      join(fixture.outputDirectory, 'malformed.json'),
      /planId is required/
    )
  })

  it('fails closed when an existing alias terminal is missing after projection', async () => {
    const fixture = await createAnonymousFixture({ aliasTerminalMissing: true })
    await expectPreviewFailure(
      fixture,
      join(fixture.outputDirectory, 'missing-terminal.json'),
      /Alias terminal does not exist after projection/
    )
  })
})
