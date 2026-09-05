import { describe, expect, it } from 'vitest'
import type { WikiGraph } from '../src/core/graph'
import {
  createLifeWeatherObservations,
  createLifeWeatherProfile,
  shuffleLifeWeatherTrack,
  withoutLifeWeatherLinks
} from '../src/core/life-weather'
import type { NoteDocument } from '../src/shared/types'

const DAY = 24 * 60 * 60 * 1000
const START = Date.UTC(2026, 6, 30)

function note(
  path: string,
  day: number,
  content: string,
  modifiedDay = day
): NoteDocument {
  return {
    path,
    name: path.replace(/\.md$/, ''),
    content,
    createdAt: START + day * DAY,
    modifiedAt: START + modifiedDay * DAY,
    size: content.length
  }
}

function fixture(): { notes: NoteDocument[]; graph: WikiGraph } {
  const notes = [
    note('芽A.md', 0, '# 光の研究\n量子、光、宇宙、波、観測について考える。'),
    note('空気B.md', 1, '# 料理の記録\n味噌、鍋、香り、食卓、季節について記す。'),
    note('空気C.md', 2, '# 散歩の記録\n森、雨、靴、道、風景について記す。'),
    note('回帰D.md', 18, '# 光の再訪\n量子、光、宇宙、波、観測を改めて考える。'),
    note('橋E.md', 25, '# 結び直し\n異なる時期の考察を一緒に読む。')
  ]
  return {
    notes,
    graph: {
      nodes: notes.map((entry) => ({
        path: entry.path,
        name: entry.name,
        kind: 'note',
        exists: true,
        createdAt: entry.createdAt
      })),
      edges: [
        { sourcePath: '橋E.md', targetPath: '芽A.md' },
        { sourcePath: '橋E.md', targetPath: '回帰D.md' }
      ]
    }
  }
}

describe('TSUZUNE LIFE Weather profile', () => {
  it('turns every timed note into a traceable observation without retaining its text', () => {
    const { notes, graph } = fixture()
    const observations = createLifeWeatherObservations(notes, graph)
    const serialized = JSON.stringify(observations)

    expect(observations).toHaveLength(notes.length)
    expect(observations.map((entry) => entry.sourceNoteId)).toEqual(notes.map((entry) => entry.path))
    expect(observations.every((entry) => entry.contentFeatures.length === 128)).toBe(true)
    expect(observations.every((entry) => Object.keys(entry.phaseFeatures).length === 8)).toBe(true)
    expect(serialized).not.toContain('量子、光、宇宙')
    expect(serialized).not.toContain('味噌、鍋、香り')
  })

  it('keeps provenance, uncertainty, record boundary, and revision history as separate phase observations', () => {
    const source = note(
      '40_資料/原典.md',
      0,
      '---\ntype: source\nsource: local archive\nobserved_at: 2026-07-30\nstatus: unverified\n---\n# 原典',
      12
    )
    const proposal = note('10_プロジェクト/仮説.md', 1, '---\ntype: proposal\n---\n# 仮説')
    const observations = createLifeWeatherObservations([source, proposal], { nodes: [], edges: [] })

    expect(observations[0].phaseFeatures).toMatchObject({
      sourceBearing: 1,
      proposalBearing: 0,
      revisionResidue: 1,
      uncertainty: 1
    })
    expect(observations[0].phaseFeatures.provenanceTrace).toBeGreaterThan(0)
    expect(observations[0].phaseFeatures.temporalTrace).toBeGreaterThan(0)
    expect(observations[1].phaseFeatures).toMatchObject({ sourceBearing: 0, proposalBearing: 1 })
    expect(observations[1].phaseFeatures.revisionResidue).toBe(0)
  })

  it('derives first-era strata, sprouting, recurrence, atmosphere, and confluence with separate evidence', () => {
    const { notes, graph } = fixture()
    const profile = createLifeWeatherProfile(createLifeWeatherObservations(notes, graph))

    expect(profile.source.noteCount).toBe(5)
    expect(profile.source.observedStart).toBe(START)
    expect(profile.source.observedEnd).toBe(START + 25 * DAY)
    expect(profile.strata.length).toBeGreaterThanOrEqual(3)
    expect(profile.phenomena.sprouting.length).toBeGreaterThan(0)
    expect(profile.phenomena.recurrence.some((candidate) =>
      candidate.sourceNoteIds.includes('芽A.md') && candidate.sourceNoteIds.includes('回帰D.md')
    )).toBe(true)
    expect(profile.phenomena.atmosphere.some((candidate) => candidate.sourceNoteIds.length >= 3)).toBe(true)
    expect(profile.phenomena.confluence.some((candidate) => candidate.sourceNoteIds[0] === '橋E.md')).toBe(true)
    expect(profile.phenomena.recurrence[0].evidence).toHaveProperty('contentSimilarity')
    expect(profile.phenomena.recurrence[0].evidence).toHaveProperty('separationDays')
    expect(profile.omittedPhenomenonCounts).toEqual({
      sprouting: 0,
      recurrence: 0,
      atmosphere: 0,
      confluence: 0
    })
    expect(profile).not.toHaveProperty('importanceScore')
  })

  it('changes the relevant phenomena when time, content, or explicit links are changed', () => {
    const { notes, graph } = fixture()
    const observations = createLifeWeatherObservations(notes, graph)
    const baseline = createLifeWeatherProfile(observations)
    const timeShuffled = createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'time', 'test-time'))
    const contentShuffled = createLifeWeatherProfile(shuffleLifeWeatherTrack(observations, 'content', 'test-content'))
    const linksRemoved = createLifeWeatherProfile(withoutLifeWeatherLinks(observations))

    expect(timeShuffled.phenomena.recurrence).not.toEqual(baseline.phenomena.recurrence)
    expect(contentShuffled.phenomena.recurrence).not.toEqual(baseline.phenomena.recurrence)
    expect(linksRemoved.phenomena.confluence).toEqual([])
    expect(linksRemoved.phenomena.sprouting.length).toBeGreaterThan(0)
  })

  it('keeps missing time explicit instead of substituting modified time', () => {
    const untimed = note('時点不明.md', 0, '時点が分からないノート')
    untimed.createdAt = null
    untimed.modifiedAt = START + 99 * DAY
    const observations = createLifeWeatherObservations([untimed], { nodes: [], edges: [] })
    const profile = createLifeWeatherProfile(observations)

    expect(observations[0].observedAt).toBeNull()
    expect(profile.source.timedNoteCount).toBe(0)
    expect(profile.source.untimedNoteCount).toBe(1)
    expect(profile.source.observedStart).toBeNull()
    expect(profile.limitations).toContain('時点不明のノートを時間現象の根拠に使用しない')
  })

  it('reproduces the same profile from the same observations', () => {
    const { notes, graph } = fixture()
    const observations = createLifeWeatherObservations(notes, graph)

    expect(createLifeWeatherProfile(observations)).toEqual(createLifeWeatherProfile(observations))
  })
})
