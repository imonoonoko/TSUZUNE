import { describe, expect, it } from 'vitest'
import { buildContextSetFromSnapshot } from '../src/mcp/context-set'
import type { NoteDocument, VaultSnapshot } from '../src/shared/types'

function note(path: string, content: string): NoteDocument {
  return { path, name: path.replace(/\.md$/, ''), content, modifiedAt: 0, size: Buffer.byteLength(content) }
}
function snapshot(notes: NoteDocument[]): VaultSnapshot {
  return { rootPath: 'fixture', rootName: 'fixture', directories: [], notes }
}
const now = { generatedAt: '2026-10-01T00:00:00.000Z' }

describe('multi-seed context', () => {
  it('deduplicates canonical seeds and shared bodies while retaining revisions and owners', () => {
    const a = note('設計.md', '# 設計\n[[共有]]'), b = note('運用.md', '# 運用\n[[共有]]')
    const shared = note('共有.md', '# 共有\nSHARED_BODY')
    const input = snapshot([a, b, shared])
    input.pathAliases = { '旧設計.md': a.path }
    // The service resolves old IDs before calling this canonical-note API.
    const result = buildContextSetFromSnapshot(input, [a, b, a], { ...now, revisionFor: (source) => `rev:${source.path}` })
    expect(result.seedIds).toEqual([a.path, b.path])
    expect(result.markdown.match(/SHARED_BODY/g)).toHaveLength(1)
    expect(result.included.find((source) => source.path === shared.path)).toMatchObject({ revision: 'rev:共有.md', seedIds: [a.path, b.path] })
    expect(result.markdown).toContain('Revision: rev:共有.md')
  })
  it('rejects the whole set for a missing seed and invalid bounds', () => {
    const a = note('A.md', '# A')
    expect(() => buildContextSetFromSnapshot(snapshot([a]), [a, note('Missing.md', '')])).toThrow('Missing.md')
    expect(() => buildContextSetFromSnapshot(snapshot([a]), [])).toThrow()
    expect(() => buildContextSetFromSnapshot(snapshot([a]), Array(9).fill(a))).toThrow()
    expect(() => buildContextSetFromSnapshot(snapshot([a]), [a], { maxCharacters: 999 })).toThrow()
  })
  it('gives long seeds fair budgets before related notes at every supported scale', () => {
    const a = note('A.md', '# A\nA_BODY\n' + 'a'.repeat(6000) + '\n[[Related]]')
    const b = note('B.md', '# B\nB_BODY\n' + 'b'.repeat(6000))
    const related = note('Related.md', '# Related\nRELATED_BODY')
    for (const maxCharacters of [1000, 2000, 15000, 100000]) {
      const result = buildContextSetFromSnapshot(snapshot([a, b, related]), [a, b], { ...now, maxCharacters })
      expect(result.characterCount).toBeLessThanOrEqual(maxCharacters)
      expect(result.characterCount).toBe(result.markdown.length)
      expect(result.markdown).toContain('A_BODY')
      expect(result.markdown).toContain('B_BODY')
      if (maxCharacters === 1000) {
        expect(result.omittedPaths).toContain(related.path)
        expect(result.markdown).not.toContain('RELATED_BODY')
      }
    }
  })
  it('projects Japanese query sections with explicit omissions', () => {
    const a = note('設計.md', '# 設計\n## 検索性能\n検索速度を改善する。\n' + '速'.repeat(4000) + '\n## 配色\nCOLOR_ONLY\n' + '色'.repeat(4000))
    const b = note('運用.md', '# 運用\n## 検索性能\n検索速度の検証。\n' + '測'.repeat(4000) + '\n## 配色\nCOLOR_OTHER')
    const result = buildContextSetFromSnapshot(snapshot([a, b]), [a, b], { ...now, maxCharacters: 2000, query: '検索性能' })
    expect(result.markdown).toContain('検索速度を改善')
    expect(result.markdown).toContain('検索速度の検証')
    expect(result.markdown).not.toContain('COLOR_ONLY')
    expect(result.included.every((source) => source.contentMode === 'section_projection')).toBe(true)
    expect(result.included[0].omittedSections).toContain('配色')
    expect(result.included[0].includedSections).toContain('検索性能')
  })
  it('keeps distinct subjects current state lineage separate', () => {
    const a = note('A.md', '# A'), b = note('B.md', '# B')
    const state = (path: string, subject: string, status: string) => note(path, `---\nkind: state\nsubject: "[[${subject}]]"\nstatus: ${status}\nvalid_from: 2026-01-01\nobserved_at: 2026-01-02\n---\n# 状態\n${status}`)
    const result = buildContextSetFromSnapshot(snapshot([a, b, state('A-state.md', 'A', 'active'), state('B-state.md', 'B', 'paused')]), [a, b], now)
    expect(result.seeds[0].stateLineage.currentStates.map((entry) => entry.path)).toEqual(['A-state.md'])
    expect(result.seeds[1].stateLineage.currentStates.map((entry) => entry.path)).toEqual(['B-state.md'])
    expect(result.seeds.every((seed) => seed.stateLineage.conflictPaths.length === 0)).toBe(true)
  })
  it('identifies an omitted later occurrence of the same heading', () => {
    const a = note('A.md', '# A\n## Repeated\nFIRST_BODY\n' + 'a'.repeat(3000) + '\n## Repeated\nSECOND_BODY')
    const result = buildContextSetFromSnapshot(snapshot([a]), [a], { ...now, maxCharacters: 1000 })
    expect(result.included[0].includedSections).toContain('Repeated (1; line 2)')
    expect(result.included[0].omittedSections).toContain('Repeated (2; line 5)')
    expect(result.markdown).not.toContain('SECOND_BODY')
  })
  it('uses actual projection positions to identify the later identical heading and body prefix', () => {
    const a = note('A.md', '# A\n## Repeated\nSAME_PREFIX\n' + 'a'.repeat(3000) + '\n## Repeated\nSAME_PREFIX\nTARGET_QUERY\n' + 'b'.repeat(3000))
    const result = buildContextSetFromSnapshot(snapshot([a]), [a], { ...now, maxCharacters: 1000, query: 'TARGET_QUERY' })
    expect(result.included[0].includedSections).toContain('Repeated (2; line 5)')
    expect(result.included[0].omittedSections).toContain('Repeated (1; line 2)')
    expect(result.included[0].truncated).toBe(true)
    expect(result.markdown).toContain('[このノートは文字数上限で省略されました]')
    expect(result.characterCount).toBeLessThanOrEqual(1000)
  })
  it('preserves original positions inside a projected branch with frontmatter and indented headings', () => {
    const a = note('A.md', '---\ntag: test\n---\n# A\n## Branch\n  ### Repeated\nFIRST\n' + 'x'.repeat(3000) + '\n## Other\n  ### Repeated\nTARGET_QUERY\n' + 'y'.repeat(3000))
    for (const query of ['TARGET_QUERY', 'Other']) {
      const result = buildContextSetFromSnapshot(snapshot([a]), [a], { ...now, maxCharacters: 1500, query })
      expect(result.included[0].includedSections).toContain('Repeated (2; line 10)')
      expect(result.included[0].omittedSections).toContain('Repeated (1; line 6)')
      expect(result.included[0].includedSections).toContain('Other')
    }
  })
  it('attributes Setext headings and ignores code fence headings', () => {
    const a = note('A.md', 'Setext title\n===\nbody\nSubsection\n---\nbody\n```md\n# Fake heading\n```')
    const result = buildContextSetFromSnapshot(snapshot([a]), [a], now)
    expect(result.included[0].includedSections).toEqual(['Setext title', 'Subsection'])
    expect(result.included[0].omittedSections).toEqual([])
  })
  it('does not reveal future or unknown-knowledge seed bodies', () => {
    const future = note('Future.md', '---\nkind: state\nsubject: "[[Project]]"\nstatus: active\nvalid_from: 2027-01-01\n---\nFUTURE_SECRET')
    const unknown = note('Unknown.md', '---\nkind: state\nsubject: "[[Other]]"\nstatus: active\nvalid_from: 2026-01-01\n---\nUNKNOWN_SECRET')
    const result = buildContextSetFromSnapshot(snapshot([future, unknown]), [future, unknown], { ...now, temporalPerspective: 'knowledge-time' })
    expect(result.markdown).not.toContain('FUTURE_SECRET')
    expect(result.markdown).not.toContain('UNKNOWN_SECRET')
    expect(result.included.every((source) => source.contentOmitted)).toBe(true)
    expect(result.omittedPaths).toEqual(expect.arrayContaining([future.path, unknown.path]))
    expect(result.seeds[1].warnings.some((warning) => warning.code === 'UNKNOWN_OBSERVED_AT')).toBe(true)
  })
  it('reports seed omission when eight envelopes cannot fit a small budget', () => {
    const notes = Array.from({ length: 8 }, (_, position) => note(`${position}.md`, '# Note\n' + 'body'.repeat(100)))
    const result = buildContextSetFromSnapshot(snapshot(notes), notes, { ...now, maxCharacters: 1000 })
    expect(result.characterCount).toBeLessThanOrEqual(1000)
    for (const seed of result.seedIds) {
      expect(result.included.some((source) => source.path === seed) || result.omittedPaths.includes(seed)).toBe(true)
    }
    expect(result.seeds.filter((seed) => seed.contentOmitted).every((seed) => seed.omittedSections.includes('Note'))).toBe(true)
  })
})
