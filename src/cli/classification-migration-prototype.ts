/**
 * O2-P3 test-only classification migration prototype.
 *
 * Internal apply/rollback path used ONLY by integration tests that own an
 * anonymous temporary Vault. It proves that one validated schema-v1
 * classification plan can be applied to a fixture Vault and then restored
 * byte-for-byte, including after injected failures at each mutation stage.
 *
 * There is deliberately no app route, MCP tool, package command, Drive flow,
 * or production entry point to this module. `DRIVE_PATH_ALIAS_UNSUPPORTED`
 * remains an open blocker, so no production apply is allowed.
 */
import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { buildContextBundle } from '../core/context'
import { buildWikiGraph, type WikiGraph } from '../core/graph'
import {
  buildWikiLinkIndex,
  extractWikiLinks,
  resolveIndexedWikiLink,
  transformWikiLinks
} from '../core/links'
import {
  compilePathAliases,
  resolvePathAlias,
  type CompiledPathAliases
} from '../core/path-aliases'
import {
  basenameRelative,
  validateRelativePath,
  withoutMarkdownExtension
} from '../core/paths'
import type { NoteDocument } from '../shared/types'
import {
  analyzeClassificationMigration,
  type ClassificationMigrationAnalysis,
  type ClassificationMigrationPlan
} from './classification-migration-preview'

const SIDECAR_RELATIVE_PATH = '.tsuzune/path-aliases.json'
const OWNERSHIP_RELATIVE_PATH = '.tsuzune/o2-p3-owned.json'

export type PrototypeMutationStage = 'directories' | 'references' | 'moves' | 'sidecar'

export const PROTOTYPE_MUTATION_STAGES: readonly PrototypeMutationStage[] = [
  'directories',
  'references',
  'moves',
  'sidecar'
]

export interface ClassificationMigrationPrototypeOptions {
  vaultRoot: string
  plan: ClassificationMigrationPlan
  ownershipToken: string
  preimagesDirectory: string
  rollbackPacketPath?: string
  failAfter?: PrototypeMutationStage
}

export interface PrototypeFingerprint {
  fileCount: number
  totalBytes: number
  filesSha256: string
  directorySetSha256: string
  sidecarSha256: string | null
}

export interface ClassificationMigrationPrototypeResult {
  schemaVersion: 1
  planId: string
  status: 'applied'
  failpoint: PrototypeMutationStage | null
  rollbackPacketPath: string
  beforeFingerprint: PrototypeFingerprint
  appliedFingerprint: PrototypeFingerprint
  remainingBlockers: string[]
}

export interface PrototypeRollbackOutcome {
  status: 'restored' | 'already-restored'
  failpoint: PrototypeMutationStage | null
  restoredFingerprint: PrototypeFingerprint
  unrestoredPaths: string[]
}

interface SnapshotFile {
  path: string
  sizeBytes: number
  sha256: string
}

interface VaultSnapshot {
  files: SnapshotFile[]
  directories: string[]
  sidecar: { present: boolean; sha256: string | null }
  fingerprint: PrototypeFingerprint
}

interface SidecarState {
  exists: boolean
  bytes: Buffer | null
  value: unknown
}

interface RollbackPacketPreimage {
  path: string
  sha256: string
  bytesBase64: string
}

interface RollbackPacket {
  schemaVersion: 1
  kind: 'o2-p3-rollback-packet'
  planId: string
  capturedAt: string
  vaultName: string
  vaultRootSha256: string
  ownershipTokenSha256: string
  failpoint: PrototypeMutationStage | null
  preApply: {
    files: SnapshotFile[]
    directories: string[]
    sidecar: { present: boolean; sha256: string | null }
  }
  preimages: {
    movedSources: RollbackPacketPreimage[]
    referenceRewrites: RollbackPacketPreimage[]
    sidecar: { present: true; sha256: string; bytesBase64: string } | { present: false }
  }
  inverseMoves: Array<{ from: string; to: string }>
  createdDirectories: string[]
  restored: boolean
}

