import { describe, expect, it } from 'vitest'
import { evaluateBase, type BaseCell } from '../src/core/base-evaluator'
import { parseBaseProfile, type BaseProfile } from '../src/core/base-profile'
import { baseDate } from '../src/core/base-expression'
import type { NoteDocument } from '../src/shared/types'
const note = (path: string, content: string): NoteDocument => ({ path, name: path, content, modifiedAt: 1000, createdAt: 100, size: content.length })
function profile(source: string): BaseProfile { const result = parseBaseProfile(source); if (!result.ok) throw new Error(result.diagnostics[0].message); return result.profile }
function value(cell: BaseCell): unknown { return cell.kind === 'value' ? cell.value : cell.kind }
describe('Bases formulas, views, grouping and summaries', () => {
  it('resolves only requested formula dependencies, diagnoses cycles and keeps unaffected rows readable', () => {
    const base = profile('formulas: {double: "price * 2", final: "formula.double + 1", circular: "formula.other", other: "formula.circular"}\nviews: [{type: table, order: [file.name, formula.final, formula.circular]}]')
    const result = evaluateBase(base, [note('A.md', '---\nprice: 3\n---\n')])
    expect(value(result.rows[0].cells['formula.final'])).toBe(7)
    expect(result.rows[0].cells['formula.circular']).toMatchObject({ kind: 'diagnostic', code: 'CIRCULAR_FORMULA' })
    expect(value(result.rows[0].cells['file.name'])).toBe('A.md')
  })
  it('supports quoted property names and formula bracket references', () => {
    const result = evaluateBase(profile('formulas: {価格: \'note["定価"] * 2\', total: \'formula["価格"] + 1\'}\nviews: [{type: table, order: [formula.total]}]'), [note('A.md', '---\n定価: 12\n---\n')])
    expect(value(result.rows[0].cells['formula.total'])).toBe(25)
  })
  it('selects views and applies recursive global/view conditions separately', () => {
    const base = profile('filters: {or: [\'status == "open"\', {and: ["price > 5", {not: [\'status == "done"\']}]}]}\nviews:\n - {type: table, name: All, order: [file.name]}\n - {type: table, name: Expensive, filters: "price > 5", order: [price]}')
    const notes = [note('Open.md', '---\nstatus: open\nprice: 1\n---'), note('Expensive.md', '---\nstatus: hold\nprice: 8\n---'), note('Done.md', '---\nstatus: done\nprice: 9\n---')]
    expect(evaluateBase(base, notes).rows.map((row) => row.path)).toEqual(['Expensive.md', 'Open.md'])
    expect(evaluateBase(base, notes, 1).rows.map((row) => row.path)).toEqual(['Expensive.md'])
  })
  it('uses multiple sort priorities, unlimited columns, labels and group/overall custom summaries', () => {
    const base = profile('formulas: {double: "price * 2"}\nproperties: {price: {displayName: Price}}\nsummaries: {Total: "values.reduce(acc + value, 0)"}\nviews: [{type: table, order: [file.name, price, status, formula.double, file.tags], sort: [{property: status}, {property: price, direction: DESC}], groupBy: {property: status}, summaries: {price: Total}}]')
    const notes = [note('A.md', '---\nstatus: first\nprice: 2\n---'), note('B.md', '---\nstatus: first\nprice: 8\n---'), note('C.md', '---\nstatus: second\nprice: 3\n---')]
    const result = evaluateBase(base, notes)
    expect(result.rows.map((row) => row.path)).toEqual(['B.md', 'A.md', 'C.md'])
    expect(result.columns).toHaveLength(5)
    expect(result.labels?.price).toBe('Price')
    expect(value(result.summaries!.price)).toBe(13)
    expect(result.groups!.map((group) => value(group.summaries.price))).toEqual([10,3])
  })
  it.each([['Average', 3], ['Min', 1], ['Max', 5], ['Sum', 9], ['Range', 4], ['Median', 3], ['Stddev', Math.sqrt(8 / 3)]])('computes standard numeric %s', (name, expected) => {
    const result = evaluateBase(profile(`views: [{type: table, order: [n], summaries: {n: ${name}}}]`), [1,3,5].map((number) => note(`${number}.md`, `---\nn: ${number}\n---`)))
    expect(value(result.summaries!.n)).toBe(expected)
  })
  it.each([['Checked', 1], ['Unchecked', 1], ['Empty', 1], ['Filled', 2], ['Unique', 2]])('computes standard boolean/any %s', (name, expected) => {
    const result = evaluateBase(profile(`views: [{type: table, order: [n], summaries: {n: ${name}}}]`), [note('A.md', '---\nn: true\n---'), note('B.md', '---\nn: false\n---'), note('C.md', '')])
    expect(value(result.summaries!.n)).toBe(expected)
  })
  it('parses declared note dates, leaves undeclared ISO text as text, and summarizes date range', () => {
    const base = profile('properties: {when: {type: date}}\nviews: [{type: table, order: [when, text], summaries: {when: Range}}]')
    const result = evaluateBase(base, [note('A.md', '---\nwhen: 2025-01-01\ntext: 2025-01-01\n---'), note('B.md', '---\nwhen: 2025-01-03\n---')])
    expect(value(result.rows[0].cells.when)).toEqual(baseDate('2025-01-01'))
    expect(value(result.rows[0].cells.text)).toBe('2025-01-01')
    expect(value(result.summaries!.when)).toBe(172800000)
    for (const [name, date] of [['Earliest','2025-01-01'],['Latest','2025-01-03']]) {
      base.view.summaries = { when: name }
      expect(value(evaluateBase(base, [note('A.md', '---\nwhen: 2025-01-01\n---'), note('B.md', '---\nwhen: 2025-01-03\n---')]).summaries!.when)).toEqual(baseDate(date))
    }
  })
  it('covers file tags/links/frontmatter links/backlinks/embeds/properties/file and source-context fields', () => {
    const base = profile('formulas: {tag: \'file.hasTag("work")\', link: \'file.hasLink("B")\', folder: \'file.inFolder("notes/A.md")\', base: "this.file.path"}\nviews: [{type: table, order: [file.tags, file.links, file.backlinks, file.embeds, file.properties, file.file, formula.tag, formula.link, formula.folder, formula.base]}]')
    const notes = [note('notes/A.md', '---\ntags: [work/project]\nref: "[[B]]"\n---\n#inline ![[B]]\n`#not-a-tag`'), note('notes/B.md', '')]
    const result = evaluateBase(base, notes, 0, { thisFile: note('Dashboard.base', '') })
    const row = result.rows[0]
    expect(value(row.cells['file.tags'])).toEqual(['work/project', 'inline'])
    expect(value(row.cells['formula.tag'])).toBe(true)
    expect(value(row.cells['formula.link'])).toBe(true)
    expect(value(row.cells['formula.folder'])).toBe(false)
    expect(value(row.cells['formula.base'])).toBe('Dashboard.base')
    expect(value(row.cells['file.embeds'])).toEqual([{ baseType: 'link', value: 'B' }])
    expect(value(result.rows[1].cells['file.backlinks'])).toEqual([{ baseType: 'link', value: 'notes/A.md' }])
    expect(value(row.cells['file.file'])).toMatchObject({ baseType: 'file', path: 'notes/A.md' })
    expect(value(row.cells['file.properties'])).toMatchObject({ ref: { baseType: 'link', value: 'B' } })
  })
  it('hasProperty reports unsupported existing keys while direct reads diagnose them', () => {
    const result = evaluateBase(profile('formulas: {exists: \'file.hasProperty("nested")\'}\nviews: [{type: table, order: [nested, formula.exists, file.properties]}]'), [note('A.md', '---\nnested: {x: 1}\n---')])
    expect(value(result.rows[0].cells['formula.exists'])).toBe(true)
    expect(result.rows[0].cells.nested).toMatchObject({ kind: 'diagnostic', code: 'UNSUPPORTED_PROPERTY' })
    expect(result.rows[0].cells['file.properties']).toMatchObject({ kind: 'diagnostic' })
  })
  it('enforces property diagnostics and file fields through file() and asFile()', () => {
    const result = evaluateBase(profile('formulas: {props: \'file("A").properties\', exists: \'link("A").asFile().hasProperty("nested")\', self: \'file("A").file.path\', metadata: \'file("A").basePropertyNames\'}\nviews: [{type: table, order: [formula.props, formula.exists, formula.self, formula.metadata]}]'), [note('A.md', '---\nnested: {x: 1}\n---')])
    expect(result.rows[0].cells['formula.props']).toMatchObject({ kind: 'diagnostic' })
    expect(value(result.rows[0].cells['formula.exists'])).toBe(true)
    expect(value(result.rows[0].cells['formula.self'])).toBe('A.md')
    expect(value(result.rows[0].cells['formula.metadata'])).toBe('empty')
  })
  it('keeps malformed frontmatter and invalid formula filters visible as diagnostics', () => {
    const result = evaluateBase(profile('filters: note.status != "done"\nviews: [{type: table}]'), [note('A.md', '---\nstatus: open\nstatus: open\n---')])
    expect(result.rows).toEqual([])
    expect(result.diagnostics[0].code).toBe('MALFORMED_PROPERTY')
  })
  it('preserves declared note ISO offset and original fractional precision without changing its source', () => {
    const source = note('A.md', '---\nwhen: 2025-05-27T12:34:56.123456+09:00\n---')
    const original = source.content
    const result = evaluateBase(profile('properties: {when: {type: datetime}}\nviews: [{type: table, order: [when]}]'), [source])
    expect(value(result.rows[0].cells.when)).toEqual({ baseType: 'date', value: '2025-05-27T12:34:56.123456+09:00' })
    expect(source.content).toBe(original)
  })
})
