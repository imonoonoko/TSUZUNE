import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildWikiGraph } from '../src/core/graph'
import {
  createLifeWeatherObservations,
  createLifeWeatherProfile,
  LIFE_WEATHER_PHASE_AXES,
  shuffleLifeWeatherTrack,
  withoutLifeWeatherLinks,
  type LifeWeatherObservation,
  type LifeWeatherProfile
} from '../src/core/life-weather'
import { VaultService } from '../src/main/vault'
import { createExcludedFileMatcher, parseUserIgnoreFilters } from '../src/shared/excluded-files'

interface StoredSettings {
  lastVaultPath?: unknown
  userIgnoreFilters?: unknown
}

const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const opaqueId = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 16)

function foldContent(features: readonly number[]): number[] {
  const folded = Array<number>(12).fill(0)
  features.forEach((value, index) => { folded[index % folded.length] += value })
  const magnitude = Math.hypot(...folded)
  return magnitude === 0 ? folded : folded.map((value) => round(value / magnitude))
}

function serializeProfile(profile: LifeWeatherProfile, indexByPath: ReadonlyMap<string, number>): object {
  const serializeCandidate = (candidate: LifeWeatherProfile['phenomena']['sprouting'][number]) => ({
    id: candidate.id,
    kind: candidate.kind,
    sourceIndices: candidate.sourceNoteIds
      .map((path) => indexByPath.get(path))
      .filter((index): index is number => index !== undefined),
    evidence: candidate.evidence
  })
  const phenomena = Object.fromEntries(Object.entries(profile.phenomena).map(([kind, candidates]) => [
    kind,
    candidates.map(serializeCandidate)
  ]))
  const value = {
    version: profile.version,
    source: profile.source,
    strata: profile.strata.map((stratum) => ({
      index: stratum.index,
      start: stratum.start,
      end: stratum.end,
      sourceIndices: stratum.sourceNoteIds
        .map((path) => indexByPath.get(path))
        .filter((index): index is number => index !== undefined),
      activityDensity: stratum.activityDensity,
      contentNovelty: stratum.contentNovelty
    })),
    phenomena,
    omittedPhenomenonCounts: profile.omittedPhenomenonCounts
  }
  return {
    ...value,
    fingerprint: createHash('sha256').update(JSON.stringify(value)).digest('hex')
  }
}

function buildParticles(observations: readonly LifeWeatherObservation[]): object[] {
  const timed = observations.map((entry) => entry.observedAt).filter((value): value is number => value !== null)
  const start = Math.min(...timed)
  const span = Math.max(1, Math.max(...timed) - start)
  const maxCharacters = Math.max(1, ...observations.map((entry) => Math.log1p(entry.structureFeatures.characterCount)))
  const maxHeadings = Math.max(1, ...observations.map((entry) => entry.structureFeatures.headingCount))
  const maxLinks = Math.max(1, ...observations.map((entry) => entry.structureFeatures.outboundLinkCount))
  const indexByPath = new Map(observations.map((entry, index) => [entry.sourceNoteId, index]))

  return observations.map((entry) => {
    const time = entry.observedAt === null ? .5 : (entry.observedAt - start) / span
    const characters = Math.log1p(entry.structureFeatures.characterCount) / maxCharacters
    const headings = entry.structureFeatures.headingCount / maxHeadings
    const links = entry.structureFeatures.outboundLinkCount / maxLinks
    return {
      id: opaqueId(entry.sourceNoteId),
      label: entry.sourceNoteId.replace(/\\/g, '/').split('/').at(-1)?.replace(/\.md/gi, '') ?? '名称未取得',
      content: foldContent(entry.contentFeatures),
      time: [round(time), round(Math.sin(time * Math.PI * 2)), round(Math.cos(time * Math.PI * 2))],
      structure: [
        round(characters),
        round(headings),
        round(links),
        round(headings / Math.max(characters, .01)),
        round(links / Math.max(characters, .01)),
        entry.observedAt === null ? 0 : 1
      ],
      phase: LIFE_WEATHER_PHASE_AXES.map((axis) => round(entry.phaseFeatures[axis])),
      links: entry.linkTargets
        .map((path) => indexByPath.get(path))
        .filter((index): index is number => index !== undefined)
    }
  })
}

async function main(): Promise<void> {
  const appData = process.env.APPDATA
  if (!appData) throw new Error('APPDATA is unavailable')
  const settings = JSON.parse(await readFile(join(appData, 'TSUZUNE', 'settings.json'), 'utf8')) as StoredSettings
  if (typeof settings.lastVaultPath !== 'string') throw new Error('TSUZUNE has no active Vault')

  const vault = new VaultService()
  await vault.setRootPath(settings.lastVaultPath)
  const scanned = await vault.scan(parseUserIgnoreFilters(settings.userIgnoreFilters))
  const excluded = createExcludedFileMatcher(['50_履歴'])
  const notes = scanned.notes.filter((note) => !excluded(note.path))
  const graph = buildWikiGraph(notes)
  const observations = createLifeWeatherObservations(notes, graph)
  const indexByPath = new Map(observations.map((entry, index) => [entry.sourceNoteId, index]))
  const particles = buildParticles(observations)
  const baseline = serializeProfile(createLifeWeatherProfile(observations), indexByPath)
  const controls = {
    timeShuffled: serializeProfile(createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'time', 'gate-2-time')), indexByPath),
    contentShuffled: serializeProfile(createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'content', 'gate-2-content')), indexByPath),
    linksRemoved: serializeProfile(createLifeWeatherProfile(withoutLifeWeatherLinks(observations)), indexByPath)
  }
  const resolvedLinks = particles.reduce((sum, particle) => sum + (particle as { links: number[] }).links.length, 0)
  const snapshotCore = {
    schema: 'tsuzune-note-particles/v3',
    observedAt: new Date().toISOString(),
    source: 'active TSUZUNE Vault excluding protected history',
    exclusions: ['50_履歴', ...parseUserIgnoreFilters(settings.userIgnoreFilters)],
    noteCount: particles.length,
    trackDimensions: {
      content: 12,
      time: 3,
      structure: 6,
      phase: LIFE_WEATHER_PHASE_AXES,
      links: 'resolved note indices'
    },
    linkResolution: { resolved: resolvedLinks },
    notes: particles,
    lifeWeather: baseline
  }
  const snapshot = {
    ...snapshotCore,
    fingerprint: createHash('sha256').update(JSON.stringify(snapshotCore)).digest('hex')
  }
  const output = `// Generated from the active Vault. Contains opaque note identifiers and numeric observations only.\n` +
    `export const noteSnapshot = Object.freeze(${JSON.stringify(snapshot, null, 2)})\n\n` +
    `export const lifeWeatherControls = Object.freeze(${JSON.stringify(controls, null, 2)})\n`
  const outputPath = join(process.cwd(), 'work', 'archive-weather-prototype', 'note-snapshot.mjs')
  await writeFile(outputPath, output, 'utf8')
  console.log(JSON.stringify({ outputPath, noteCount: particles.length, fingerprint: snapshot.fingerprint }, null, 2))
}

await main()