export class PrototypeFailpointError extends Error {
  readonly stage: PrototypeMutationStage
  readonly rollbackOutcome: PrototypeRollbackOutcome | null
  constructor(
    stage: PrototypeMutationStage,
    rollbackOutcome: PrototypeRollbackOutcome | null = null
  ) {
    super(`Injected prototype failpoint after mutation stage: ${stage}`)
    this.name = 'PrototypeFailpointError'
    this.stage = stage
    this.rollbackOutcome = rollbackOutcome
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalize(child)])
    )
  }
  return value
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function resolveVaultPath(vaultRoot: string, relativePath: string): string {
  return resolve(vaultRoot, ...relativePath.split('/'))
}

function requireSafePacketPath(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a relative path.`)
  const validation = validateRelativePath(value)
  if (!validation.valid || validation.normalized !== value) {
    throw new Error(`${label} must be a safe normalized relative path.`)
  }
  return value
}

function validateRollbackPacket(value: unknown): asserts value is RollbackPacket {
  if (!isRecord(value) || !isRecord(value.preApply) || !isRecord(value.preimages)) {
    throw new Error('Rollback packet schema is invalid.')
  }
  const sidecar = value.preimages.sidecar
  if (
    value.schemaVersion !== 1 ||
    value.kind !== 'o2-p3-rollback-packet' ||
    typeof value.vaultRootSha256 !== 'string' ||
    typeof value.ownershipTokenSha256 !== 'string' ||
    typeof value.restored !== 'boolean' ||
    (value.failpoint !== null && !PROTOTYPE_MUTATION_STAGES.includes(value.failpoint as PrototypeMutationStage)) ||
    !Array.isArray(value.preApply.files) ||
    !Array.isArray(value.preApply.directories) ||
    !Array.isArray(value.inverseMoves) ||
    !Array.isArray(value.createdDirectories) ||
    !Array.isArray(value.preimages.referenceRewrites) ||
    !isRecord(sidecar) ||
    typeof sidecar.present !== 'boolean' ||
    (sidecar.present && typeof sidecar.bytesBase64 !== 'string')
  ) {
    throw new Error('Rollback packet schema is invalid.')
  }
  for (const [index, inverse] of value.inverseMoves.entries()) {
    if (!isRecord(inverse)) throw new Error('Rollback packet schema is invalid.')
    requireSafePacketPath(inverse.from, `inverseMoves[${index}].from`)
    requireSafePacketPath(inverse.to, `inverseMoves[${index}].to`)
  }
  for (const [index, preimage] of value.preimages.referenceRewrites.entries()) {
    if (!isRecord(preimage) || typeof preimage.bytesBase64 !== 'string') {
      throw new Error('Rollback packet schema is invalid.')
    }
    requireSafePacketPath(preimage.path, `referenceRewrites[${index}].path`)
  }
  for (const [index, directory] of value.createdDirectories.entries()) {
    requireSafePacketPath(directory, `createdDirectories[${index}]`)
  }
}

async function pathExists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false
  )
}

async function collectVaultSnapshot(root: string): Promise<VaultSnapshot> {
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error(
      'Prototype Vault root must be a real directory, not a symlink or junction.'
    )
  }
  const files: SnapshotFile[] = []
  const directories: string[] = []
  const walk = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => compareText(left.name, right.name))
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name)
      const info = await lstat(absolutePath)
      if (info.isSymbolicLink()) {
        throw new Error(
          'Prototype Vault contains a symlink or junction; stopped before any write.'
        )
      }
      if (info.isDirectory()) {
        const relativeDirectoryPath = relativeDirectory
          ? `${relativeDirectory}/${entry.name}`
          : entry.name
        directories.push(relativeDirectoryPath)
        await walk(absolutePath, relativeDirectoryPath)
      } else if (info.isFile()) {
        const bytes = await readFile(absolutePath)
        files.push({
          path: relative(root, absolutePath).replaceAll('\\', '/'),
          sizeBytes: bytes.length,
          sha256: sha256(bytes)
        })
      } else {
        throw new Error('Prototype Vault contains an unsupported filesystem entry.')
      }
    }
  }
  await walk(root, '')
  files.sort((left, right) => compareText(left.path, right.path))
  directories.sort(compareText)
  const sidecarFile = files.find((file) => file.path === SIDECAR_RELATIVE_PATH)
  const sidecar = sidecarFile
    ? { present: true, sha256: sidecarFile.sha256 }
    : { present: false, sha256: null }
  return {
    files,
    directories,
    sidecar,
    fingerprint: fingerprintOf(files, directories, sidecar)
  }
}

function fingerprintOf(
  files: SnapshotFile[],
  directories: string[],
  sidecar: { present: boolean; sha256: string | null }
): PrototypeFingerprint {
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    filesSha256: sha256(
      stableJson(files.map((file) => [file.path, file.sizeBytes, file.sha256]))
    ),
    directorySetSha256: sha256(stableJson(directories)),
    sidecarSha256: sidecar.sha256
  }
}

function isVisibleMarkdownPath(path: string): boolean {
  return (
    path.toLocaleLowerCase().endsWith('.md') &&
    !path.split('/').some((part) => part.startsWith('.'))
  )
}

async function readNotes(root: string, files: SnapshotFile[]): Promise<NoteDocument[]> {
  return Promise.all(
    files.filter((file) => isVisibleMarkdownPath(file.path)).map(async (file) => ({
      path: file.path,
      name: withoutMarkdownExtension(basenameRelative(file.path)),
      content: await readFile(resolveVaultPath(root, file.path), 'utf8'),
      modifiedAt: 0,
      createdAt: null,
      size: file.sizeBytes
    }))
  )
}

async function readSidecarState(root: string): Promise<SidecarState> {
  const absolutePath = resolveVaultPath(root, SIDECAR_RELATIVE_PATH)
  try {
    const bytes = await readFile(absolutePath)
    return { exists: true, bytes, value: JSON.parse(bytes.toString('utf8')) as unknown }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { exists: false, bytes: null, value: {} }
    }
    throw error
  }
}

async function verifyOwnership(vaultRoot: string, ownershipToken: string): Promise<void> {
  const markerPath = resolveVaultPath(vaultRoot, OWNERSHIP_RELATIVE_PATH)
  let raw: string
  try {
    raw = await readFile(markerPath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Prototype Vault is not marked as owned by this test run.')
    }
    throw error
  }
  let marker: unknown
  try {
    marker = JSON.parse(raw)
  } catch {
    throw new Error('Prototype Vault ownership marker is invalid.')
  }
  if (!isRecord(marker) || marker.token !== ownershipToken) {
    throw new Error('Prototype Vault ownership token does not match this test run.')
  }
}

async function verifyPreimagesDirectory(
  preimagesDirectory: string,
  vaultRoot: string
): Promise<void> {
  const info = await lstat(preimagesDirectory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error('Prototype preimages directory must be an existing real directory.')
  }
  const [preimagesReal, vaultReal] = await Promise.all([
    realpath(preimagesDirectory),
    realpath(vaultRoot)
  ])
  const fromVault = relative(vaultReal, preimagesReal)
  if (fromVault === '' || (!fromVault.startsWith('..') && !isAbsolute(fromVault))) {
    throw new Error('Prototype preimages directory must be outside the Vault.')
  }
}

function pathIsPathQualified(target: string): boolean {
  return target.split('#', 1)[0].replaceAll('\\', '/').includes('/')
}

function rewriteLinkTarget(target: string, destinationPath: string): string {
  const hashIndex = target.indexOf('#')
  const base = hashIndex < 0 ? target : target.slice(0, hashIndex)
  const fragment = hashIndex < 0 ? '' : target.slice(hashIndex)
  const hadExtension = base.replaceAll('\\', '/').toLocaleLowerCase().endsWith('.md')
  return `${hadExtension ? destinationPath : withoutMarkdownExtension(destinationPath)}${fragment}`
}

function rewriteLinkRaw(raw: string, newBase: string): string {
  const body = raw.slice(2, -2)
  const separator = body.indexOf('|')
  if (separator < 0) return `[[${newBase}]]`
  return `[[${newBase}${body.slice(separator)}]]`
}

async function stageDirectories(
  vaultRoot: string,
  directories: string[]
): Promise<void> {
  for (const directory of directories) {
    await mkdir(resolveVaultPath(vaultRoot, directory), { recursive: true })
  }
}

function plannedCreatedDirectories(
  plan: ClassificationMigrationPlan,
  preApplyDirectories: string[]
): string[] {
  const existing = new Set(preApplyDirectories)
  const planned = new Set<string>()
  for (const move of plan.moves) {
    const parts = move.destinationPath.split('/').slice(0, -1)
    for (let index = 1; index <= parts.length; index += 1) {
      const directory = parts.slice(0, index).join('/')
      if (!existing.has(directory)) planned.add(directory)
    }
  }
  return [...planned].sort(compareText)
}

async function stageReferences(
  vaultRoot: string,
  notes: NoteDocument[],
  analysis: ClassificationMigrationAnalysis,
  plan: ClassificationMigrationPlan,
  existingAliases: CompiledPathAliases
): Promise<void> {
  const beforeIndex = buildWikiLinkIndex(notes, existingAliases)
  const destinationBySourceKey = new Map(
    plan.moves.map((move) => [move.sourcePath.toLocaleLowerCase(), move.destinationPath])
  )
  const filesToRewrite = new Set(
    analysis.operations.flatMap((operation) => operation.references.active.paths)
  )
  for (const note of notes) {
    if (!filesToRewrite.has(note.path)) continue
    const absolutePath = resolveVaultPath(vaultRoot, note.path)
    const content = await readFile(absolutePath, 'utf8')
    const rewritten = transformWikiLinks(content, (occurrence) => {
      if (!pathIsPathQualified(occurrence.target)) return occurrence.raw
      const resolution = resolveIndexedWikiLink(occurrence.target, beforeIndex)
      if (resolution.status !== 'resolved') return occurrence.raw
      const destinationPath = destinationBySourceKey.get(
        resolution.path.toLocaleLowerCase()
      )
      if (!destinationPath) return occurrence.raw
      return rewriteLinkRaw(occurrence.raw, rewriteLinkTarget(occurrence.target, destinationPath))
    })
    if (rewritten === content) continue
    await writeVaultFileAtomic(vaultRoot, note.path, rewritten)
  }
}

async function stageMoves(vaultRoot: string, plan: ClassificationMigrationPlan): Promise<void> {
  for (const move of plan.moves) {
    const sourcePath = resolveVaultPath(vaultRoot, move.sourcePath)
    const destinationPath = resolveVaultPath(vaultRoot, move.destinationPath)
    if (await pathExists(destinationPath)) {
      throw new Error(`Destination already exists at apply time: ${move.destinationPath}`)
    }
    await rename(sourcePath, destinationPath)
  }
}

async function stageSidecar(
  vaultRoot: string,
  analysis: ClassificationMigrationAnalysis,
  sidecar: SidecarState
): Promise<void> {
  const existing = sidecar.exists
    ? (JSON.parse(sidecar.bytes!.toString('utf8')) as unknown)
    : {}
  const merged = { ...(isRecord(existing) ? existing : {}), ...analysis.aliases }
  compilePathAliases(merged)
  await writeVaultFileAtomic(
    vaultRoot,
    SIDECAR_RELATIVE_PATH,
    `${JSON.stringify(merged, null, 2)}\n`
  )
}

async function writeVaultFileAtomic(
  vaultRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const absolutePath = resolveVaultPath(vaultRoot, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, content, { encoding: 'utf8' })
  await rename(temporaryPath, absolutePath)
}

async function writeRawFileAtomic(absolutePath: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(absolutePath), { recursive: true })
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, bytes)
  await rename(temporaryPath, absolutePath)
}

async function writeRollbackPacket(path: string, packet: RollbackPacket): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(packet, null, 2)}\n`, {
    encoding: 'utf8'
  })
  await rename(temporaryPath, path)
}

