import type { WikiGraph } from './graph'
import type { NoteDocument } from '../shared/types'
import { parseFrontmatter } from './frontmatter'

const DAY_MS = 24 * 60 * 60 * 1000
const STRATUM_DAYS = 7
const FEATURE_COUNT = 128
const MAX_CANDIDATES_PER_KIND = 24

export type LifeWeatherTrack = 'time' | 'content' | 'structure'
export type LifeWeatherPhenomenon = 'sprouting' | 'recurrence' | 'atmosphere' | 'confluence'

export const LIFE_WEATHER_PHASE_AXES = [
  'boundaryExplicitness',
  'sourceBearing',
  'observationBearing',
  'proposalBearing',
  'revisionResidue',
  'provenanceTrace',
  'temporalTrace',
  'uncertainty'
] as const

export type LifeWeatherPhaseAxis = typeof LIFE_WEATHER_PHASE_AXES[number]

export interface LifeWeatherObservation {
  sourceNoteId: string
  observedAt: number | null
  contentFeatures: number[]
  linkTargets: string[]
  structureFeatures: {
    characterCount: number
    headingCount: number
    outboundLinkCount: number
  }
  phaseFeatures: Record<LifeWeatherPhaseAxis, number>
}

export interface LifeWeatherCandidate {
  id: string
  kind: LifeWeatherPhenomenon
  sourceNoteIds: string[]
  usedAttributes: Array<'observedAt' | 'contentFeatures' | 'linkTargets' | 'structureFeatures'>
  evidence: Record<string, number>
  selectionReasons: string[]
  uncertainty: string[]
}

export interface LifeWeatherStratum {
  index: number
  start: number
  end: number
  sourceNoteIds: string[]
  activityDensity: number
  contentNovelty: number
}

export interface LifeWeatherProfile {
  version: 1
  source: {
    noteCount: number
    timedNoteCount: number
    untimedNoteCount: number
    observedStart: number | null
    observedEnd: number | null
  }
  strata: LifeWeatherStratum[]
  phenomena: {
    sprouting: LifeWeatherCandidate[]
    recurrence: LifeWeatherCandidate[]
    atmosphere: LifeWeatherCandidate[]
    confluence: LifeWeatherCandidate[]
  }
  omittedPhenomenonCounts: Record<LifeWeatherPhenomenon, number>
  limitations: string[]
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'ja') || (left < right ? -1 : left > right ? 1 : 0)
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function contentFeatureCounts(content: string): Map<string, number> {
  const counts = new Map<string, number>()
  const tokens = content
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/^---[\s\S]*?---/u, ' ')
    .match(/[\p{L}\p{N}]+/gu) ?? []

  for (const token of tokens) {
    const features = token.length < 3
      ? [token]
      : [token, ...Array.from(token).slice(0, -1).map((character, index, all) => `${character}${all[index + 1]}`)]
    for (const feature of features) counts.set(feature, (counts.get(feature) ?? 0) + 1)
  }
  return counts
}

function contentFeatures(
  counts: ReadonlyMap<string, number>,
  documentFrequency: ReadonlyMap<string, number>,
  documentCount: number
): number[] {
  const vector = Array<number>(FEATURE_COUNT).fill(0)
  for (const [feature, count] of counts) {
    const weight = count * Math.log((documentCount + 1) / ((documentFrequency.get(feature) ?? 0) + 1))
    const hash = stableHash(feature)
    vector[hash % FEATURE_COUNT] += (hash & 0x80000000) === 0 ? weight : -weight
  }
  const magnitude = Math.hypot(...vector)
  return magnitude === 0 ? vector : vector.map((value) => round(value / magnitude))
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let value = 0
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index]
  return Math.max(0, Math.min(1, value))
}

