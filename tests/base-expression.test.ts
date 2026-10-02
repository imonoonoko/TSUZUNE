import { describe, expect, it } from 'vitest'
import moment from 'moment'
import { BASE_GLOBAL_FUNCTIONS, BASE_METHODS, baseDate, evaluateBaseExpression, parseBaseExpression, type BaseValue } from '../src/core/base-expression'
const now = Date.parse('2026-10-01T12:00:00Z')
const file: BaseValue = { baseType: 'file', value: 'notes/A.md', path: 'notes/A.md', properties: { status: 'active' }, tags: ['work/project'], links: [{ baseType: 'link', value: 'notes/B.md' }] }
const other: BaseValue = { baseType: 'file', value: 'notes/B.md', path: 'notes/B.md', properties: {}, tags: [], links: [] }
const context = { now, random: () => 0.25, resolve: (name: string): BaseValue => name === 'file' ? file : null, file: (path: BaseValue): BaseValue => {
  const value = typeof path === 'object' && path !== null && !Array.isArray(path) ? path.value : path
  return value === 'notes/A.md' || value === 'A' || value === '[[A]]' ? file : value === 'notes/B.md' || value === 'B' ? other : null
} }
// Each official name has a behavioral assertion, not just a registry-membership assertion.
const cases: [string, string, BaseValue][] = [
  ['escapeHTML', 'escapeHTML("<&>")', '&lt;&amp;&gt;'], ['date', 'date("2025-05-27").year', 2025], ['duration', 'number(duration("1d"))', 86400000], ['file', 'file("A").path', 'notes/A.md'],
  ['html', 'html("<b>x</b>")', { baseType: 'html', value: '<b>x</b>' }], ['if', 'if(false, 1/0, "safe")', 'safe'], ['image', 'image("image.png")', { baseType: 'image', value: 'image.png' }], ['icon', 'icon("arrow-right")', { baseType: 'icon', value: 'arrow-right' }],
  ['link', 'link("[[A|Title]]")', { baseType: 'link', value: 'A', display: 'Title' }], ['list', 'list(1)', [1]], ['max', 'max(1, 4, -2)', 4], ['min', 'min(1, 4, -2)', -2], ['now', 'number(now())', now], ['number', 'number("3.4")', 3.4], ['today', 'today().hour', 0], ['random', 'random()', .25],
  ['isTruthy', '1.isTruthy()', true], ['isType', 'true.isType("boolean")', true], ['toString', '123.toString()', '123'],
  ['date.date', 'date("2025-05-27 12:34:56").date().hour', 0], ['format', 'date("2025-05-27").format("YYYY/MM/DD")', '2025/05/27'], ['time', 'date("2025-05-27 12:34:56").time()', '12:34:56'], ['relative', 'date("2026-09-28T12:00:00Z").relative()', '3 days ago'], ['date.isEmpty', 'now().isEmpty()', false],
  ['string.contains', '"hello".contains("ell")', true], ['string.containsAll', '"hello".containsAll("h", "e")', true], ['string.containsAny', '"hello".containsAny("x", "e")', true], ['endsWith', '"hello".endsWith("lo")', true], ['string.isEmpty', '"".isEmpty()', true], ['lower', '"ABC".lower()', 'abc'],
  ['replace', '"a:b:c".replace(":", "-")', 'a-b-c'], ['replace.regex', '"a:b:c".replace(/:/, "-")', 'a-b:c'], ['replace.regexg', '"a:b:c".replace(/:/g, "-")', 'a-b-c'], ['replace.captures', '"John Smith".replace(/(\\w+) (\\w+)/, "$2, $1")', 'Smith, John'],
  ['repeat', '"12".repeat(2)', '1212'], ['string.reverse', '"hello".reverse()', 'olleh'], ['string.slice', '"hello".slice(1, 4)', 'ell'], ['split', '"a,b,c,d".split(/,/, 3)', ['a', 'b', 'c']], ['startsWith', '"hello".startsWith("he")', true], ['title', '"hello world".title()', 'Hello World'], ['trim', '" hi ".trim()', 'hi'],
  ['abs', '(-5).abs()', 5], ['ceil', '(2.1).ceil()', 3], ['floor', '(2.9).floor()', 2], ['number.isEmpty', '5.isEmpty()', false], ['round', '(2.3333).round(2)', 2.33], ['toFixed', '(3.14159).toFixed(2)', '3.14'],
  ['list.contains', '[1,2,3].contains(2)', true], ['list.containsAll', '[1,2,3].containsAll(2,3)', true], ['list.containsAny', '[1,2,3].containsAny(3,4)', true], ['filter', '[1,2,3,4].filter(value > 2)', [3,4]], ['flat', '[1,[2,3]].flat()', [1,2,3]], ['list.isEmpty', '[].isEmpty()', true], ['join', '[1,2,3].join(",")', '1,2,3'], ['map', '[1,2,3].map(value + index)', [1,3,5]], ['reduce', '[1,2,3].reduce(acc + value, 0)', 6], ['list.reverse', '[1,2,3].reverse()', [3,2,1]], ['list.slice', '[1,2,3,4].slice(1,3)', [2,3]], ['sort', '[3,1,2].sort()', [1,2,3]], ['unique', '[1,2,2,3].unique()', [1,2,3]],
  ['asFile', 'link("A").asFile().path', 'notes/A.md'], ['linksTo', 'link("A").linksTo(file("B"))', true], ['asLink', 'file("A").asLink("My A")', { baseType: 'link', value: 'notes/A.md', display: 'My A' }], ['hasLink', 'file("A").hasLink("B")', true], ['hasProperty', 'file("A").hasProperty("status")', true], ['hasTag', 'file("A").hasTag("work", "other")', true], ['inFolder', 'file("A").inFolder("notes")', true],
  ['object.isEmpty', '{}.isEmpty()', true], ['keys', '{"a":1,"b":2}.keys()', ['a', 'b']], ['values', '{"a":1,"b":2}.values()', [1,2]], ['matches', '/abc/i.matches("ABCde")', true], ['mean', '[1,2,3].mean()', 2]
]
// Type-scoped cases: shared method names have a boundary assertion for every documented receiver.
const boundaryCases: [string, string, BaseValue, boolean?][] = [
  ["Global.escapeHTML", "escapeHTML(\"\")", ""],
  ["Global.date", "date(\"2025-02-30\")", null, true],
  ["Global.duration", "duration(\"invalid\")", null, true],
  ["Global.file", "file(\"missing\")", null],
  ["Global.html", "html(\"\")", {"baseType":"html","value":""}],
  ["Global.if", "if(null, 1 / 0)", null],
  ["Global.image", "image(\"\")", {"baseType":"image","value":""}],
  ["Global.icon", "icon(\"\")", {"baseType":"icon","value":""}],
  ["Global.link", "link(\"\")", {"baseType":"link","value":""}],
  ["Global.list", "list(null)", [null]],
  ["Global.max", "max(0)", 0],
  ["Global.min", "min(0)", 0],
  ["Global.now", "now().isEmpty()", false],
  ["Global.number", "number(\"NaN\")", null, true],
  ["Global.today", "today().minute", 0],
  ["Global.random", "random()", 0.25],
  ["Any.isTruthy", "null.isTruthy()", false],
  ["Any.isType", "null.isType(\"null\")", true],
  ["Any.toString", "\"\".toString()", ""],
  ["Date.date", "\"wrong\".date()", null, true],
  ["Date.format", "\"wrong\".format(\"YYYY\")", null, true],
  ["Date.time", "\"wrong\".time()", null, true],
  ["Date.relative", "\"wrong\".relative()", null, true],
  ["Date.isEmpty", "date(\"1970-01-01\").isEmpty()", false],
  ["String.contains", "\"\".contains(\"\")", true],
  ["String.containsAll", "\"\".containsAll()", true],
  ["String.containsAny", "\"\".containsAny()", false],
  ["String.endsWith", "\"\".endsWith(\"\")", true],
  ["String.isEmpty", "\"\".isEmpty()", true],
  ["String.lower", "\"\".lower()", ""],
  ["String.replace", "\"\".replace(/x/g, \"y\")", ""],
  ["String.repeat", "\"x\".repeat(-1)", null, true],
  ["String.reverse", "\"\".reverse()", ""],
  ["String.slice", "\"abc\".slice(-1)", "c"],
  ["String.split", "\"\".split(\",\")", [""]],
  ["String.startsWith", "\"\".startsWith(\"\")", true],
  ["String.title", "\"\".title()", ""],
  ["String.trim", "\" \\t \".trim()", ""],
  ["Number.abs", "0.abs()", 0],
  ["Number.ceil", "(-0.1).ceil()", -0],
  ["Number.floor", "(-0.1).floor()", -1],
  ["Number.isEmpty", "0.isEmpty()", false],
  ["Number.round", "(-2.5).round()", -2],
  ["Number.toFixed", "1.toFixed(101)", null, true],
  ["List.contains", "[].contains(null)", false],
  ["List.containsAll", "[].containsAll()", true],
  ["List.containsAny", "[].containsAny()", false],
  ["List.filter", "[1].filter(null)", []],
  ["List.flat", "[].flat()", []],
  ["List.isEmpty", "[].isEmpty()", true],
  ["List.join", "[].join(\",\")", ""],
  ["List.map", "[].map(1 / 0)", []],
  ["List.reduce", "[].reduce(acc + value, null)", null],
  ["List.reverse", "[].reverse()", []],
  ["List.slice", "[].slice(-5, 99)", []],
  ["List.sort", "[].sort()", []],
  ["List.unique", "[].unique()", []],
  ["Link.asFile", "link(\"missing\").asFile()", null],
  ["Link.linksTo", "link(\"missing\").linksTo(file(\"A\"))", false],
  ["File.asLink", "file(\"A\").asLink(null)", {"baseType":"link","value":"notes/A.md"}],
  ["File.hasLink", "file(\"A\").hasLink(\"missing\")", false],
  ["File.hasProperty", "file(\"A\").hasProperty(\"missing\")", false],
  ["File.hasTag", "file(\"A\").hasTag()", false],
  ["File.inFolder", "file(\"A\").inFolder(\"notes/A.md\")", false],
  ["Object.isEmpty", "{}.isEmpty()", true],
  ["Object.keys", "null.keys()", null, true],
  ["Object.values", "null.values()", null, true],
  ["Regexp.matches", "/x/.matches(\"\")", false],
]
describe('Bases official function behavior', () => {
  it.each(boundaryCases)('boundary %s: %s', (_name, source, expected, throws) => {
    if (throws) expect(() => evaluateBaseExpression(source, context)).toThrow()
    else expect(evaluateBaseExpression(source, context)).toEqual(expected)
  })
  it.each(boundaryCases)('composition %s: typed result in lexical list reduction', (name) => {
    const [category, method] = name.split('.')
    const namespaced = `${category.toLowerCase()}.${method}`
    const example = cases.find(([key]) => key === namespaced) ?? cases.find(([key]) => key === method)
    expect(example, name).toBeDefined()
    const [, source, expected] = example!
    const type = expected == null ? 'null' : Array.isArray(expected) ? 'list' : typeof expected === 'object' && 'baseType' in expected ? expected.baseType : typeof expected
    expect(evaluateBaseExpression(`[(${source})].map(value.isType("${type}")).reduce(acc && value, true)`, context)).toBe(true)
  })
  it('has a separate boundary assertion for all 68 official type-scoped APIs', () => {
    expect(boundaryCases).toHaveLength(68)
    expect(new Set(boundaryCases.map(([name]) => name)).size).toBe(68)
  })
  it.each(cases)('%s: %s', (_name, source, expected) => expect(evaluateBaseExpression(source, context)).toEqual(expected))
  it('covers every exposed official global and method name', () => {
    for (const name of [...BASE_GLOBAL_FUNCTIONS, ...BASE_METHODS]) expect(cases.some(([key]) => key === name || key.endsWith(`.${name}`)), name).toBe(true)
  })
  it('supports all date fields and preserves explicit ISO offsets', () => {
    for (const [field, expected] of Object.entries({ year: 2025, month: 5, day: 27, hour: 12, minute: 34, second: 56, millisecond: 123 })) expect(evaluateBaseExpression(`date("2025-05-27T12:34:56.123+09:00").${field}`, context)).toBe(expected)
    expect(evaluateBaseExpression('date("2025-05-27T12:00:00+09:00").format("Z")', context)).toBe('+09:00')
  })
  it('applies calendar durations and returns milliseconds for date differences', () => {
    expect(evaluateBaseExpression('(date("2024-12-01") + "1M" + "4h" + "3m").format("YYYY-MM-DD HH:mm")', context)).toBe('2025-01-01 04:03')
    expect(evaluateBaseExpression('(now() + "1d") - now()', context)).toBe(86400000)
    expect(evaluateBaseExpression('number(duration("5h") * 2)', context)).toBe(36000000)
  })
  it('supports lexical nested map/filter/reduce without leaking value/index/acc', () => {
    expect(evaluateBaseExpression('[1,2].map([3,4].map(value + index).reduce(acc + value, value))', context)).toEqual([9,10])
    expect(evaluateBaseExpression('[1,2,3].reduce(if(acc == null || value > acc,value,acc),null)', context)).toBe(3)
    expect(evaluateBaseExpression('if(false, 1/0)', context)).toBe(null)
  })
  it.each(['date("2025-02-30")', 'date("garbage")', 'number("wrong")', '"x".repeat(1000001)', '1 / 0', 'duration("invalid")', '"x".matches("x")'])('diagnoses invalid typed invocation %s', (source) => expect(() => evaluateBaseExpression(source, context)).toThrow())
  it.each(['process.exit()', 'file.constructor', 'note["__proto__"]', '{}.constructor()', 'system("x")', '({}).toString.constructor("x")()', '[1,2', '"unterminated', '/[/', 'true ? 1 : 0', 'new Date()'])('blocks malformed or unsafe expression %s', (source) => expect(() => evaluateBaseExpression(source, context)).toThrow())
  it('bounds parser depth and evaluator instruction/deadline work', () => {
    expect(() => parseBaseExpression('('.repeat(101) + '1' + ')'.repeat(101))).toThrow(/nesting/)
    expect(() => evaluateBaseExpression('[1,2,3].map(value + 1)', { ...context, maxSteps: 2 })).toThrow(/limit/)
    expect(() => evaluateBaseExpression('1+2', { ...context, deadline: 0 })).toThrow(/limit/)
  })
  it('compares equivalent dates and file links despite display labels', () => {
    expect(evaluateBaseExpression('date("2025-05-27T12:00:00+09:00") == date("2025-05-27T03:00:00Z")', context)).toBe(true)
    expect(evaluateBaseExpression('link("A", "alias") == file("A")', context)).toBe(true)
  })
  it('keeps date tagged values structured-cloneable', () => expect(structuredClone(baseDate('2025-01-01'))).toEqual(baseDate('2025-01-01')))
  it('supports string/list length fields and retains ISO offset spelling and fractional precision', () => {
    expect(evaluateBaseExpression('"hello".length', context)).toBe(5)
    expect(evaluateBaseExpression('[1,2,3].length', context)).toBe(3)
    for (const source of ['2025-05-27T12:34:56.123456+09:00', '2025-05-27T12:34:56Z', '2025-05-27T12:34:56+0900']) expect(baseDate(source).value).toBe(source)
  })
  it('retains date-only and local ISO precision while interpreting dates without offsets in local time', () => {
    for (const source of ['2025-05-27', '2025-05-27T12:34', '2025-05-27T12:34:56.12', '2025-05-27 12:34:56']) {
      expect(baseDate(source).value).toBe(source)
      expect(evaluateBaseExpression(`number(date("${source}"))`, context)).toBe(moment(source, [moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss'], true).valueOf())
      expect(evaluateBaseExpression(`date("${source}").format("Z")`, context)).toBe(moment(source).format('Z'))
    }
    expect(evaluateBaseExpression('date("2025-05-27") == date("2025-05-27T00:00")', context)).toBe(true)
  })
})
