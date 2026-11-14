import { describe, expect, it } from 'vitest'
import {
  dailyNoteLocation,
  ideaNoteLocation,
  listTemplates,
  parseDailyNote,
  parseIdeaNote,
  renderDailyNote,
  renderIdeaNote,
  renderTemplate
} from '../src/core/templates'
import type { NoteDocument } from '../src/shared/types'

function note(path: string): NoteDocument {
  return {
    path,
    name: path.split('/').at(-1)?.replace(/\.md$/, '') ?? path,
    content: '',
    modifiedAt: 1,
    size: 0
  }
}

describe('templates', () => {
  it('lists Markdown notes below the template directory in stable order', () => {
    expect(
      listTemplates([
        note('通常.md'),
        note('90_テンプレート/日報.md'),
        note('90_テンプレート/会議/記録.md')
      ]).map((item) => item.path)
    ).toEqual([
      '90_テンプレート/アイデアメモ.md',
      '90_テンプレート/プロジェクトメモ.md',
      '90_テンプレート/会議/記録.md',
      '90_テンプレート/学びメモ.md',
      '90_テンプレート/今日のノート.md',
      '90_テンプレート/日報.md'
    ])
  })

  it('provides built-in templates without writing them to the Vault', () => {
    const templates = listTemplates([])
    expect(templates.map((item) => item.path)).toEqual([
      '90_テンプレート/アイデアメモ.md',
      '90_テンプレート/プロジェクトメモ.md',
      '90_テンプレート/学びメモ.md',
      '90_テンプレート/今日のノート.md'
    ])
    expect(templates.every((item) => item.modifiedAt === 0)).toBe(true)
    expect(templates.find((item) => item.path.endsWith('学びメモ.md'))?.content).toContain(
      '{{title}}'
    )
    expect(templates.find((item) => item.path.endsWith('今日のノート.md'))?.content).toContain(
      '{{date}}'
    )
  })

  it('publishes the learning memo lifecycle as a built-in template', () => {
    const learningMemo = listTemplates([]).find((item) =>
      item.path.endsWith('学びメモ.md')
    )

    expect(learningMemo?.content).toBe(
      '# {{title}}\n\n## 原典・根拠・時点\n\n## 自分の理解\n\n## 再利用できる主張\n\n## 関連ノート\n\n## 使う場面\n\n## 見直す条件\n\n'
    )
  })

  it('lets a real Vault template override a built-in with the same path', () => {
    const custom = note('90_テンプレート/学びメモ.md')
    custom.content = '# 自分用テンプレート'
    expect(
      listTemplates([custom]).filter((item) => item.path === custom.path)
    ).toEqual([custom])
  })

  it('uses a chosen template folder and can hide all built-in suggestions', () => {
    expect(
      listTemplates(
        [note('雛形/会議/記録.md'), note('90_テンプレート/旧.md')],
        { directory: '雛形', includeBuiltIns: false }
      ).map((item) => item.path)
    ).toEqual(['雛形/会議/記録.md'])

    expect(
      listTemplates([], { directory: '雛形', includeBuiltIns: true }).map(
        (item) => item.path
      )
    ).toContain('雛形/今日のノート.md')
  })

  it('replaces supported placeholders and preserves unknown ones', () => {
    const result = renderTemplate(
      '# {{title}}\n{{date}} {{time}} {{datetime}} {{unknown}}',
      { title: '設計メモ', now: new Date(2026, 7, 9, 7, 5) }
    )

    expect(result).toBe(
      '# 設計メモ\n2026-08-09 07:05 2026-08-09T07:05 {{unknown}}'
    )
  })

  it('formats each date/time variable without changing the bare defaults', () => {
    expect(renderTemplate(
      '{{date:YYYY/MM/DD}} | {{time:HH:mm:ss}} | {{datetime:YYYY-MM-DD[T]HH:mm:ss}} | {{date}} {{time}} {{datetime}}',
      { title: '記録', now: new Date(2026, 7, 9, 7, 5, 3) }
    )).toBe('2026/08/09 | 07:05:03 | 2026-08-09T07:05:03 | 2026-08-09 07:05 2026-08-09T07:05')
  })

  it.each([
    [new Date(2024, 1, 29, 0, 5, 9), '2024 24 2 02 29 29 0 00 12 12 5 05 9 09 AM am'],
    [new Date(2026, 11, 31, 12, 0, 0), '2026 26 12 12 31 31 12 12 12 12 0 00 0 00 PM pm'],
    [new Date(2027, 0, 1, 23, 59, 59), '2027 27 1 01 1 01 23 23 11 11 59 59 59 59 PM pm']
  ])('formats all supported numeric and meridiem tokens at local boundaries (%s)', (now, expected) => {
    expect(renderTemplate('{{datetime:YYYY YY M MM D DD H HH h hh m mm s ss A a}}', { title: '', now })).toBe(expected)
  })

  it('keeps separators, Japanese and bracketed text and supports adjacent tokens', () => {
    const now = new Date(2026, 0, 2, 3, 4, 5)
    expect(renderTemplate('{{date:YYYYMMDD}} {{date:YYYY年M月D日}} {{time:[at] h:m:s a}}', { title: '', now }))
      .toBe('20260102 2026年1月2日 at 3:4:5 am')
  })

  it.each([
    '{{date:}}', '{{date:MMMM}}', '{{time:HH:mm Z}}', '{{date:ddd}}', '{{date:YYY}}',
    '{{date:YYYY[broken}}', '{{date:YYYY]}}', '{{date:YYYY[[nested]]}}',
    '{{date:YYYY\nMM}}', '{{date:YYYY{MM}}}', '{{date:{{time}}}}',
    '{{title:YYYY}}', '{{unknown}}', '{date:YYYY}', '{{ date:YYYY}}'
  ])('preserves unsupported or malformed text verbatim: %s', source => {
    expect(renderTemplate(source, { title: '題名', now: new Date(2026, 0, 2) })).toBe(source)
  })

  it('inserts title data once without reinterpreting its braces or replacement markers', () => {
    const title = '{{date}} {{time:HH}} $&'
    expect(renderTemplate('{{title}} / {{date}}', { title, now: new Date(2026, 0, 2) }))
      .toBe(title + ' / 2026-01-02')
  })

  it('uses the supplied local instant for every variable on either side of midnight', () => {
    const source = '{{date}} {{time}} {{datetime:YYYY-MM-DD HH:mm:ss}}'
    expect(renderTemplate(source, { title: '', now: new Date(2026, 11, 31, 23, 59, 59) }))
      .toBe('2026-12-31 23:59 2026-12-31 23:59:59')
    expect(renderTemplate(source, { title: '', now: new Date(2027, 0, 1, 0, 0, 0) }))
      .toBe('2027-01-01 00:00 2027-01-01 00:00:00')
  })

  it('builds one stable daily note path and omits empty sections', () => {
    const now = new Date(2026, 7, 9, 7, 5)

    expect(dailyNoteLocation(now)).toEqual({
      directory: '02_デイリー',
      name: '2026-08-09',
      path: '02_デイリー/2026-08-09.md'
    })
    expect(
      renderDailyNote({
        now,
        completed: '実装を確認した',
        insight: '',
        next: '本番で試す'
      })
    ).toBe(
      '# 2026-08-09\n\n## 今日やったこと\n\n実装を確認した\n\n## 次にすること\n\n- [ ] 本番で試す\n'
    )
  })

  it('round-trips generated daily notes and rejects manual additions', () => {
    const markdown = renderDailyNote({
      now: new Date(2026, 7, 9, 12),
      completed: '実装した',
      insight: '入力は簡単な方がよい',
      memo: '形式に縛られない追記',
      next: '本番で試す\n結果を共有する'
    })

    expect(parseDailyNote(markdown)).toEqual({
      completed: '実装した',
      insight: '入力は簡単な方がよい',
      memo: '形式に縛られない追記',
      next: '本番で試す\n結果を共有する'
    })
    expect(markdown).toContain('- [ ] 本番で試す\n- [ ] 結果を共有する')
    expect(parseDailyNote(`${markdown}\n手書きの追記`)).toBeNull()
  })

  it('builds a portable idea note with an optional project link', () => {
    expect(ideaNoteLocation('入力を簡単にする')).toEqual({
      directory: '01_受信箱/アイデア',
      name: '入力を簡単にする',
      path: '01_受信箱/アイデア/入力を簡単にする.md'
    })
    const values = {
      title: '入力を簡単にする',
      body: 'フォームからノートを作る。',
      reason: 'Markdownを知らなくても使えるようにしたい。',
      projectPath: '10_プロジェクト/TSUZUNE.md',
      next: '小さく試す\n結果を記録する',
      memo: '自由に残した補足'
    }
    const markdown = renderIdeaNote(values)
    expect(markdown).toBe(
      '# 入力を簡単にする\n\n## アイデア\n\nフォームからノートを作る。\n\n## 思いついた理由\n\nMarkdownを知らなくても使えるようにしたい。\n\n## 関連プロジェクト\n\n- [[10_プロジェクト/TSUZUNE]]\n\n## メモ\n\n自由に残した補足\n\n## 次の一歩\n\n- [ ] 小さく試す\n- [ ] 結果を記録する\n'
    )
    expect(parseIdeaNote(markdown)).toEqual(values)
    expect(parseIdeaNote(`${markdown}\n自由形式の追記`)).toBeNull()
  })
})
