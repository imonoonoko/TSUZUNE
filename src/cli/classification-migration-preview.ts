import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildContextBundle } from '../core/context'
import { buildWikiGraph, type WikiGraph } from '../core/graph'
import {
  buildWikiLinkIndex,
  extractWikiLinks,
  findLinkImpact,
  resolveIndexedWikiLink
} from '../core/links'
import { compilePathAliases, resolvePathAlias } from '../core/path-aliases'
import {
  basenameRelative,
  validateRelativePath,
  withoutMarkdownExtension
} from '../core/paths'
import type { NoteDocument } from '../shared/types'

export interface ClassificationMigrationMove {
  sourcePath: string
  destinationPath: string
  expectedSizeBytes: number
  expectedSha256: string
  expectedReferences: {
    active: number
    source: number
    history: number
    mcpBacklinks: number
  }
}

export interface ClassificationMigrationPlan {
  schemaVersion: 1
  planId: string
  analysisAsOf: string
  auditSource: {
    path: string
    expectedSizeBytes: number
    expectedSha256: string
  }
  moves: ClassificationMigrationMove[]
}

interface FileDigest {
  path: string
  sizeBytes: number
  sha256: string
}

interface VaultFileDigest extends FileDigest {
  modifiedAtMs: number
}

interface VaultFingerprint {
  fileCount: number
  totalBytes: number
  combinedSha256: string
}

type ReferenceClass = 'active' | '40_情報源' | '50_履歴'

interface ReferenceSummary {
  occurrences: number
  paths: string[]
}

export interface ClassificationMigrationAnalysis {
  schemaVersion: 1
  mode: 'dry-run'
  planId: string
  analysisStatus: 'ready-for-review'
  applyAllowed: false
  applyBlockers: string[]
  auditSource: FileDigest
  operations: Array<{
    sourcePath: string
    destinationPath: string
    sizeBytes: number
    sha256: string
    targetAbsent: true
    alias: { from: string; to: string }
    references: Record<ReferenceClass, ReferenceSummary>
    referenceForms: {
      pathQualified: number
      withFragment: number
      withDisplayAlias: number
    }
    projectedMcpBacklinks: {
      total: number
      ids: string[]
    }
  }>
  totals: {
    moveCount: number
    movedBytes: number
    referenceOccurrences: number
    referenceFiles: number
    activeReferences: number
    sourceReferences: number
    historyReferences: number
    projectedMcpBacklinks: number
  }
  aliases: Record<string, string>
  linkImpact: {
    withoutPlannedAliases: number
    withPlannedAliases: number
  }
  wikiResolutionProjection: {
    equivalentAfterPathMapping: true
    occurrences: number
    beforeSha256: string
    afterSha256: string
  }
  graphProjection: {
    equivalentAfterPathMapping: boolean
    before: GraphSummary
    after: GraphSummary
    oldNodesRemaining: number
    aliasNodesCreated: number
  }
  contextProjection: Array<{
    sourcePath: string
    destinationPath: string
    includedSetEquivalent: boolean
    warningSetEquivalent: boolean
    beforeIncluded: number
    afterIncluded: number
    beforeWarnings: number
    afterWarnings: number
  }>
  mcpProjection: Array<{
    oldId: string
    newId: string
    oldIdResolvesToCanonical: boolean
    newIdResolvesToCanonical: boolean
    oldPhysicalIdAbsent: boolean
    searchReturnsCanonicalOnly: boolean
  }>
  requiredDirectories: string[]
  immutableBaseline: {
    source: DigestGroup
    history: DigestGroup
    referencedFiles: FileDigest[]
  }
  rollback: {
    ready: false
    reason: string
    aliasSidecarState: 'absent' | 'present'
    inverseMoves: Array<{ from: string; to: string }>
    requiredPreimages: FileDigest[]
  }
  effects: {
    vaultWrites: 0
    physicalMoves: 0
    markdownWrites: 0
    driveOperations: 0
  }
  privacy: {
    noteBodiesIncluded: false
    snippetsIncluded: false
    absolutePathsIncluded: false
  }
}

