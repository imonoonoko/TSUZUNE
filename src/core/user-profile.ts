import { parseFrontmatter } from './frontmatter'
import type { NoteDocument, UserProfile } from '../shared/types'

export function parseUserProfile(note: NoteDocument | null): UserProfile {
  if (!note) {
    return { name: null, description: null, iconPath: null }
  }

  const result = parseFrontmatter(note.content)
  if (!result.found) {
    return { name: null, description: null, iconPath: null }
  }

  return {
    name: result.attributes.name ?? null,
    description: result.attributes.description ?? null,
    iconPath: result.attributes.icon ?? null
  }
}

export function createUserProfileMarkdown(iconPath = ''): string {
  return [
        '---',
        'name: Humin',
        'description: 工房主 · 個人開発者',
        `icon: ${JSON.stringify(iconPath)}`,
        '---',
        '',
        '# ユーザー定義 (user.md)',
        '',
        '## 基本情報',
        '- 呼び名: 工房主 / Humin',
        '- 役割・立場: TSUZUNE の設計・開発・運用者',
        '',
        '## コミュニケーション方針',
        '- 結論ファーストで簡潔に',
        '- 危険なコマンドや破壊的操作の前には確認を求める',
        '- 日本語で自然かつ敬意を持ったトーン',
        '',
        '## 作業ルール & 好み',
        '- 設計を固めてから実装に入る',
        '- 変更前に既存のコードやVaultルールを尊重する',
        ''
      ].join('\n')
}
