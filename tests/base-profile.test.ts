import { describe, expect, it } from 'vitest'
import { basePropertyReferences, parseBaseProfile, serializeBaseProfile, updateBaseProfileSource } from '../src/core/base-profile'
function parsed(source: string) { const result = parseBaseProfile(source); if (!result.ok) throw new Error(result.diagnostics[0].message); return result.profile }
describe('Bases official YAML profile', () => {
  it('parses recursive filters, multiple views, labels, formulas, summaries and multiple sort priorities', () => {
    const profile = parsed(`
filters:
  or:
    - file.hasTag("work")
    - and:
        - priority >= 2
        - not: ['status == "done"']
formulas:
  cost: price * 2
properties:
  formula.cost: {displayName: Cost}
summaries:
  custom: values.reduce(acc + value, 0)
views:
  - type: table
    name: Main
    order: [file.name, status, price, formula.cost]
    sort: [{property: status}, {property: price, direction: DESC}]
    groupBy: {property: status, direction: DESC}
    summaries: {price: Sum}
  - type: table
    name: Recent
    filters: file.mtime > now() - "7d"
    order: [file.path]
`)
    expect(profile.views).toHaveLength(2)
    expect(profile.view).toBe(profile.views![0])
    expect(profile.view.order).toHaveLength(4)
    expect(profile.view.sorts).toEqual([{ property: 'status', direction: 'ASC' }, { property: 'price', direction: 'DESC' }])
    expect(profile.filters[0]).toMatchObject({ kind: 'or', children: [{ kind: 'expression' }, { kind: 'and' }] })
    expect(profile.properties?.['formula.cost'].displayName).toBe('Cost')
    expect(parsed(serializeBaseProfile(profile)).views).toHaveLength(2)
  })
  it('accepts plain tables without a redundant Markdown filter and has no three column cap', () => {
    const profile = parsed('views:\n - type: table\n   order: [file.name, a, b, c, d]\n')
    expect(profile.filters).toEqual([])
    expect(profile.view.order).toHaveLength(5)
  })
  it.each([
    'views: []', 'views: nope', 'views: [{type: cards}]', 'views: [{type: table, order: []}]',
    'views: [{type: table, sort: [{property: a, direction: sideways}]}]',
    'views: [{type: table, limit: -1}]', 'views: [{type: table, limit: 1.2}]',
    'views: [{type: table}]\nfilters: {xor: [true]}',
    'views: [{type: table}]\nfilters: system("x")',
    'views: [{type: table}]\nformulas: {bad: "note.constructor"}',
    'views: [{type: table}]\nformulas: {bad: "1 +"}',
    'views: [{type: table}]\nfilters: {and: [], or: []}',
    'views: [{type: table, name: A, name: B}]',
    'views: [{type: table}]\n__proto__: x',
    'views: [{type: table}]\nformulas: {constructor: "1"}'
  ])('diagnoses malformed/unsafe profiles: %s', (source) => expect(parseBaseProfile(source).ok).toBe(false))
  it('retains unknown fields and comments during a supported edit', () => {
    const original = `# Preserve root\nplugin: {x: 1}\nproperties:\n  status:\n    displayName: Old\n    custom: keep\nviews:\n  - type: table\n    name: Main\n    order: [file.name, status] # column comment\n    pluginColumn: [x, y]\n`
    const profile = parsed(original)
    profile.views![0].name = 'Renamed'
    profile.properties!.status.displayName = 'Status'
    const edited = updateBaseProfileSource(original, profile)
    expect(edited).toContain('# Preserve root')
    expect(edited).toContain('plugin: {x: 1}')
    expect(edited).toContain('custom: keep')
    expect(edited).toContain('pluginColumn: [x, y]')
    expect(edited).toContain('column comment')
    expect(parsed(edited).view.name).toBe('Renamed')
    expect(profile.properties!.status.displayName).toBe('Status')
  })
  it('keeps view extension fields attached to their original view after a deletion', () => {
    const original = 'views:\n - {type: table, name: First, plugin: one}\n - {type: table, name: Second, plugin: two}\n'
    const profile = parsed(original)
    profile.views = [profile.views![1]]; profile.view = profile.views[0]
    const source = updateBaseProfileSource(original, profile)
    expect(source).toContain('plugin: two'); expect(source).not.toContain('plugin: one')
  })
  it('rejects modifying duplicate-key documents', () => expect(() => updateBaseProfileSource('views: []\nviews: []', parsed('views: [{type: table}]'))).toThrow())
  it('preserves BOM, CRLF and every untouched byte during a scalar GUI edit', () => {
    const source = '\uFEFF# root comment\r\nplugin: { odd:  1 } # preserve\r\nviews:\r\n  - type: table\r\n    name: Main # view comment\r\n    order: [file.name, status]\r\n    pluginSetting: {width:  3}\r\n'
    const draft = parsed(source); draft.view.name = 'Changed'
    expect(updateBaseProfileSource(source, draft)).toBe(source.replace('name: Main', 'name: "Changed"'))
  })
  it('leaves a no-op source byte-identical and inserts fields using the existing line ending', () => {
    const source = '\uFEFFviews:\r\n  - type: table\r\n    name: Main\r\n    order: [file.name]\r\n    plugin: raw\r\n'
    const draft = parsed(source)
    expect(updateBaseProfileSource(source, draft)).toBe(source)
    draft.view.groupBy = { property: 'status', direction: 'ASC' }
    const changed = updateBaseProfileSource(source, draft)
    expect(changed.startsWith('\uFEFF')).toBe(true); expect(changed.replaceAll('\r\n', '').includes('\n')).toBe(false)
    expect(changed).toContain('    plugin: raw\r\n')
    expect(parsed(changed).view.groupBy).toEqual(draft.view.groupBy)
  })
  it('adds, removes and edits flow-map fields without rewriting extension data', () => {
    const source = 'custom: { spaces:   keep }\nviews: [{type: table, name: Main, order: [file.name], custom: { x:   1 }}]\n'
    const draft = parsed(source); draft.view.groupBy = { property: 'a', direction: 'ASC' }; draft.view.name = 'Changed'
    const changed = updateBaseProfileSource(source, draft)
    expect(changed).toContain('custom: { spaces:   keep }')
    expect(changed).toContain('custom: { x:   1 }')
    const remove = parsed(changed); delete remove.view.groupBy
    expect(parsed(updateBaseProfileSource(changed, remove)).view.groupBy).toBeUndefined()
  })
  it('preserves existing blocks and extension bytes on view append and deletion', () => {
    const source = '# header\r\nviews:\r\n  - type: table\r\n    name: First\r\n    custom: { x:   1 }\r\n  - type: table\r\n    name: Second\r\n    custom: { y:   2 }\r\n'
    const draft = parsed(source); draft.views!.push({ type: 'table', name: 'Third', filters: [], order: ['file.name'] })
    const appended = updateBaseProfileSource(source, draft)
    expect(appended.startsWith(source)).toBe(true)
    const removed = parsed(source); removed.views = [removed.views![1]]; removed.view = removed.views[0]
    expect(updateBaseProfileSource(source, removed)).toContain('    custom: { y:   2 }\r\n')
  })
  it('removes adjacent flow fields while keeping retained extension value bytes', () => {
    const source = 'views: [{type: table, name: Main, plugin: { raw:   1 }, groupBy: {property: status}, summaries: {n: Sum}, sort: [{property: n}]}]\n'
    const draft = parsed(source); delete draft.view.groupBy; delete draft.view.summaries; delete draft.view.sort; delete draft.view.sorts
    const edited = updateBaseProfileSource(source, draft)
    expect(edited).toContain('plugin: { raw:   1 }')
    expect(parsed(edited).view.groupBy).toBeUndefined()
    expect(parsed(edited).view.summaries).toBeUndefined()
    expect(parsed(edited).view.sort).toBeUndefined()
  })
  it('keeps comments from deleted optional fields and removed list items', () => {
    const source = 'views:\n - type: table\n   name: Main\n   order:\n    - file.name\n    - status # retain column comment\n   groupBy: {property: status} # retain group comment\n'
    const draft = parsed(source); delete draft.view.groupBy; draft.view.order = ['file.name']
    const changed = updateBaseProfileSource(source, draft)
    expect(changed).toContain('# retain column comment')
    expect(changed).toContain('# retain group comment')
    expect(parsed(changed).view.order).toEqual(['file.name'])
  })
  it('finds property dependencies in all views, recursive filters, formulas, group and summaries', () => {
    const profile = parsed('filters: {or: [\'note["price"] > 1\']}\nformulas: {twice: "note.price * 2"}\nviews:\n - {type: table, order: [price], groupBy: {property: price}, summaries: {price: Sum}}\n - {type: table, sort: [{property: note.price}]}')
    const references = basePropertyReferences(profile, 'price')
    expect(references.some((item) => item.includes('filters'))).toBe(true)
    expect(references).toContain('formulas.twice')
    expect(references.some((item) => item.includes('views[1]'))).toBe(true)
    expect(basePropertyReferences(profile, 'pric')).toEqual([])
  })
})
