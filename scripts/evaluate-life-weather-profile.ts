import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildWikiGraph } from '../src/core/graph'
import {
  createLifeWeatherObservations,
  createLifeWeatherProfile,
  shuffleLifeWeatherTrack,
  withoutLifeWeatherLinks,
  type LifeWeatherProfile
} from '../src/core/life-weather'
import { createExcludedFileMatcher, parseUserIgnoreFilters } from '../src/shared/excluded-files'
import { VaultService } from '../src/main/vault'

interface StoredSettings {
  lastVaultPath?: unknown
  userIgnoreFilters?: unknown
}

function signature(profile: LifeWeatherProfile): string {
  const candidateIds = Object.values(profile.phenomena)
    .flat()
    .map((candidate) => candidate.id)
    .sort()
  return createHash('sha256').update(JSON.stringify({
    strata: profile.strata.map((stratum) => ({
      index: stratum.index,
      count: stratum.sourceNoteIds.length,
      density: stratum.activityDensity,
      novelty: stratum.contentNovelty
    })),
    candidateIds
  })).digest('hex')
}

function counts(profile: LifeWeatherProfile): Record<string, number> {
  return Object.fromEntries(Object.entries(profile.phenomena).map(([kind, candidates]) => [kind, candidates.length]))
}

async function main(): Promise<void> {
  const startedAt = performance.now()
  const appData = process.env.APPDATA
  if (!appData) throw new Error('APPDATA is unavailable')
  const settings = JSON.parse(await readFile(join(appData, 'TSUZUNE', 'settings.json'), 'utf8')) as StoredSettings
  if (typeof settings.lastVaultPath !== 'string') throw new Error('TSUZUNE has no active Vault')

  const vault = new VaultService()
  await vault.setRootPath(settings.lastVaultPath)
  const snapshot = await vault.scan(parseUserIgnoreFilters(settings.userIgnoreFilters))
  const isNormalDiscoveryExcluded = createExcludedFileMatcher(['50_履歴'])
  const notes = snapshot.notes.filter((note) => !isNormalDiscoveryExcluded(note.path))
  const observations = createLifeWeatherObservations(notes, buildWikiGraph(notes))
  const baseline = createLifeWeatherProfile(observations)
  const variants = {
    timeShuffled: createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'time', 'gate-1-time')),
    contentShuffled: createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'content', 'gate-1-content')),
    linksRemoved: createLifeWeatherProfile(withoutLifeWeatherLinks(observations))
  }
  const baselineSignature = signature(baseline)

  console.log(JSON.stringify({
    profileVersion: baseline.version,
    source: {
      ...baseline.source,
      observedStart: baseline.source.observedStart === null ? null : new Date(baseline.source.observedStart).toISOString(),
      observedEnd: baseline.source.observedEnd === null ? null : new Date(baseline.source.observedEnd).toISOString()
    },
    stratumCount: baseline.strata.length,
    phenomenonCounts: counts(baseline),
    omittedPhenomenonCounts: baseline.omittedPhenomenonCounts,
    baselineSignature,
    causalChecks: {
      timeShuffleChangedProfile: signature(variants.timeShuffled) !== baselineSignature,
      contentShuffleChangedProfile: signature(variants.contentShuffled) !== baselineSignature,
      linkRemovalChangedProfile: signature(variants.linksRemoved) !== baselineSignature,
      confluenceWithoutLinks: variants.linksRemoved.phenomena.confluence.length
    },
    evaluationMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100
  }, null, 2))
}

await main()
