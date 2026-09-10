import type { ReactNode } from 'react'
import tsuzuneMark from '../assets/tsuzune-app-icon.png'
import Icon from './Icon'

interface DailyProfileProps {
  noteCount: number
  dailyNoteCount: number
  selectedNoteName: string | null
  todayNoteAvailable: boolean
  onOpenToday: () => void
  onReturnToNote: () => void
  children: ReactNode
}

export default function DailyProfile({
  noteCount,
  dailyNoteCount,
  selectedNoteName,
  todayNoteAvailable,
  onOpenToday,
  onReturnToNote,
  children
}: DailyProfileProps): React.JSX.Element {
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
            <button type="button" className="daily-profile-action" onClick={onOpenToday}>
              <Icon name="calendar" />
              今日のノート
            </button>
          </div>
        </header>

        <section className="daily-profile-identity" aria-label="TSUZUNEのノート活動">
          <img className="daily-profile-avatar" src={tsuzuneMark} alt="" aria-hidden="true" />
          <h2>TSUZUNE</h2>
          <p>Local Vault <span aria-hidden="true">·</span> Personal knowledge workspace</p>
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