function finiteTime(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function phaseFeatures(note: NoteDocument, maximumRevisionSpan: number): Record<LifeWeatherPhaseAxis, number> {
  const frontmatter = parseFrontmatter(note.content)
  const attributes = Object.fromEntries(
    Object.entries(frontmatter.attributes).map(([key, value]) => [key.toLocaleLowerCase(), value?.toLocaleLowerCase() ?? ''])
  )
  const boundaryKeys = ['type', 'kind', 'role', 'status', 'category', 'layer']
  const provenanceKeys = ['source', 'sources', 'origin', 'provenance', 'citation', 'reference', 'url']
  const temporalKeys = ['observed_at', 'created', 'created_at', 'updated', 'updated_at', 'valid_from', 'date']
  const metadata = Object.values(attributes).join(' ')
  const path = note.path.toLocaleLowerCase()
  const boundaryText = boundaryKeys.map((key) => attributes[key] ?? '').join(' ')
  const revisionSpan = Math.max(0, (finiteTime(note.modifiedAt) ?? 0) - (finiteTime(note.createdAt) ?? 0))
  const uncertaintySignal = /uncertain|unknown|unverified|provisional|draft|recheck|仮説|暫定|未確認|不明|要再確認/u.test(metadata)
  const signal = (pattern: RegExp, fallback: RegExp): number => pattern.test(boundaryText) || fallback.test(path) ? 1 : 0

  return {
    boundaryExplicitness: round(boundaryKeys.filter((key) => key in attributes).length / boundaryKeys.length),
    sourceBearing: signal(/source|reference|material|原典|資料/u, /(?:^|\/)40_|(?:^|\/)01_/u),
    observationBearing: signal(/observation|evidence|record|event|観測|記録|実施/u, /(?:^|\/)20_/u),
    proposalBearing: signal(/proposal|hypothesis|project|draft|提案|仮説|計画/u, /(?:^|\/)10_/u),
    revisionResidue: round(Math.log1p(revisionSpan / DAY_MS) / Math.max(1, Math.log1p(maximumRevisionSpan / DAY_MS))),
    provenanceTrace: round(provenanceKeys.filter((key) => key in attributes).length / provenanceKeys.length),
    temporalTrace: round(temporalKeys.filter((key) => key in attributes).length / temporalKeys.length),
    uncertainty: uncertaintySignal || frontmatter.warnings.length > 0 || note.createdAt === null ? 1 : 0
  }
}

export function createLifeWeatherObservations(
  notes: readonly NoteDocument[],
  graph: WikiGraph
): LifeWeatherObservation[] {
  const maximumRevisionSpan = Math.max(1, ...notes.map((note) =>
    Math.max(0, (finiteTime(note.modifiedAt) ?? 0) - (finiteTime(note.createdAt) ?? 0))
  ))
  const resolvedPaths = new Set(notes.map((note) => note.path))
  const linksBySource = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!resolvedPaths.has(edge.sourcePath) || !resolvedPaths.has(edge.targetPath)) continue
    const targets = linksBySource.get(edge.sourcePath) ?? []
    targets.push(edge.targetPath)
    linksBySource.set(edge.sourcePath, targets)
  }

  const featureCounts = notes.map((note) => contentFeatureCounts(note.content))
  const documentFrequency = new Map<string, number>()
  for (const counts of featureCounts) {
    for (const feature of counts.keys()) documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1)
  }

  return notes.map((note, index) => {
    const linkTargets = [...new Set(linksBySource.get(note.path) ?? [])].sort(compareText)
    return {
      sourceNoteId: note.path,
      observedAt: finiteTime(note.createdAt),
      contentFeatures: contentFeatures(featureCounts[index], documentFrequency, notes.length),
      linkTargets,
      structureFeatures: {
        characterCount: Array.from(note.content).length,
        headingCount: note.content.split(/\r?\n/u).filter((line) => /^#{1,6}\s/u.test(line)).length,
        outboundLinkCount: linkTargets.length
      },
      phaseFeatures: phaseFeatures(note, maximumRevisionSpan)
    }
  })
}

function candidateId(kind: LifeWeatherPhenomenon, ids: readonly string[], suffix = ''): string {
  return `${kind}:${stableHash(`${ids.join('\0')}:${suffix}`).toString(16).padStart(8, '0')}`
}

function meanPairSimilarity(observations: readonly LifeWeatherObservation[]): number {
  if (observations.length < 2) return 0
  let total = 0
  let pairs = 0
  for (let left = 0; left < observations.length; left += 1) {
    for (let right = left + 1; right < observations.length; right += 1) {
      total += cosine(observations[left].contentFeatures, observations[right].contentFeatures)
      pairs += 1
    }
  }
  return pairs === 0 ? 0 : total / pairs
}

