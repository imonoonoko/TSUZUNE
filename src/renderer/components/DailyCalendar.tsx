import { useEffect, useMemo, useRef, useState } from 'react'
import { dailyNoteLocation } from '../../core/templates'
import type { NoteDocument } from '../../shared/types'

interface DailyCalendarProps {
  notes: NoteDocument[]
  selectedPath: string | null
  onSelectDate: (date: Date) => void
  onOpenNote: (path: string) => Promise<unknown> | unknown
}

interface NoteActivity {
  note: NoteDocument
  created: boolean
  modified: boolean
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function localDateKey(timestamp: number | null | undefined): string | null {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null
  }
  const date = new Date(timestamp)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function isNoteActivityVisible(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  return normalized !== '50_履歴' && !normalized.startsWith('50_履歴/')
}

function buildNoteActivityIndex(notes: NoteDocument[]): Map<string, NoteActivity[]> {
  const index = new Map<string, Map<string, NoteActivity>>()
  const add = (dateKey: string | null, note: NoteDocument, kind: 'created' | 'modified'): void => {
    if (!dateKey) return
    const entries = index.get(dateKey) ?? new Map<string, NoteActivity>()
    const activity = entries.get(note.path) ?? { note, created: false, modified: false }
    activity[kind] = true
    entries.set(note.path, activity)
    index.set(dateKey, entries)
  }

  for (const note of notes) {
    if (!isNoteActivityVisible(note.path)) continue
    add(localDateKey(note.createdAt), note, 'created')
    add(localDateKey(note.modifiedAt), note, 'modified')
  }

  return new Map(
    Array.from(index, ([dateKey, entries]) => [
      dateKey,
      Array.from(entries.values()).sort((left, right) =>
        left.note.name.localeCompare(right.note.name, 'ja')
      )
    ])
  )
}

function activityCounts(entries: NoteActivity[]): { created: number; modified: number } {
  return {
    created: entries.filter((entry) => entry.created).length,
    modified: entries.filter((entry) => entry.modified).length
  }
}

function dateKeyLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export default function DailyCalendar({
  notes,
  selectedPath,
  onSelectDate,
  onOpenNote
}: DailyCalendarProps): React.JSX.Element {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [activeActivityDate, setActiveActivityDate] = useState<string | null>(null)
  const activeActivityTriggerRef = useRef<HTMLButtonElement | null>(null)
  const activityPopoverRef = useRef<HTMLElement | null>(null)
  const notePaths = useMemo(() => new Set(notes.map((note) => note.path)), [notes])
  const activityByDate = useMemo(() => buildNoteActivityIndex(notes), [notes])
  const today = new Date()
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const leadingDays = visibleMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const visibleMonthKey = `${year}-${String(month + 1).padStart(2, '0')}-`
  const hasVisibleActivity = Array.from(activityByDate.keys()).some((dateKey) =>
    dateKey.startsWith(visibleMonthKey)
  )
  const activeActivity = activeActivityDate
    ? activityByDate.get(activeActivityDate) ?? []
    : []

  useEffect(() => {
    if (!activeActivityDate) return

    const closeFromOutside = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        activityPopoverRef.current?.contains(target) ||
        activeActivityTriggerRef.current?.contains(target)
      ) {
        return
      }
      setActiveActivityDate(null)
    }
    const closeFromEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setActiveActivityDate(null)
      activeActivityTriggerRef.current?.focus()
    }

