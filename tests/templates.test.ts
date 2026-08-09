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
    ).toEqual(['90_テンプレート/会議/記録.md', '90_テンプレート/日報.md'])
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
      next: '本番で試す'
    })

    expect(parseDailyNote(markdown)).toEqual({
      completed: '実装した',
      insight: '入力は簡単な方がよい',
      next: '本番で試す'
    })
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
      next: '小さく試す'
    }
    const markdown = renderIdeaNote(values)
    expect(markdown).toBe(
      '# 入力を簡単にする\n\n## アイデア\n\nフォームからノートを作る。\n\n## 思いついた理由\n\nMarkdownを知らなくても使えるようにしたい。\n\n## 関連プロジェクト\n\n- [[10_プロジェクト/TSUZUNE]]\n\n## 次の一歩\n\n- [ ] 小さく試す\n'
    )
    expect(parseIdeaNote(markdown)).toEqual(values)
    expect(parseIdeaNote(`${markdown}\n自由形式の追記`)).toBeNull()
  })
})