function createStrata(
  timed: readonly LifeWeatherObservation[],
  origin: number
): Array<LifeWeatherStratum & { observations: LifeWeatherObservation[] }> {
  const byIndex = new Map<number, LifeWeatherObservation[]>()
  for (const observation of timed) {
    const index = Math.floor(((observation.observedAt as number) - origin) / (STRATUM_DAYS * DAY_MS))
    const entries = byIndex.get(index) ?? []
    entries.push(observation)
    byIndex.set(index, entries)
  }
  const maximumCount = Math.max(1, ...[...byIndex.values()].map((entries) => entries.length))

  return [...byIndex.entries()].sort(([left], [right]) => left - right).map(([index, observations]) => {
    const earlier = timed.filter((entry) => (entry.observedAt as number) < origin + index * STRATUM_DAYS * DAY_MS)
    const novelty = earlier.length === 0
      ? 1
      : observations.reduce((sum, entry) => sum + 1 - Math.max(
          ...earlier.map((candidate) => cosine(entry.contentFeatures, candidate.contentFeatures))
        ), 0) / observations.length
    return {
      index,
      start: origin + index * STRATUM_DAYS * DAY_MS,
      end: origin + (index + 1) * STRATUM_DAYS * DAY_MS,
      sourceNoteIds: observations.map((entry) => entry.sourceNoteId).sort(compareText),
      activityDensity: round(observations.length / maximumCount),
      contentNovelty: round(novelty),
      observations
    }
  })
}