interface GraphSummary {
  noteNodes: number
  unresolvedNodes: number
  edges: number
  nodeSetSha256: string
  edgeSetSha256: string
}

interface DigestGroup {
  fileCount: number
  totalBytes: number
  combinedSha256: string
}

export interface ClassificationMigrationManifest {
  schemaVersion: 1
  mode: 'dry-run'
  planSha256: string
  vault: {
    name: string
    before: VaultFingerprint
    after: VaultFingerprint
    unchanged: true
  }
  analysis: ClassificationMigrationAnalysis
  manifestSha256: string
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

function validSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)
}

function validSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseExpectedReferences(
  value: unknown,
  label: string
): ClassificationMigrationMove['expectedReferences'] {
  if (!isRecord(value)) throw new TypeError(`${label} is required.`)
  for (const key of ['active', 'source', 'history', 'mcpBacklinks'] as const) {
    if (!validSize(value[key])) {
      throw new TypeError(`${label}.${key} must be a non-negative integer.`)
    }
  }
  return {
    active: value.active as number,
    source: value.source as number,
    history: value.history as number,
    mcpBacklinks: value.mcpBacklinks as number
  }
}

function requireSafeMarkdownPath(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`)
  const validation = validateRelativePath(value)
  if (
    !validation.valid ||
    !validation.normalized ||
    extname(validation.normalized).toLocaleLowerCase() !== '.md'
  ) {
    throw new TypeError(`${label} must be a safe relative Markdown path.`)
  }
  return validation.normalized
}

export function parseClassificationMigrationPlan(
  value: unknown
): ClassificationMigrationPlan {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new TypeError('Migration plan must use schemaVersion 1.')
  }
  if (typeof value.planId !== 'string' || !value.planId.trim()) {
    throw new TypeError('Migration plan planId is required.')
  }
  if (
    typeof value.analysisAsOf !== 'string' ||
    !Number.isFinite(Date.parse(value.analysisAsOf))
  ) {
    throw new TypeError('Migration plan analysisAsOf must be an ISO date.')
  }
  if (!isRecord(value.auditSource)) {
    throw new TypeError('Migration plan auditSource is required.')
  }
  const auditPath = requireSafeMarkdownPath(
    value.auditSource.path,
    'auditSource.path'
  )
  if (
    !validSize(value.auditSource.expectedSizeBytes) ||
    !validSha256(value.auditSource.expectedSha256)
  ) {
    throw new TypeError('Migration plan auditSource digest is invalid.')
  }
  if (!Array.isArray(value.moves) || value.moves.length === 0) {
    throw new TypeError('Migration plan moves must not be empty.')
  }

  const sourceKeys = new Set<string>()
  const destinationKeys = new Set<string>()
  const moves = value.moves.map((raw, index): ClassificationMigrationMove => {
    if (!isRecord(raw)) throw new TypeError(`moves[${index}] is invalid.`)
    const sourcePath = requireSafeMarkdownPath(
      raw.sourcePath,
      `moves[${index}].sourcePath`
    )
    const destinationPath = requireSafeMarkdownPath(
      raw.destinationPath,
      `moves[${index}].destinationPath`
    )
    if (!validSize(raw.expectedSizeBytes) || !validSha256(raw.expectedSha256)) {
      throw new TypeError(`moves[${index}] digest is invalid.`)
    }
    const sourceKey = sourcePath.toLocaleLowerCase()
    const destinationKey = destinationPath.toLocaleLowerCase()
    if (sourceKey === destinationKey) {
      throw new TypeError(`moves[${index}] does not change the path.`)
    }
    if (sourceKeys.has(sourceKey)) {
      throw new TypeError(`Duplicate migration source: ${sourcePath}`)
    }
    if (destinationKeys.has(destinationKey)) {
      throw new TypeError(`Duplicate migration destination: ${destinationPath}`)
    }
    sourceKeys.add(sourceKey)
    destinationKeys.add(destinationKey)
    return {
      sourcePath,
      destinationPath,
      expectedSizeBytes: raw.expectedSizeBytes,
      expectedSha256: raw.expectedSha256.toUpperCase(),
      expectedReferences: parseExpectedReferences(
        raw.expectedReferences,
        `moves[${index}].expectedReferences`
      )
    }
  })

  return {
    schemaVersion: 1,
    planId: value.planId.trim(),
    analysisAsOf: value.analysisAsOf,
    auditSource: {
      path: auditPath,
      expectedSizeBytes: value.auditSource.expectedSizeBytes,
      expectedSha256: value.auditSource.expectedSha256.toUpperCase()
    },
    moves
  }
}

function noteDigest(note: NoteDocument): FileDigest {
  return {
    path: note.path,
    sizeBytes: note.size,
    sha256: sha256(Buffer.from(note.content, 'utf8'))
  }
}

function digestGroup(notes: readonly NoteDocument[]): DigestGroup {
  const files = notes.map(noteDigest).sort((a, b) => compareText(a.path, b.path))
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    combinedSha256: sha256(stableJson(files))
  }
}

function referenceClass(path: string): ReferenceClass {
  if (path.startsWith('50_履歴/')) return '50_履歴'
  if (path.startsWith('40_情報源/')) return '40_情報源'
  return 'active'
}

function mappedPath(path: string, moves: ReadonlyMap<string, string>): string {
  return moves.get(path.toLocaleLowerCase()) ?? path
}

function graphSignatures(
  graph: WikiGraph,
  moves: ReadonlyMap<string, string> = new Map()
): { nodes: string[]; edges: string[]; summary: GraphSummary } {
  const nodes = graph.nodes
    .map(
      (node) =>
        `${mappedPath(node.path, moves)}\0${node.kind ?? 'note'}\0${node.exists !== false}`
    )
    .sort(compareText)
  const edges = graph.edges
    .map(
      (edge) =>
        `${mappedPath(edge.sourcePath, moves)}\0${mappedPath(edge.targetPath, moves)}`
    )
    .sort(compareText)
  return {
    nodes,
    edges,
    summary: {
      noteNodes: graph.nodes.filter((node) => (node.kind ?? 'note') === 'note').length,
      unresolvedNodes: graph.nodes.filter((node) => node.kind === 'unresolved').length,
      edges: graph.edges.length,
      nodeSetSha256: sha256(stableJson(nodes)),
      edgeSetSha256: sha256(stableJson(edges))
    }
  }
}

function wikiResolutionSignatures(
  notes: NoteDocument[],
  aliases: ReturnType<typeof compilePathAliases>,
  moves: ReadonlyMap<string, string> = new Map()
): string[] {
  const index = buildWikiLinkIndex(notes, aliases)
  const signatures: string[] = []
  for (const note of notes) {
    const sourcePath = mappedPath(note.path, moves)
    for (const [occurrenceIndex, link] of extractWikiLinks(note.content).entries()) {
      const resolution = resolveIndexedWikiLink(link.target, index)
      const resolvedPath =
        resolution.status === 'resolved' ? mappedPath(resolution.path, moves) : ''
      const candidates = resolution.candidates
        .map((path) => mappedPath(path, moves))
        .sort(compareText)
      signatures.push(
        [
          sourcePath,
          String(occurrenceIndex),
          link.target,
          link.alias ?? '',
          resolution.status,
          resolvedPath,
          ...candidates
        ].join('\0')
      )
    }
  }
  return signatures.sort(compareText)
}

function normalizedContext(
  seedPath: string,
  notes: NoteDocument[],
  asOf: string,
  pathAliases: ReturnType<typeof compilePathAliases> | undefined,
  moves: ReadonlyMap<string, string>
): { included: string[]; warnings: string[] } {
  const bundle = buildContextBundle(seedPath, notes, {
    asOf,
    generatedAt: asOf,
    includeHistory: true,
    maxCharacters: 50_000_000,
    maxOutgoing: notes.length,
    maxBacklinks: notes.length,
    maxTemporal: notes.length,
    ...(pathAliases ? { pathAliases } : {})
  })
  const included = bundle.included
    .map(
      (source) =>
        `${mappedPath(source.path, moves)}\0${source.relation}\0${source.temporalStatus ?? ''}`
    )
    .sort(compareText)
  const warnings = bundle.warnings
    .map((warning) => {
      const paths = [
        ...(warning.path ? [mappedPath(warning.path, moves)] : []),
        ...(warning.paths ?? []).map((path) => mappedPath(path, moves))
      ].sort(compareText)
      return `${warning.code}\0${paths.join('\0')}`
    })
    .sort(compareText)
  return { included, warnings }
}

export function analyzeClassificationMigration(
  notes: NoteDocument[],
  plan: ClassificationMigrationPlan,
  rawExistingAliases: unknown = {},
  aliasSidecarExists = false
): ClassificationMigrationAnalysis {
  const notesByLowerPath = new Map(
    notes.map((note) => [note.path.toLocaleLowerCase(), note])
  )
  const auditNote = notesByLowerPath.get(plan.auditSource.path.toLocaleLowerCase())
  if (!auditNote) throw new Error(`Audit source is missing: ${plan.auditSource.path}`)
  const auditDigest = noteDigest(auditNote)
  if (
    auditDigest.sizeBytes !== plan.auditSource.expectedSizeBytes ||
    auditDigest.sha256 !== plan.auditSource.expectedSha256
  ) {
    throw new Error(`Audit source changed: ${plan.auditSource.path}`)
  }

  const existingAliases = compilePathAliases(rawExistingAliases)
  const moveByLowerPath = new Map<string, string>()
  const pathChanges = new Map<string, string>()
  const sourcePathByLowerPath = new Map<string, string>()
  for (const move of plan.moves) {
    const sourceKey = move.sourcePath.toLocaleLowerCase()
    const destinationKey = move.destinationPath.toLocaleLowerCase()
    const source = notesByLowerPath.get(sourceKey)
    if (!source) throw new Error(`Migration source is missing: ${move.sourcePath}`)
    const digest = noteDigest(source)
    if (
      digest.sizeBytes !== move.expectedSizeBytes ||
      digest.sha256 !== move.expectedSha256
    ) {
      throw new Error(`Migration source changed: ${move.sourcePath}`)
    }
    if (notesByLowerPath.has(destinationKey)) {
      throw new Error(`Migration destination already exists: ${move.destinationPath}`)
    }
    if (existingAliases.flattened.has(sourceKey)) {
      throw new Error(`Migration source is already an alias: ${move.sourcePath}`)
    }
    moveByLowerPath.set(sourceKey, move.destinationPath)
    pathChanges.set(source.path, move.destinationPath)
    sourcePathByLowerPath.set(sourceKey, source.path)
  }

  const combinedAliasInput = Object.fromEntries(existingAliases.flattened)
  for (const move of plan.moves) {
    combinedAliasInput[move.sourcePath] = move.destinationPath
  }
  const combinedAliases = compilePathAliases(combinedAliasInput)
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
  const movedPaths = new Set(movedNotes.map((note) => note.path.toLocaleLowerCase()))
  for (const move of plan.moves) {
    if (
      resolvePathAlias(combinedAliases, move.sourcePath) !== move.destinationPath ||
      !movedPaths.has(move.destinationPath.toLocaleLowerCase())
    ) {
      throw new Error(`Alias projection failed: ${move.sourcePath}`)
    }
  }
  for (const terminal of combinedAliases.flattened.values()) {
    if (!movedPaths.has(terminal.toLocaleLowerCase())) {
      throw new Error(`Alias terminal does not exist after projection: ${terminal}`)
    }
  }

  const beforeIndex = buildWikiLinkIndex(notes, existingAliases)
  const referenceBuckets = new Map<
    string,
    Array<{ sourcePath: string; kind: ReferenceClass; target: string; alias: string | null }>
  >()
  for (const note of notes) {
    for (const link of extractWikiLinks(note.content)) {
      const resolution = resolveIndexedWikiLink(link.target, beforeIndex)
      if (resolution.status !== 'resolved') continue
      const sourcePath = sourcePathByLowerPath.get(resolution.path.toLocaleLowerCase())
      if (!sourcePath) continue
      const bucket = referenceBuckets.get(sourcePath) ?? []
      bucket.push({
        sourcePath: note.path,
        kind: referenceClass(note.path),
        target: link.target,
        alias: link.alias
      })
      referenceBuckets.set(sourcePath, bucket)
    }
  }

  const operations = plan.moves.map((move) => {
    const source = notesByLowerPath.get(move.sourcePath.toLocaleLowerCase())!
    const references = referenceBuckets.get(source.path) ?? []
    const summarize = (kind: ReferenceClass): ReferenceSummary => {
      const matches = references.filter((reference) => reference.kind === kind)
      return {
        occurrences: matches.length,
        paths: [...new Set(matches.map((reference) => reference.sourcePath))].sort(
          compareText
        )
      }
    }
    const backlinkIds = [...new Set(references.map((reference) => reference.sourcePath))].sort(
      compareText
    )
    const operation = {
      sourcePath: source.path,
      destinationPath: move.destinationPath,
      sizeBytes: source.size,
      sha256: noteDigest(source).sha256,
      targetAbsent: true as const,
      alias: { from: source.path, to: move.destinationPath },
      references: {
        active: summarize('active'),
        '40_情報源': summarize('40_情報源'),
        '50_履歴': summarize('50_履歴')
      },
      referenceForms: {
        pathQualified: references.filter((reference) =>
          reference.target.split('#', 1)[0].replaceAll('\\', '/').includes('/')
        ).length,
        withFragment: references.filter((reference) => reference.target.includes('#')).length,
        withDisplayAlias: references.filter((reference) => reference.alias !== null).length
      },
      projectedMcpBacklinks: {
        total: backlinkIds.length,
        ids: backlinkIds
      }
    }
    const actualReferences = {
      active: operation.references.active.occurrences,
      source: operation.references['40_情報源'].occurrences,
      history: operation.references['50_履歴'].occurrences,
      mcpBacklinks: operation.projectedMcpBacklinks.total
    }
    if (stableJson(actualReferences) !== stableJson(move.expectedReferences)) {
      throw new Error(`Reference baseline changed: ${move.sourcePath}`)
    }
    return operation
  })

  const beforeWikiResolutions = wikiResolutionSignatures(
    notes,
    existingAliases,
    moveByLowerPath
  )
  const afterWikiResolutions = wikiResolutionSignatures(movedNotes, combinedAliases)
  if (stableJson(beforeWikiResolutions) !== stableJson(afterWikiResolutions)) {
    throw new Error('Projected Wiki link resolution changed after path mapping.')
  }

  const beforeGraph = buildWikiGraph(notes, {
    includeUnresolved: true,
    pathAliases: existingAliases
  })
  const afterGraph = buildWikiGraph(movedNotes, {
    includeUnresolved: true,
    pathAliases: combinedAliases
  })
  const mappedBeforeGraph = graphSignatures(beforeGraph, moveByLowerPath)
  const directAfterGraph = graphSignatures(afterGraph)
  const graphEquivalent =
    stableJson(mappedBeforeGraph.nodes) === stableJson(directAfterGraph.nodes) &&
    stableJson(mappedBeforeGraph.edges) === stableJson(directAfterGraph.edges)
  if (!graphEquivalent) throw new Error('Projected Graph is not equivalent after path mapping.')

  const contextProjection = plan.moves.map((move) => {
    const before = normalizedContext(
      move.sourcePath,
      notes,
      plan.analysisAsOf,
      existingAliases,
      moveByLowerPath
    )
    const after = normalizedContext(
      move.destinationPath,
      movedNotes,
      plan.analysisAsOf,
      combinedAliases,
      new Map()
    )
    const includedSetEquivalent = stableJson(before.included) === stableJson(after.included)
    const warningSetEquivalent = stableJson(before.warnings) === stableJson(after.warnings)
    if (!includedSetEquivalent || !warningSetEquivalent) {
      throw new Error(`Projected Context changed: ${move.sourcePath}`)
    }
    return {
      sourcePath: move.sourcePath,
      destinationPath: move.destinationPath,
      includedSetEquivalent,
      warningSetEquivalent,
      beforeIncluded: before.included.length,
      afterIncluded: after.included.length,
      beforeWarnings: before.warnings.length,
      afterWarnings: after.warnings.length
    }
  })

  const impactWithoutAliases = findLinkImpact(notes, pathChanges, existingAliases)
  const impactWithAliases = findLinkImpact(notes, pathChanges, combinedAliases)
  if (impactWithAliases.affectedCount !== 0) {
    throw new Error('Planned aliases do not preserve all resolved Wiki links.')
  }

  const immutableReferencedPaths = new Set(
    operations.flatMap((operation) => [
      ...operation.references['40_情報源'].paths,
      ...operation.references['50_履歴'].paths
    ])
  )
  const immutableReferencedFiles = notes
    .filter((note) => immutableReferencedPaths.has(note.path))
    .map(noteDigest)
    .sort((a, b) => compareText(a.path, b.path))
  const requiredPreimagePaths = new Set([
    ...plan.moves.map((move) => move.sourcePath),
    ...operations.flatMap((operation) => operation.references.active.paths)
  ])
  const requiredPreimages = notes
    .filter((note) => requiredPreimagePaths.has(note.path))
    .map(noteDigest)
    .sort((a, b) => compareText(a.path, b.path))

  const referenceFiles = new Set(
    operations.flatMap((operation) => [
      ...operation.references.active.paths,
      ...operation.references['40_情報源'].paths,
      ...operation.references['50_履歴'].paths
    ])
  )
  const activeReferences = operations.reduce(
    (sum, operation) => sum + operation.references.active.occurrences,
    0
  )
  const sourceReferences = operations.reduce(
    (sum, operation) => sum + operation.references['40_情報源'].occurrences,
    0
  )
  const historyReferences = operations.reduce(
    (sum, operation) => sum + operation.references['50_履歴'].occurrences,
    0
  )

  return {
    schemaVersion: 1,
    mode: 'dry-run',
    planId: plan.planId,
    analysisStatus: 'ready-for-review',
    applyAllowed: false,
    applyBlockers: [
      'DRIVE_PATH_ALIAS_UNSUPPORTED',
      'REFERENCE_REWRITE_NOT_APPLIED',
      'ROLLBACK_PREIMAGES_NOT_CAPTURED'
    ],
    auditSource: auditDigest,
    operations,
    totals: {
      moveCount: operations.length,
      movedBytes: operations.reduce((sum, operation) => sum + operation.sizeBytes, 0),
      referenceOccurrences: activeReferences + sourceReferences + historyReferences,
      referenceFiles: referenceFiles.size,
      activeReferences,
      sourceReferences,
      historyReferences,
      projectedMcpBacklinks: operations.reduce(
        (sum, operation) => sum + operation.projectedMcpBacklinks.total,
        0
      )
    },
    aliases: Object.fromEntries(
      plan.moves
        .map((move) => [move.sourcePath, move.destinationPath] as const)
        .sort(([left], [right]) => compareText(left, right))
    ),
    linkImpact: {
      withoutPlannedAliases: impactWithoutAliases.affectedCount,
      withPlannedAliases: impactWithAliases.affectedCount
    },
    wikiResolutionProjection: {
      equivalentAfterPathMapping: true,
      occurrences: beforeWikiResolutions.length,
      beforeSha256: sha256(stableJson(beforeWikiResolutions)),
      afterSha256: sha256(stableJson(afterWikiResolutions))
    },
    graphProjection: {
      equivalentAfterPathMapping: graphEquivalent,
      before: mappedBeforeGraph.summary,
      after: directAfterGraph.summary,
      oldNodesRemaining: afterGraph.nodes.filter((node) =>
        moveByLowerPath.has(node.path.toLocaleLowerCase())
      ).length,
      aliasNodesCreated: afterGraph.nodes.filter((node) =>
        plan.moves.some(
          (move) =>
            node.path.toLocaleLowerCase() === move.sourcePath.toLocaleLowerCase()
        )
      ).length
    },
    contextProjection,
    mcpProjection: plan.moves.map((move) => ({
      oldId: move.sourcePath,
      newId: move.destinationPath,
      oldIdResolvesToCanonical:
        resolvePathAlias(combinedAliases, move.sourcePath) === move.destinationPath,
      newIdResolvesToCanonical:
        resolvePathAlias(combinedAliases, move.destinationPath) === move.destinationPath,
      oldPhysicalIdAbsent: !movedPaths.has(move.sourcePath.toLocaleLowerCase()),
      searchReturnsCanonicalOnly:
        movedPaths.has(move.destinationPath.toLocaleLowerCase()) &&
        !movedPaths.has(move.sourcePath.toLocaleLowerCase())
    })),
    requiredDirectories: [
      ...new Set(
        plan.moves.map((move) =>
          move.destinationPath.split('/').slice(0, -1).join('/')
        )
      )
    ].sort(compareText),
    immutableBaseline: {
      source: digestGroup(notes.filter((note) => note.path.startsWith('40_情報源/'))),
      history: digestGroup(notes.filter((note) => note.path.startsWith('50_履歴/'))),
      referencedFiles: immutableReferencedFiles
    },
    rollback: {
      ready: false,
      reason:
        'Dry-run does not store full-byte preimages for future reference rewrites or sidecars.',
      aliasSidecarState: aliasSidecarExists ? 'present' : 'absent',
      inverseMoves: plan.moves
        .map((move) => ({ from: move.destinationPath, to: move.sourcePath }))
        .sort((left, right) => compareText(left.from, right.from)),
      requiredPreimages
    },
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
  }
}

async function collectVaultFiles(root: string): Promise<VaultFileDigest[]> {
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error('Vault root must be a real directory, not a symlink or junction.')
  }
  const files: VaultFileDigest[] = []
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => compareText(left.name, right.name))
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name)
      const info = await lstat(absolutePath)
      if (info.isSymbolicLink()) {
        throw new Error('Vault contains a symlink or junction; dry-run stopped.')
      }
      if (info.isDirectory()) {
        await walk(absolutePath)
      } else if (info.isFile()) {
        const bytes = await readFile(absolutePath)
        files.push({
          path: relative(root, absolutePath).replaceAll('\\', '/'),
          sizeBytes: bytes.length,
          sha256: sha256(bytes),
          modifiedAtMs: info.mtimeMs
        })
      } else {
        throw new Error('Vault contains an unsupported filesystem entry.')
      }
    }
  }
  await walk(root)
  return files.sort((left, right) => compareText(left.path, right.path))
}

function fingerprint(files: VaultFileDigest[]): VaultFingerprint {
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    combinedSha256: sha256(stableJson(files))
  }
}

function isVisibleMarkdownPath(path: string): boolean {
  return (
    extname(path).toLocaleLowerCase() === '.md' &&
    !path.split('/').some((part) => part.startsWith('.'))
  )
}

async function readNotes(root: string, files: VaultFileDigest[]): Promise<NoteDocument[]> {
  return Promise.all(
    files.filter((file) => isVisibleMarkdownPath(file.path)).map(async (file) => ({
      path: file.path,
      name: withoutMarkdownExtension(basenameRelative(file.path)),
      content: await readFile(resolve(root, ...file.path.split('/')), 'utf8'),
      modifiedAt: 0,
      createdAt: null,
      size: file.sizeBytes
    }))
  )
}

async function readExistingAliases(
  root: string,
  files: VaultFileDigest[]
): Promise<{ exists: boolean; value: unknown }> {
  const aliasPath = '.tsuzune/path-aliases.json'
  if (!files.some((file) => file.path === aliasPath)) return { exists: false, value: {} }
  return {
    exists: true,
    value: JSON.parse(
      await readFile(resolve(root, '.tsuzune', 'path-aliases.json'), 'utf8')
    )
  }
}

function pathIsInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot))
}

export async function runClassificationMigrationPreview(options: {
  vaultRoot: string
  planPath: string
  outputPath: string
}): Promise<ClassificationMigrationManifest> {
  const vaultRoot = resolve(options.vaultRoot)
  const planPath = resolve(options.planPath)
  const outputPath = resolve(options.outputPath)
  const outputParent = dirname(outputPath)
  const outputParentInfo = await lstat(outputParent)
  if (!outputParentInfo.isDirectory() || outputParentInfo.isSymbolicLink()) {
    throw new Error('Dry-run output parent must be an existing real directory.')
  }
  const [vaultRealPath, outputParentRealPath] = await Promise.all([
    realpath(vaultRoot),
    realpath(outputParent)
  ])
  if (pathIsInside(vaultRealPath, outputParentRealPath)) {
    throw new Error('Dry-run output must be outside the Vault.')
  }
  if (outputPath.toLocaleLowerCase() === planPath.toLocaleLowerCase()) {
    throw new Error('Dry-run output must not overwrite the plan.')
  }
  try {
    await lstat(outputPath)
    throw new Error('Dry-run output already exists; choose a new output path.')
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error
    }
  }

  const beforeFiles = await collectVaultFiles(vaultRoot)
  const beforeFingerprint = fingerprint(beforeFiles)
  const planBytesBefore = await readFile(planPath)
  const planSha256 = sha256(planBytesBefore)
  const plan = parseClassificationMigrationPlan(JSON.parse(planBytesBefore.toString('utf8')))
  const notes = await readNotes(vaultRoot, beforeFiles)
  const aliases = await readExistingAliases(vaultRoot, beforeFiles)
  const analysis = analyzeClassificationMigration(
    notes,
    plan,
    aliases.value,
    aliases.exists
  )

  const [afterFiles, planBytesAfter] = await Promise.all([
    collectVaultFiles(vaultRoot),
    readFile(planPath)
  ])
  const afterFingerprint = fingerprint(afterFiles)
  if (
    stableJson(beforeFiles) !== stableJson(afterFiles) ||
    planSha256 !== sha256(planBytesAfter)
  ) {
    throw new Error('Vault or plan changed during dry-run; no manifest was written.')
  }

  const payload = {
    schemaVersion: 1 as const,
    mode: 'dry-run' as const,
    planSha256,
    vault: {
      name: basenameRelative(vaultRoot.replaceAll('\\', '/')),
      before: beforeFingerprint,
      after: afterFingerprint,
      unchanged: true as const
    },
    analysis
  }
  const manifest: ClassificationMigrationManifest = {
    ...payload,
    manifestSha256: sha256(stableJson(payload))
  }

  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, outputPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
  return manifest
}

function requiredArgument(name: string, position: number): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : process.argv[position]
  if (!value) throw new TypeError(`${name} is required.`)
  return value
}

async function main(): Promise<void> {
  const manifest = await runClassificationMigrationPreview({
    vaultRoot: requiredArgument('--vault', 2),
    planPath: requiredArgument('--plan', 3),
    outputPath: requiredArgument('--output', 4)
  })
  process.stdout.write(
    `${JSON.stringify({
      status: manifest.analysis.analysisStatus,
      applyAllowed: manifest.analysis.applyAllowed,
      moves: manifest.analysis.totals.moveCount,
      references: manifest.analysis.totals.referenceOccurrences,
      vaultUnchanged: manifest.vault.unchanged,
      manifestSha256: manifest.manifestSha256
    })}\n`
  )
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
const isClassificationPreviewEntry =
  /(?:^|[\\/])classification-migration-preview\.(?:js|mjs|ts)$/i.test(entryPath)
if (
  entryPath &&
  isClassificationPreviewEntry &&
  import.meta.url === pathToFileURL(entryPath).href
) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
