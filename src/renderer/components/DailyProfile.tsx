import { useEffect, useState, type ReactNode } from 'react'
import tsuzuneMark from '../assets/tsuzune-app-icon.png'
import type { UserProfile } from '../../shared/types'
import Icon from './Icon'

interface DailyProfileProps {
  noteCount: number
  dailyNoteCount: number
  selectedNoteName: string | null
  todayNoteAvailable: boolean
  userProfile: UserProfile
  userNoteAvailable: boolean
  onOpenToday: () => void
  onReturnToNote: () => void
  onOpenUserNote: () => void
  onChangeAvatar: () => void
  children: ReactNode
}

export default function DailyProfile({
  noteCount,
  dailyNoteCount,
  selectedNoteName,
  todayNoteAvailable,
  userProfile,
  userNoteAvailable,
  onOpenToday,
  onReturnToNote,
  onOpenUserNote,
  onChangeAvatar,
  children
}: DailyProfileProps): React.JSX.Element {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setAvatarUrl(null)
    const iconPath = userProfile.iconPath?.trim()
    if (!iconPath) {
      setAvatarUrl(null)
      return
    }

    if (iconPath.startsWith('data:') || iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      setAvatarUrl(iconPath)
      return
    }

    void window.tsuzune.readVaultImage(iconPath).then((result) => {
      if (!active) return
      if (result.ok) {
        setAvatarUrl(result.value)
      } else {
        setAvatarUrl(null)
      }
    })

    return () => {
      active = false
    }
  }, [userProfile.iconPath])

  const displayName = userProfile.name?.trim() || 'TSUZUNE'
  const displayDescription =
    userProfile.description?.trim() || 'Local Vault · Personal knowledge workspace'

  return (
    <section className="daily-profile-view" aria-labelledby="daily-profile-title">
      <div className="daily-profile-inner">
        <header className="daily-profile-topbar">
          <h1 id="daily-profile-title">ノート活動</h1>
          <div className="daily-profile-actions">
            {selectedNoteName && (
              <button type="button" className="daily-profile-action" onClick={onReturnToNote}>
                <Icon name="note" />
                ノートに戻る
              </button>
            )}
            <button
              type="button"
              className="daily-profile-action"
              onClick={onOpenUserNote}
              title="user.md を開いてプロフィールを編集"
            >
              <Icon name="edit" />
              {userNoteAvailable ? 'user.md を開く' : 'user.md を作成'}
            </button>
            <button type="button" className="daily-profile-action" onClick={onOpenToday}>
              <Icon name="calendar" />
              今日のノート
            </button>
          </div>
        </header>

        <section className="daily-profile-identity" aria-label="ユーザープロフィール">
          <div className="daily-profile-avatar-wrapper">
            <img
              className="daily-profile-avatar"
              src={avatarUrl || tsuzuneMark}
              onError={() => setAvatarUrl(null)}
              alt={displayName}
              aria-hidden="true"
            />
            <button
              type="button"
              className="daily-profile-avatar-edit"
              onClick={onChangeAvatar}
              title="アイコン画像を変更"
              aria-label="アイコン画像を変更"
            >
              <Icon name="edit" />
            </button>
          </div>
          <h2>{displayName}</h2>
          <p>{displayDescription}</p>
        </section>

        <div className="daily-profile-stats" aria-label="ノート活動の概要">
          <div>
            <strong>{noteCount.toLocaleString('ja-JP')}</strong>
            <span>Vaultのノート</span>
          </div>
          <div>
            <strong>{dailyNoteCount.toLocaleString('ja-JP')}</strong>
            <span>デイリーノート</span>
          </div>
          <div>
            <strong>年 / 月</strong>
            <span>活動表示</span>
          </div>
          <div>
            <strong title={selectedNoteName ?? undefined}>
              {selectedNoteName ?? '—'}
            </strong>
            <span>現在の文脈</span>
          </div>
          <div>
            <strong>{todayNoteAvailable ? 'あり' : '未作成'}</strong>
            <span>今日のノート</span>
          </div>
        </div>

        <section className="daily-profile-activity" aria-labelledby="daily-profile-activity-title">
          <header className="daily-profile-section-heading">
            <div>
              <h2 id="daily-profile-activity-title">ノートの活動状況</h2>
              <p>日付を選ぶと、その日のノートを開けます。</p>
            </div>
          </header>
          <div className="daily-profile-calendar-shell">{children}</div>
        </section>

        <div className="daily-profile-lower-grid">
          <section className="daily-profile-card" aria-labelledby="daily-profile-insights-title">
            <header>
              <h2 id="daily-profile-insights-title">活動の分析情報</h2>
            </header>
            <dl>
              <div>
                <dt>Vaultのノート</dt>
                <dd>{noteCount.toLocaleString('ja-JP')}件</dd>
              </div>
              <div>
                <dt>デイリーノート</dt>
                <dd>{dailyNoteCount.toLocaleString('ja-JP')}件</dd>
              </div>
              <div>
                <dt>現在の文脈</dt>
                <dd title={selectedNoteName ?? undefined}>{selectedNoteName ?? 'ノート未選択'}</dd>
              </div>
            </dl>
          </section>

          <section className="daily-profile-card" aria-labelledby="daily-profile-user-title">
            <header>
              <h2 id="daily-profile-user-title">ユーザー情報 (user.md)</h2>
            </header>
            <p className="daily-profile-help-copy">
              名前・説明・アイコンを設定するMarkdownノートです。AIに伝えたい情報も記載できます。
            </p>
            <div className="daily-profile-card-actions">
              <button type="button" className="daily-profile-shortcut" onClick={onOpenUserNote}>
                <Icon name="note" />
                <span>
                  <strong>user.md を開く</strong>
                  <small>{userNoteAvailable ? 'エディタで編集・閲覧' : 'テンプレートから新規作成'}</small>
                </span>
              </button>
              <button type="button" className="daily-profile-shortcut" onClick={onChangeAvatar}>
                <Icon name="edit" />
                <span>
                  <strong>アイコン画像を変更</strong>
                  <small>ファイルから画像を選択</small>
                </span>
              </button>
            </div>
          </section>

          <section className="daily-profile-card" aria-labelledby="daily-profile-help-title">
            <header>
              <h2 id="daily-profile-help-title">ノート活動の使い方</h2>
            </header>
            <p className="daily-profile-help-copy">
              活動のある日付を選ぶと、該当するノートを確認できます。
            </p>
            <button type="button" className="daily-profile-shortcut" onClick={onOpenToday}>
              <Icon name="calendar" />
              <span>
                <strong>今日のノートを開く</strong>
                <small>{todayNoteAvailable ? '既存のノートを表示' : '新しいノートを作成'}</small>
              </span>
            </button>
          </section>
        </div>
      </div>
    </section>
  )
}