export function createLifeWeatherProfile(
  observations: readonly LifeWeatherObservation[]
): LifeWeatherProfile {
  const timed = observations
    .filter((entry) => entry.observedAt !== null)
    .sort((left, right) => (left.observedAt as number) - (right.observedAt as number) || compareText(left.sourceNoteId, right.sourceNoteId))
  const observedStart = timed[0]?.observedAt ?? null
  const observedEnd = timed.at(-1)?.observedAt ?? null
  const strata = observedStart === null ? [] : createStrata(timed, observedStart)
  const stratumByNote = new Map(strata.flatMap((stratum) =>
    stratum.sourceNoteIds.map((id) => [id, stratum.index] as const)
  ))

  const sprouting = strata
    .filter((stratum) => stratum.sourceNoteIds.length >= 2 && (stratum.index === 0 || stratum.contentNovelty >= 0.35))
    .map((stratum): LifeWeatherCandidate => ({
      id: candidateId('sprouting', stratum.sourceNoteIds, String(stratum.index)),
      kind: 'sprouting',
      sourceNoteIds: stratum.sourceNoteIds,
      usedAttributes: ['observedAt', 'contentFeatures'],
      evidence: {
        stratumIndex: stratum.index,
        noteCount: stratum.sourceNoteIds.length,
        activityDensity: stratum.activityDensity,
        contentNovelty: stratum.contentNovelty
      },
      selectionReasons: ['同じ観測層に複数の分節が生まれた', '以前の層との差異を保っている'],
      uncertainty: ['観測時点は真の執筆時点や経験時点を意味しない']
    }))

  const recurrence: LifeWeatherCandidate[] = []
  for (let right = 0; right < timed.length; right += 1) {
    const earlier = timed.slice(0, right)
      .map((entry) => ({
        entry,
        separationDays: ((timed[right].observedAt as number) - (entry.observedAt as number)) / DAY_MS,
        similarity: cosine(entry.contentFeatures, timed[right].contentFeatures)
      }))
      .filter((candidate) => candidate.separationDays >= STRATUM_DAYS)
      .sort((left, rightCandidate) =>
        rightCandidate.similarity - left.similarity ||
        rightCandidate.separationDays - left.separationDays ||
        compareText(left.entry.sourceNoteId, rightCandidate.entry.sourceNoteId)
      )[0]
    if (!earlier || earlier.similarity < 0.3) continue
    const ids = [earlier.entry.sourceNoteId, timed[right].sourceNoteId]
    recurrence.push({
      id: candidateId('recurrence', ids),
      kind: 'recurrence',
      sourceNoteIds: ids,
      usedAttributes: ['observedAt', 'contentFeatures'],
      evidence: { contentSimilarity: round(earlier.similarity), separationDays: round(earlier.separationDays) },
      selectionReasons: ['離れた観測層で最も近い内容特徴が再び現れた'],
      uncertainty: ['内容特徴の近さは意味の同一性を確定しない']
    })
  }
  recurrence.sort((left, right) =>
    right.evidence.contentSimilarity - left.evidence.contentSimilarity ||
    right.evidence.separationDays - left.evidence.separationDays ||
    compareText(left.id, right.id)
  )

  const atmosphere = strata
    .filter((stratum) => stratum.observations.length >= 3)
    .map((stratum) => ({ stratum, spread: 1 - meanPairSimilarity(stratum.observations) }))
    .map(({ stratum, spread }): LifeWeatherCandidate => ({
      id: candidateId('atmosphere', stratum.sourceNoteIds, String(stratum.index)),
      kind: 'atmosphere',
      sourceNoteIds: stratum.sourceNoteIds,
      usedAttributes: ['observedAt', 'contentFeatures', 'structureFeatures'],
      evidence: {
        stratumIndex: stratum.index,
        noteCount: stratum.sourceNoteIds.length,
        contentSpread: round(spread),
        structureSpread: round(Math.max(...stratum.observations.map((entry) => entry.structureFeatures.headingCount))
          - Math.min(...stratum.observations.map((entry) => entry.structureFeatures.headingCount)))
      },
      selectionReasons: ['同じ観測層に異なる内容と構造が共存した'],
      uncertainty: ['同時期性だけではノート間の直接関係を意味しない']
    }))

  const observationById = new Map(observations.map((entry) => [entry.sourceNoteId, entry]))
  const confluence = timed.flatMap((entry): LifeWeatherCandidate[] => {
    const sourceStratum = stratumByNote.get(entry.sourceNoteId)
    const linkedOlder = entry.linkTargets
      .map((id) => observationById.get(id))
      .filter((target): target is LifeWeatherObservation => target?.observedAt !== null &&
        (target?.observedAt as number) < (entry.observedAt as number))
    const linkedStrata = new Set(linkedOlder.map((target) => stratumByNote.get(target.sourceNoteId)))
    linkedStrata.delete(undefined)
    if (sourceStratum === undefined || linkedStrata.size < 2) return []
    const ids = [entry.sourceNoteId, ...linkedOlder.map((target) => target.sourceNoteId).sort(compareText)]
    return [{
      id: candidateId('confluence', ids),
      kind: 'confluence',
      sourceNoteIds: ids,
      usedAttributes: ['observedAt', 'linkTargets'],
      evidence: { sourceStratum, linkedStrata: linkedStrata.size, linkCount: linkedOlder.length },
      selectionReasons: ['後発ノートが複数の以前の観測層を明示的に結んだ'],
      uncertainty: ['現在のリンクから過去のリンク状態は復元しない']
    }]
  })
  confluence.sort((left, right) =>
    right.evidence.linkedStrata - left.evidence.linkedStrata ||
    right.evidence.linkCount - left.evidence.linkCount ||
    compareText(left.id, right.id)
  )

  return {
    version: 1,
    source: {
      noteCount: observations.length,
      timedNoteCount: timed.length,
      untimedNoteCount: observations.length - timed.length,
      observedStart,
      observedEnd
    },
    strata: strata.map(({ observations: _observations, ...stratum }) => stratum),
    phenomena: {
      sprouting: sprouting.slice(0, MAX_CANDIDATES_PER_KIND),
      recurrence: recurrence.slice(0, MAX_CANDIDATES_PER_KIND),
      atmosphere: atmosphere.slice(0, MAX_CANDIDATES_PER_KIND),
      confluence: confluence.slice(0, MAX_CANDIDATES_PER_KIND)
    },
    omittedPhenomenonCounts: {
      sprouting: Math.max(0, sprouting.length - MAX_CANDIDATES_PER_KIND),
      recurrence: Math.max(0, recurrence.length - MAX_CANDIDATES_PER_KIND),
      atmosphere: Math.max(0, atmosphere.length - MAX_CANDIDATES_PER_KIND),
      confluence: Math.max(0, confluence.length - MAX_CANDIDATES_PER_KIND)
    },
    limitations: [
      '観測時点は真の執筆時点・経験時点・取込時点を区別しない',
      '時点不明のノートを時間現象の根拠に使用しない',
      '現在のリンクから過去の関係状態を復元しない',
      '候補は存在相そのものではなく現在条件による局所的な観測表現である'
    ]
  }
}

export function shuffleLifeWeatherTrack(
  observations: readonly LifeWeatherObservation[],
  track: LifeWeatherTrack,
  seed: string
): LifeWeatherObservation[] {
  if (observations.length < 2) return observations.map((entry) => ({ ...entry }))
  const offset = 1 + stableHash(seed) % (observations.length - 1)
  return observations.map((entry, index) => {
    const donor = observations[(index + offset) % observations.length]
    if (track === 'time') return { ...entry, observedAt: donor.observedAt }
    if (track === 'content') return { ...entry, contentFeatures: [...donor.contentFeatures] }
    return { ...entry, structureFeatures: { ...donor.structureFeatures } }
  })
}

export function withoutLifeWeatherLinks(
  observations: readonly LifeWeatherObservation[]
): LifeWeatherObservation[] {
  return observations.map((entry) => ({
    ...entry,
    linkTargets: [],
    structureFeatures: { ...entry.structureFeatures, outboundLinkCount: 0 }
  }))
}