async function captureRollbackPacket(options: {
  vaultRoot: string
  preimagesDirectory: string
  plan: ClassificationMigrationPlan
  analysis: ClassificationMigrationAnalysis
  before: VaultSnapshot
  sidecar: SidecarState
  ownershipToken: string
  failpoint: PrototypeMutationStage | null
  createdDirectories: string[]
  rollbackPacketPath?: string
}): Promise<string> {
  const readPreimage = async (path: string): Promise<RollbackPacketPreimage> => {
    const bytes = await readFile(resolveVaultPath(options.vaultRoot, path))
    return { path, sha256: sha256(bytes), bytesBase64: bytes.toString('base64') }
  }
  const movedSources = await Promise.all(
    options.plan.moves.map((move) => readPreimage(move.sourcePath))
  )
  const referenceRewritePaths = [
    ...new Set(
      options.analysis.operations.flatMap((operation) => operation.references.active.paths)
    )
  ].sort(compareText)
  const referenceRewrites = await Promise.all(referenceRewritePaths.map(readPreimage))
  const packet: RollbackPacket = {
    schemaVersion: 1,
    kind: 'o2-p3-rollback-packet',
    planId: options.plan.planId,
    capturedAt: new Date().toISOString(),
    vaultName: basename(options.vaultRoot),
    vaultRootSha256: sha256((await realpath(options.vaultRoot)).toLocaleLowerCase()),
    ownershipTokenSha256: sha256(options.ownershipToken),
    failpoint: options.failpoint,
    preApply: {
      files: options.before.files,
      directories: options.before.directories,
      sidecar: options.before.sidecar
    },
    preimages: {
      movedSources,
      referenceRewrites,
      sidecar: options.sidecar.exists
        ? {
            present: true,
            sha256: sha256(options.sidecar.bytes!),
            bytesBase64: options.sidecar.bytes!.toString('base64')
          }
        : { present: false }
    },
    inverseMoves: options.plan.moves.map((move) => ({
      from: move.destinationPath,
      to: move.sourcePath
    })),
    createdDirectories: options.createdDirectories,
    restored: false
  }
  const packetPath = options.rollbackPacketPath
    ? resolve(options.rollbackPacketPath)
    : resolve(options.preimagesDirectory, `o2-p3-${randomUUID()}.json`)
  if (
    dirname(packetPath).toLocaleLowerCase() !==
    resolve(options.preimagesDirectory).toLocaleLowerCase()
  ) {
    throw new Error('Rollback packet path must be inside the preimages directory.')
  }
  try {
    await lstat(packetPath)
    throw new Error('Rollback packet path already exists.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeRollbackPacket(packetPath, packet)
  return packetPath
}

function projectedAfterState(
  notes: NoteDocument[],
  plan: ClassificationMigrationPlan,
  existingAliases: CompiledPathAliases
): { notes: NoteDocument[]; aliases: CompiledPathAliases } {
  const moveByLowerPath = new Map(
    plan.moves.map((move) => [move.sourcePath.toLocaleLowerCase(), move.destinationPath])
  )
  const movedNotes = notes.map((note) => {
    const destinationPath = moveByLowerPath.get(note.path.toLocaleLowerCase())
    return destinationPath
      ? {
          ...note,
          path: destinationPath,
          name: withoutMarkdownExtension(basenameRelative(destinationPath))
        }
      : note
  })
  const combinedInput: Record<string, string> = {}
  for (const [source, terminal] of existingAliases.flattened) {
    combinedInput[source] = terminal
  }
  for (const move of plan.moves) {
    combinedInput[move.sourcePath] = move.destinationPath
  }
  return { notes: movedNotes, aliases: compilePathAliases(combinedInput) }
}

function resolutionOutcomeSignatures(
  notes: NoteDocument[],
  aliases: CompiledPathAliases
): string[] {
  const index = buildWikiLinkIndex(notes, aliases)
  const signatures: string[] = []
  for (const note of notes) {
    for (const [occurrenceIndex, link] of extractWikiLinks(note.content).entries()) {
      const resolution = resolveIndexedWikiLink(link.target, index)
      signatures.push(
        [
          note.path,
          String(occurrenceIndex),
          resolution.status,
          resolution.status === 'resolved' ? resolution.path : ''
        ].join('\0')
      )
    }
  }
  return signatures.sort(compareText)
}

function graphSignatures(graph: WikiGraph): { nodes: string[]; edges: string[] } {
  const nodes = graph.nodes
    .map((node) => `${node.path}\0${node.kind ?? 'note'}\0${node.exists !== false}`)
    .sort(compareText)
  const edges = graph.edges
    .map((edge) => `${edge.sourcePath}\0${edge.targetPath}`)
    .sort(compareText)
  return { nodes, edges }
}

function contextSets(
  seedPath: string,
  notes: NoteDocument[],
  asOf: string,
  aliases: CompiledPathAliases
): { included: string[]; warnings: string[] } {
  const bundle = buildContextBundle(seedPath, notes, {
    asOf,
    generatedAt: asOf,
    includeHistory: true,
    maxCharacters: 50_000_000,
    maxOutgoing: notes.length,
    maxBacklinks: notes.length,
    maxTemporal: notes.length,
    pathAliases: aliases
  })
  const included = bundle.included
    .map((source) => `${source.path}\0${source.relation}\0${source.temporalStatus ?? ''}`)
    .sort(compareText)
  const warnings = bundle.warnings
    .map((warning) => {
      const paths = [
        ...(warning.path ? [warning.path] : []),
        ...(warning.paths ?? [])
      ].sort(compareText)
      return `${warning.code}\0${paths.join('\0')}`
    })
    .sort(compareText)
  return { included, warnings }
}

async function verifyAppliedState(options: {
  vaultRoot: string
  plan: ClassificationMigrationPlan
  analysis: ClassificationMigrationAnalysis
  before: VaultSnapshot
  notes: NoteDocument[]
  existingAliases: CompiledPathAliases
}): Promise<void> {
  const after = await collectVaultSnapshot(options.vaultRoot)
  const afterNotes = await readNotes(options.vaultRoot, after.files)
  const afterSidecar = await readSidecarState(options.vaultRoot)
  const afterAliases = compilePathAliases(afterSidecar.value)

  // Moved sources are absent and destinations exist with the planned bytes.
  for (const operation of options.analysis.operations) {
    if (await pathExists(resolveVaultPath(options.vaultRoot, operation.sourcePath))) {
      throw new Error(
        `Applied verification failed: source still exists: ${operation.sourcePath}`
      )
    }
    const destinationInfo = await lstat(
      resolveVaultPath(options.vaultRoot, operation.destinationPath)
    ).catch(() => null)
    if (!destinationInfo || !destinationInfo.isFile()) {
      throw new Error(
        `Applied verification failed: destination missing: ${operation.destinationPath}`
      )
    }
    const destinationBytes = await readFile(
      resolveVaultPath(options.vaultRoot, operation.destinationPath)
    )
    if (
      destinationBytes.length !== operation.sizeBytes ||
      sha256(destinationBytes) !== operation.sha256
    ) {
      throw new Error(
        `Applied verification failed: destination bytes changed: ${operation.destinationPath}`
      )
    }
  }

  // Immutable source/history notes remain byte-identical.
  const beforeFilesByPath = new Map(options.before.files.map((file) => [file.path, file]))
  for (const file of after.files) {
    if (!file.path.startsWith('40_情報源/') && !file.path.startsWith('50_履歴/')) continue
    const beforeFile = beforeFilesByPath.get(file.path)
    if (!beforeFile || beforeFile.sha256 !== file.sha256 || beforeFile.sizeBytes !== file.sizeBytes) {
      throw new Error(`Applied verification failed: immutable note changed: ${file.path}`)
    }
  }

  // The alias sidecar exists and resolves every planned source to its destination.
  if (!afterSidecar.exists) {
    throw new Error('Applied verification failed: alias sidecar missing after apply.')
  }
  for (const move of options.plan.moves) {
    if (resolvePathAlias(afterAliases, move.sourcePath) !== move.destinationPath) {
      throw new Error(`Applied verification failed: alias does not resolve: ${move.sourcePath}`)
    }
  }

  // Wiki resolution outcomes, Graph node/edge sets, and Context included/warning
  // sets equal the projected after-path-mapping state fixed by the dry-run.
  const projected = projectedAfterState(options.notes, options.plan, options.existingAliases)
  if (
    stableJson(resolutionOutcomeSignatures(afterNotes, afterAliases)) !==
    stableJson(resolutionOutcomeSignatures(projected.notes, projected.aliases))
  ) {
    throw new Error('Applied verification failed: Wiki resolution outcomes differ from projection.')
  }
  const appliedGraph = graphSignatures(
    buildWikiGraph(afterNotes, { includeUnresolved: true, pathAliases: afterAliases })
  )
  const projectedGraph = graphSignatures(
    buildWikiGraph(projected.notes, { includeUnresolved: true, pathAliases: projected.aliases })
  )
  if (
    stableJson(appliedGraph.nodes) !== stableJson(projectedGraph.nodes) ||
    stableJson(appliedGraph.edges) !== stableJson(projectedGraph.edges)
  ) {
    throw new Error('Applied verification failed: Graph projection differs after apply.')
  }
  for (const move of options.plan.moves) {
    const appliedContext = contextSets(
      move.destinationPath,
      afterNotes,
      options.plan.analysisAsOf,
      afterAliases
    )
    const projectedContext = contextSets(
      move.destinationPath,
      projected.notes,
      options.plan.analysisAsOf,
      projected.aliases
    )
    if (
      stableJson(appliedContext.included) !== stableJson(projectedContext.included) ||
      stableJson(appliedContext.warnings) !== stableJson(projectedContext.warnings)
    ) {
      throw new Error(
        `Applied verification failed: Context projection differs after apply: ${move.destinationPath}`
      )
    }
  }
}

export async function applyClassificationMigrationPrototype(
  options: ClassificationMigrationPrototypeOptions
): Promise<ClassificationMigrationPrototypeResult> {
  const vaultRoot = resolve(options.vaultRoot)
  const preimagesDirectory = resolve(options.preimagesDirectory)
  await verifyOwnership(vaultRoot, options.ownershipToken)
  await verifyPreimagesDirectory(preimagesDirectory, vaultRoot)

  const before = await collectVaultSnapshot(vaultRoot)
  const notes = await readNotes(vaultRoot, before.files)
  const sidecar = await readSidecarState(vaultRoot)
  const existingAliases = compilePathAliases(sidecar.value)
  const analysis = analyzeClassificationMigration(
    notes,
    options.plan,
    sidecar.value,
    sidecar.exists
  )

  const createdDirectories = plannedCreatedDirectories(options.plan, before.directories)
  const packetPath = await captureRollbackPacket({
    vaultRoot,
    preimagesDirectory,
    plan: options.plan,
    analysis,
    before,
    sidecar,
    ownershipToken: options.ownershipToken,
    failpoint: options.failAfter ?? null,
    createdDirectories,
    rollbackPacketPath: options.rollbackPacketPath
  })

  try {
    await stageDirectories(vaultRoot, createdDirectories)
    if (options.failAfter === 'directories') throw new PrototypeFailpointError('directories')

    await stageReferences(
      vaultRoot,
      notes,
      analysis,
      options.plan,
      existingAliases
    )
    if (options.failAfter === 'references') throw new PrototypeFailpointError('references')

    await stageMoves(vaultRoot, options.plan)
    if (options.failAfter === 'moves') throw new PrototypeFailpointError('moves')

    await stageSidecar(vaultRoot, analysis, sidecar)
    if (options.failAfter === 'sidecar') throw new PrototypeFailpointError('sidecar')

    const appliedSnapshot = await collectVaultSnapshot(vaultRoot)
    await verifyAppliedState({
      vaultRoot,
      plan: options.plan,
      analysis,
      before,
      notes,
      existingAliases
    })

    return {
      schemaVersion: 1,
      planId: options.plan.planId,
      status: 'applied',
      failpoint: null,
      rollbackPacketPath: packetPath,
      beforeFingerprint: before.fingerprint,
      appliedFingerprint: appliedSnapshot.fingerprint,
      remainingBlockers: ['DRIVE_PATH_ALIAS_UNSUPPORTED']
    }
  } catch (error) {
    const outcome = await rollbackClassificationMigrationPrototype({
      vaultRoot,
      rollbackPacketPath: packetPath,
      ownershipToken: options.ownershipToken
    })
    if (outcome.unrestoredPaths.length > 0) {
      throw new Error(
        `Automatic rollback could not restore these paths: ${outcome.unrestoredPaths.join(', ')}`
      )
    }
    if (error instanceof PrototypeFailpointError) {
      throw new PrototypeFailpointError(error.stage, outcome)
    }
    throw error
  }
}

export async function rollbackClassificationMigrationPrototype(options: {
  vaultRoot: string
  rollbackPacketPath: string
  ownershipToken: string
}): Promise<PrototypeRollbackOutcome> {
  const vaultRoot = resolve(options.vaultRoot)
  const packetPath = resolve(options.rollbackPacketPath)
  await verifyOwnership(vaultRoot, options.ownershipToken)
  await verifyPreimagesDirectory(dirname(packetPath), vaultRoot)
  const packetInfo = await lstat(packetPath)
  if (!packetInfo.isFile() || packetInfo.isSymbolicLink()) {
    throw new Error('Rollback packet must be a real file outside the Vault.')
  }
  const packet: unknown = JSON.parse(await readFile(packetPath, 'utf8'))
  validateRollbackPacket(packet)
  if (
    packet.vaultRootSha256 !== sha256((await realpath(vaultRoot)).toLocaleLowerCase()) ||
    packet.ownershipTokenSha256 !== sha256(options.ownershipToken)
  ) {
    throw new Error('Rollback packet is invalid or does not belong to this owned Vault.')
  }
  if (packet.restored) {
    const snapshot = await collectVaultSnapshot(vaultRoot)
    return {
      status: 'already-restored',
      failpoint: packet.failpoint,
      restoredFingerprint: snapshot.fingerprint,
      unrestoredPaths: []
    }
  }

  const unrestored: string[] = []
  const fail = (path: string): void => {
    unrestored.push(path)
  }

  // 1. Restore the alias sidecar exactly, or remove it when none existed before.
  try {
    if (packet.preimages.sidecar.present) {
      const bytes = Buffer.from(packet.preimages.sidecar.bytesBase64, 'base64')
      await writeRawFileAtomic(resolveVaultPath(vaultRoot, SIDECAR_RELATIVE_PATH), bytes)
    } else if (await pathExists(resolveVaultPath(vaultRoot, SIDECAR_RELATIVE_PATH))) {
      await rm(resolveVaultPath(vaultRoot, SIDECAR_RELATIVE_PATH), { force: true })
    }
  } catch (error) {
    fail(SIDECAR_RELATIVE_PATH)
  }

  // 2. Move every destination back to its original source path.
  for (const inverse of packet.inverseMoves) {
    const destinationPath = resolveVaultPath(vaultRoot, inverse.from)
    const sourcePath = resolveVaultPath(vaultRoot, inverse.to)
    try {
      if (await pathExists(destinationPath)) {
        if (await pathExists(sourcePath)) {
          fail(inverse.to)
        } else {
          await rename(destinationPath, sourcePath)
        }
      }
    } catch (error) {
      fail(inverse.to)
    }
  }

  // 3. Restore every rewritten active-reference file to its original bytes.
  for (const preimage of packet.preimages.referenceRewrites) {
    try {
      await writeRawFileAtomic(
        resolveVaultPath(vaultRoot, preimage.path),
        Buffer.from(preimage.bytesBase64, 'base64')
      )
    } catch (error) {
      fail(preimage.path)
    }
  }

  // 4. Remove only the newly created empty directories, never pre-existing ones.
  const preApplyDirectories = new Set(packet.preApply.directories)
  for (const directory of [...packet.createdDirectories].reverse()) {
    if (preApplyDirectories.has(directory)) continue
    try {
      const absolutePath = resolveVaultPath(vaultRoot, directory)
      if (await pathExists(absolutePath)) {
        const entries = await readdir(absolutePath)
        if (entries.length === 0) {
          await rmdir(absolutePath)
        }
      }
    } catch (error) {
      fail(directory)
    }
  }

  // 5. Verify the complete Vault tree equals the pre-apply snapshot.
  try {
    const after = await collectVaultSnapshot(vaultRoot)
    const afterFilesByPath = new Map(after.files.map((file) => [file.path, file]))
    for (const file of packet.preApply.files) {
      const afterFile = afterFilesByPath.get(file.path)
      if (!afterFile || afterFile.sha256 !== file.sha256 || afterFile.sizeBytes !== file.sizeBytes) {
        fail(file.path)
      }
    }
    for (const file of after.files) {
      if (!packet.preApply.files.some((expected) => expected.path === file.path)) {
        fail(file.path)
      }
    }
    if (stableJson(after.directories) !== stableJson(packet.preApply.directories)) {
      for (const directory of after.directories) {
        if (!packet.preApply.directories.includes(directory)) fail(directory)
      }
    }
    if (after.sidecar.present !== packet.preApply.sidecar.present) {
      fail(SIDECAR_RELATIVE_PATH)
    } else if (after.sidecar.present && after.sidecar.sha256 !== packet.preApply.sidecar.sha256) {
      fail(SIDECAR_RELATIVE_PATH)
    }
  } catch (error) {
    fail('vault-tree')
  }

  if (unrestored.length > 0) {
    const snapshot = await collectVaultSnapshot(vaultRoot)
    return {
      status: 'restored',
      failpoint: packet.failpoint,
      restoredFingerprint: snapshot.fingerprint,
      unrestoredPaths: [...new Set(unrestored)].sort(compareText)
    }
  }

  packet.restored = true
  await writeRollbackPacket(packetPath, packet)
  const snapshot = await collectVaultSnapshot(vaultRoot)
  return {
    status: 'restored',
    failpoint: packet.failpoint,
    restoredFingerprint: snapshot.fingerprint,
    unrestoredPaths: []
  }
}