    document.addEventListener('mousedown', closeFromOutside)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('mousedown', closeFromOutside)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [activeActivityDate])

  const showMonth = (offset: number): void => {
    setActiveActivityDate(null)
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <section className="daily-calendar" aria-label="デイリーカレンダー">
      <header className="daily-calendar-header">
        <h2 aria-live="polite">{year}年{month + 1}月</h2>
        <div className="daily-calendar-navigation">
          <button type="button" aria-label="前の月を表示" onClick={() => showMonth(-1)}>‹</button>
          <button type="button" aria-label="次の月を表示" onClick={() => showMonth(1)}>›</button>
        </div>
      </header>
      <div className="daily-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="daily-calendar-days">
        {Array.from({ length: leadingDays }, (_, index) => (
          <span key={`leading-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1
          const date = new Date(year, month, day)
          const path = dailyNoteLocation(date).path
          const hasNote = notePaths.has(path)
          const isToday = isSameLocalDate(date, today)
          const isSelected = path === selectedPath
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const activity = activityByDate.get(dateKey) ?? []
          const counts = activityCounts(activity)
          const label = `${year}年${month + 1}月${day}日、${hasNote ? 'ノートあり' : 'ノートなし'}`

          return (
            <div key={path} className="daily-calendar-cell">
              <button
                type="button"
                className={`daily-calendar-day${hasNote ? ' has-note' : ''}${isSelected ? ' is-selected' : ''}`}
                aria-label={label}
                aria-current={isToday ? 'date' : undefined}
                title={`${month + 1}月${day}日${hasNote ? '（ノートあり）' : '（未作成）'}`}
                onClick={() => onSelectDate(date)}
              >
                {day}
              </button>
              {activity.length > 0 && (
                <button
                  type="button"
                  className={`daily-calendar-activity-trigger${activeActivityDate === dateKey ? ' is-selected' : ''}`}
                  aria-label={`${month + 1}月${day}日: 作成${counts.created}件、最終更新${counts.modified}件`}
                  aria-expanded={activeActivityDate === dateKey}
                  aria-controls="daily-calendar-activity-popover"
                  title={`ノート活動: 作成 ${counts.created}件 / 最終更新 ${counts.modified}件`}
                  onClick={(event) => {
                    activeActivityTriggerRef.current = event.currentTarget
                    setActiveActivityDate((current) => current === dateKey ? null : dateKey)
                  }}
                >
                  {counts.created > 0 && <span className="daily-calendar-activity-mark is-created" aria-hidden="true">＋</span>}
                  {counts.modified > 0 && <span className="daily-calendar-activity-mark is-modified" aria-hidden="true">•</span>}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {hasVisibleActivity && (
        <div className="daily-calendar-activity-legend" aria-label="ノート活動の見方">
          <div className="daily-calendar-activity-legend-heading">
            <strong>ノート活動</strong>
            <small>日付の印を押すと一覧</small>
          </div>
          <span><i className="daily-calendar-activity-mark is-created" aria-hidden="true">＋</i>作成</span>
          <span><i className="daily-calendar-activity-mark is-modified" aria-hidden="true">•</i>更新</span>
        </div>
      )}
      {activeActivityDate && activeActivity.length > 0 && (
        <aside
          ref={activityPopoverRef}
          id="daily-calendar-activity-popover"
          className="daily-calendar-activity-popover"
          role="dialog"
          aria-label={`${dateKeyLabel(activeActivityDate)}のノート活動`}
        >
          <header>
            <strong>{dateKeyLabel(activeActivityDate)}</strong>
            <button
              type="button"
              aria-label="ノート活動を閉じる"
              onClick={() => {
                setActiveActivityDate(null)
                activeActivityTriggerRef.current?.focus()
              }}
            >
              ×
            </button>
          </header>
          <div className="daily-calendar-activity-summary">
            <span className="is-created">作成 {activityCounts(activeActivity).created}</span>
            <span className="is-modified">最終更新 {activityCounts(activeActivity).modified}</span>
          </div>
          <div className="daily-calendar-activity-list">
            {activeActivity.map((entry) => (
              <button
                key={entry.note.path}
                type="button"
                className="daily-calendar-activity-note"
                aria-label={`${entry.note.name}を開く`}
                onClick={() => {
                  setActiveActivityDate(null)
                  void onOpenNote(entry.note.path)
                }}
              >
                <span className="daily-calendar-activity-copy">
                  <strong>{entry.note.name}</strong>
                  <small>{entry.note.path}</small>
                </span>
                <span className="daily-calendar-activity-kinds" aria-hidden="true">
                  {entry.created && <i className="is-created">作成</i>}
                  {entry.modified && <i className="is-modified">更新</i>}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </section>
  )
}
