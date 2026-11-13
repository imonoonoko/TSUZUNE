import { describe, expect, it } from 'vitest'
import { searchAdvancedNotes, isAdvancedSearchQuery } from '../src/core/advanced-search'
import { searchRendererRanked, searchResultContextRanges } from '../src/core/search'
import type { NoteDocument } from '../src/shared/types'

const note = (name: string, content: string): NoteDocument => ({ path: name + '.md', name, content, modifiedAt: 1, createdAt: 1, size: content.length })
const paths = (notes: NoteDocument[], query: string) => searchAdvancedNotes(notes, query).map(x => x.name).sort()
describe('advanced search public behavior', () => {
  const animals = [note('a', 'cat'), note('b', 'dog walk'), note('c', 'dog'), note('d', 'bird walk')]
  it('groups OR below implicit AND and supports negated groups', () => {
    expect(paths(animals, 'cat OR dog walk')).toEqual(['a', 'b'])
    expect(paths(animals, '(cat OR dog) walk')).toEqual(['b'])
    expect(paths(animals, '-(cat OR dog)')).toEqual(['d'])
  })
  it('preserves ordinary Japanese, metadata and quoted search results', () => {
    const notes = [note('設計', '---\ncategory: 開発\ntopics: [設計, UI]\n---\nノートの検索と設計'), note('別', '散歩')]
    for (const query of ['検索と設計', 'category:開発', 'topic:UI', '"ノートの検索"', '-散歩']) {
      expect(searchAdvancedNotes(notes, query)).toEqual(searchRendererRanked(notes, query))
    }
  })
  it('applies expressions to one line, block or section', () => {
    const notes = [note('same', '# First\ncat dog\n\n# Next\nbird'), note('lines', '# First\ncat\ndog'), note('blocks', '# First\ncat\n\ndog'), note('sections', '# First\ncat\n# Next\ndog')]
    expect(paths(notes, 'line:(cat dog)')).toEqual(['same'])
    expect(paths(notes, 'block:(cat dog)')).toEqual(['lines', 'same'])
    expect(paths(notes, 'section:(cat dog)')).toEqual(['blocks', 'lines', 'same'])
  })
  it('does not count fenced/frontmatter checkboxes or nested tasks as parent task text', () => {
    const notes = [note('real', '- [ ] parent\n  - [x] child'), note('fake', '---\ntext: "- [ ] fake"\n---\n~~~md\n- [ ] fake\n~~~')]
    expect(paths(notes, 'task-todo:parent')).toEqual(['real'])
    expect(paths(notes, 'task-todo:child')).toEqual([])
    expect(paths(notes, 'task-done:child')).toEqual(['real'])
    expect(paths(notes, 'task:fake')).toEqual([])
  })
  it('never escapes an outer structural scope through a nested scope', () => {
    const notes = [note('split', 'cat\ndog'), note('same', 'cat dog')]
    expect(paths(notes, 'line:(cat content:dog)')).toEqual(['same'])
    expect(paths(notes, 'line:(cat line:dog)')).toEqual(['same'])
    expect(paths(notes, 'line:(cat block:dog)')).toEqual(['same'])
  })
  it('allows zero-length regex matches in empty content and empty lines', () => {
    expect(paths([note('empty', ''), note('filled', 'cat')], 'content:/^$/')).toEqual(['empty'])
    expect(paths([note('blank', 'cat\n\ndog'), note('filled', 'cat\ndog')], 'line:/^$/')).toEqual(['blank'])
  })
  it('honors content-only and explicit case scopes', () => {
    const notes = [note('API', 'api text'), note('other', 'API text')]
    expect(paths(notes, 'content:API')).toEqual(['API', 'other'])
    expect(paths(notes, 'content:match-case:API')).toEqual(['other'])
    expect(paths(notes, 'ignore-case:(api TEXT)')).toEqual(['API', 'other'])
  })
  it('evaluates regex, flags and slash escapes with exact original source excerpts', () => {
    const source = 'İ😀 prefix\nTODO-42 and a/b'
    const results = searchAdvancedNotes([note('n', source)], 'content:/TODO-\\d+/')
    expect(results).toHaveLength(1)
    expect(results[0].sourceMatch?.match_start).toBe(source.indexOf('TODO-42'))
    const raw = results[0].sourceMatch!
    expect(source.slice(raw.start, raw.end)).toBe(raw.text)
    expect(paths([note('n', source)], '/a\\/b/')).toEqual(['n'])
    expect(paths([note('n', 'cat')], '/CAT/i')).toEqual(['n'])
    expect(paths([note('n', 'cat')], '/CAT/')).toEqual([])
  })
  it('supports arbitrary Unicode properties, arrays, types, null and numeric comparison', () => {
    const notes = [note('one', '---\n担当: [田中, 鈴木]\n優先度: 3\n完了: true\n空: null\n文字: ""\n---\n本文'), note('two', '---\n担当: 山田\n優先度: "3"\n完了: "true"\n空: []\n---')]
    expect(paths(notes, '[担当]')).toEqual(['one', 'two'])
    expect(paths(notes, '[担当:田中] [優先度:>=3] [完了:true]')).toEqual(['one'])
    expect(paths(notes, '[空:null]')).toEqual(['one'])
    expect(paths(notes, '[文字:""]')).toEqual(['one'])
    expect(paths(notes, '["担当":山田]')).toEqual(['two'])
  })
  it('keeps legacy filters usable inside groups', () => {
    const notes = [note('one', '---\ncategory: work\n---\n#tag/sub'), note('two', '#other')]
    expect(paths(notes, '(tag:tag OR category:personal) -file:two')).toEqual(['one'])
  })
  it('combines property value alternatives, groups and negation over the whole property', () => {
    const notes = [note('draft', '---\nstatus: Draft\n---'), note('published', '---\nstatus: Published\n---'),
      note('archived', '---\nstatus: [Draft, Archived]\n---'), note('missing', 'Text'),
      note('phrase', '---\nstatus: In progress\n---'), note('separate', '---\nstatus: [In, progress]\n---')]
    expect(paths(notes, '[status:Draft OR Published]')).toEqual(['archived', 'draft', 'published'])
    expect(paths(notes, '[status:(Draft OR Published) -Archived]')).toEqual(['draft', 'published'])
    expect(paths(notes, '[status:-(Draft OR Published)]')).toEqual(['phrase', 'separate'])
    expect(paths(notes, '[status:In progress]')).toEqual(['phrase'])
    expect(paths(notes, '[status: In progress ]')).toEqual(['phrase'])
    expect(paths(notes, '[status:(In progress)]')).toEqual(['phrase', 'separate'])
  })
  it('uses property regex only on strings and keeps quoted, typed and negative numeric alternatives distinct', () => {
    const notes = [note('a', '---\nstatus: [Published, Draft]\nn: -3\nflag: true\nempty: null\n---'),
      note('b', '---\nstatus: published archive\nn: 4\nflag: false\nempty: ""\n---'),
      note('c', '---\nstatus: 123\nn: "-3"\nflag: "true"\nempty: []\n---')]
    expect(paths(notes, '[status:/^pub/i -/archive$/]')).toEqual(['a'])
    expect(paths(notes, '[status:/^Pub[li]+shed$/]')).toEqual(['a'])
    expect(paths(notes, '[status:/^123$/ OR "123"]')).toEqual([])
    expect(paths(notes, '[n:-3 OR >=4]')).toEqual(['a', 'b'])
    expect(paths(notes, '[n:"-3" OR -4]')).toEqual(['c'])
    expect(paths(notes, '[flag:true OR false] [empty:null OR ""]')).toEqual(['a', 'b'])
    expect(paths(notes, '[status:Draft OR /archive$/] content:---')).toEqual(['a', 'b'])
  })
  it.each(['[status:Draft OR]', '[status:OR Draft]', '[status:()]', '[status:(Draft OR)]',
    '[status:((Draft)]', '[status:/x/g]', '[status:/[/]', '[status:[nested]]', '[status:"Draft" extra)'])('rejects malformed property subquery %s', query => {
    expect(() => searchAdvancedNotes([], query)).toThrow(/検索式/)
  })
  it('bounds property expression nesting and atom count with the outer query', () => {
    expect(() => searchAdvancedNotes([], '[status:' + '('.repeat(17) + 'Draft' + ')'.repeat(17) + ']')).toThrow(/上限/)
    expect(() => searchAdvancedNotes([], '[n:(' + Array(257).fill('1').join(' OR ') + ')]')).toThrow(/上限/)
  })
  it.each(['cat OR', '(cat', 'cat)', 'content:', '/[/', '/x/g', '[担当:', '()'])('reports malformed advanced query %s', query => {
    expect(() => searchAdvancedNotes(animals, query)).toThrow(/検索式/)
  })
  it('bounds query length and nesting', () => {
    expect(() => searchAdvancedNotes(animals, '('.repeat(17) + 'cat' + ')'.repeat(17))).toThrow()
    expect(() => searchAdvancedNotes(animals, 'a'.repeat(4097))).toThrow()
  })
  it('detects advanced syntax without treating quoted symbols or ordinary paths as regex', () => {
    expect(isAdvancedSearchQuery('"cat OR dog"')).toBe(false)
    expect(isAdvancedSearchQuery('path:folder/note')).toBe(false)
    expect(isAdvancedSearchQuery('/(a+)+$/')).toBe(true)
    expect(isAdvancedSearchQuery('content:/(a+)+$/')).toBe(true)
  })
})
it('selects the full source character when case folding expands a character', () => {
  const result = searchAdvancedNotes([note('sample', 'İ prefix')], 'content:i')[0]
  expect(result.sourceMatch).toMatchObject({ match_start: 0, match_end: 1 })
})
it('keeps exact jumps for each advanced matching line in overlapping contexts', () => {
  const content = '---\r\nstatus: NEEDLE\r\n---\r\nİ😀 NEEDLE one\r\nNEEDLE two'
  const notes = [note('sample', content)]
  const query = 'content:/NEEDLE/'
  const [result] = searchAdvancedNotes(notes, query)
  const contexts = searchResultContextRanges(notes[0], query, 1, result.sourceMatches)
  expect(contexts.map(context => context.matchStart)).toEqual([
    content.indexOf('NEEDLE'), content.indexOf('NEEDLE one'), content.indexOf('NEEDLE two')
  ])
  expect(contexts.map(context => content.slice(context.matchStart, context.matchEnd))).toEqual(['NEEDLE', 'NEEDLE', 'NEEDLE'])
})

it('shows the full multiline match through its ending line', () => {
  const sample = note('sample', 'first\r\nsecond line\r\nunrelated')
  const query = 'content:/first\\r?\\nsecond/'
  const [result] = searchAdvancedNotes([sample], query)
  expect(searchResultContextRanges(sample, query, 0, result.sourceMatches)).toEqual([
    { text: 'first\r\nsecond line', matchStart: 0, matchEnd: 'first\r\nsecond'.length }
  ])
})
