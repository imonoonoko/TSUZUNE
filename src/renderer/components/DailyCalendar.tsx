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

interface HeatmapDay {
  date: Date
  dateKey: string
  activity: NoteActivity[]
  count: number
  inYear: boolean
}

interface HeatmapData {
  weeks: HeatmapDay[][]
  monthColumns: Array<{ label: string; weekIndex: number }>
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const HEATMAP_WEEKDAYS = ['', '月', '', '水', '', '金', '']

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function calendarDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function localDateKey(timestamp: number | null | undefined): string | null {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null
  }
  return calendarDateKey(new Date(timestamp))
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

function buildHeatmapData(year: number, activityByDate: Map<string, NoteActivity[]>): HeatmapData {
  const firstDay = new Date(year, 0, 1)
  const lastDay = new Date(year, 11, 31)
  const start = new Date(year, 0, 1 - firstDay.getDay())
  const end = new Date(year, 11, 31 + (6 - lastDay.getDay()))
  const weekCount = Math.round((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  const weeks: HeatmapDay[][] = []

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const week: HeatmapDay[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex)
      const dateKey = calendarDateKey(date)
      const activity = activityByDate.get(dateKey) ?? []
      week.push({
        date,
        dateKey,
        activity,
        count: activity.length,
        inYear: date.getFullYear() === year
      })
    }
    weeks.push(week)
  }

  const monthColumns: Array<{ label: string; weekIndex: number }> = []
  weeks.forEach((week, weekIndex) => {
    const monthStart = week.find((day) => day.inYear && day.date.getDate() === 1)
    if (monthStart) {
      monthColumns.push({ label: `${monthStart.date.getMonth() + 1}月`, weekIndex })
    }
  })

  return { weeks, monthColumns }
}

function activityLevel(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0
  return Math.max(1, Math.ceil((count / maxCount) * 4))
}

export default function DailyCalendar({
  notes,
  selectedPath,
  onSelectDate,
  onOpenNote
}: DailyCalendarProps): React.JSX.Element {
  const today = new Date()
  const currentYear = today.getFullYear()
  const [viewMode, setViewMode] = useState<'heatmap' | 'month'>('heatmap')
  const [visibleYear, setVisibleYear] = useState(() => today.getFullYear())
  const [visibleMonth, setVisibleMonth] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [activeActivityDate, setActiveActivityDate] = useState<string | null>(null)
  const activeActivityTriggerRef = useRef<HTMLButtonElement | null>(null)
  const activityPopoverRef = useRef<HTMLElement | null>(null)
  const notePaths = useMemo(() => new Set(notes.map((note) => note.path)), [notes])
  const activityByDate = useMemo(() => buildNoteActivityIndex(notes), [notes])
  const heatmap = useMemo(
    () => buildHeatmapData(visibleYear, activityByDate),
    [visibleYear, activityByDate]
  )
  const yearEntries = useMemo(
    () => Array.from(activityByDate.entries())
      .filter(([dateKey]) => dateKey.startsWith(`${visibleYear}-`))
      .sort(([left], [right]) => right.localeCompare(left)),
    [activityByDate, visibleYear]
  )
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear])
    activityByDate.forEach((_, dateKey) => years.add(Number(dateKey.slice(0, 4))))
    return Array.from(years).filter(Number.isFinite).sort((left, right) => right - left)
  }, [activityByDate, currentYear])
  const yearActivityDays = yearEntries.length
  const yearActivityTotal = yearEntries.reduce((total, [, entries]) => total + entries.length, 0)
  const maxActivityCount = Math.max(0, ...yearEntries.map(([, entries]) => entries.length))
  const recentActivity = yearEntries.slice(0, 5)
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

  const selectHeatmapDay = (day: HeatmapDay, trigger: HTMLButtonElement): void => {
    activeActivityTriggerRef.current = trigger
    onSelectDate(day.date)
    setActiveActivityDate(day.activity.length > 0 ? day.dateKey : null)
  }

  const selectYear = (nextYear: number): void => {
    setActiveActivityDate(null)
    setVisibleYear(nextYear)
  }

  const showHeatmap = (): void => {
    setActiveActivityDate(null)
    setVisibleYear(visibleMonth.getFullYear())
    setViewMode('heatmap')
  }

  const showMonthView = (): void => {
    setActiveActivityDate(null)
    setVisibleMonth((current) => new Date(visibleYear, current.getMonth(), 1))
    setViewMode('month')
  }

  return (
    <section className="daily-calendar" aria-label="ノート活動カレンダー">
      <header className="daily-calendar-header">
        <div className="daily-calendar-heading">
          <h2 aria-live="polite">{viewMode === 'heatmap' ? `${visibleYear}年` : `${year}年${month + 1}月`}</h2>
          <p>
            {viewMode === 'heatmap'
              ? `${yearActivityDays}日活動 · ${yearActivityTotal}件`
              : '日付を選ぶとデイリーノートを開きます'}
          </p>
        </div>
        <div className="daily-calendar-controls">
          {viewMode === 'heatmap' ? (
            <div className="daily-calendar-year-control">
              <label className="sr-only" htmlFor="daily-calendar-year">表示する年</label>
              <select
                id="daily-calendar-year"
                value={visibleYear}
                aria-label="表示する年"
                onChange={(event) => selectYear(Number(event.target.value))}
              >
                {availableYears.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}年</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="daily-calendar-navigation">
              <button type="button" aria-label="前の月を表示" onClick={() => showMonth(-1)}>‹</button>
              <button type="button" aria-label="次の月を表示" onClick={() => showMonth(1)}>›</button>
            </div>
          )}
          <div className="daily-calendar-view-toggle" role="tablist" aria-label="カレンダー表示">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'heatmap'}
              aria-label="年表示"
              onClick={showHeatmap}
            >
              年
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'month'}
              aria-label="月表示"
              onClick={showMonthView}
            >
              月
            </button>
          </div>
        </div>
      </header>

      {viewMode === 'heatmap' ? (
        <>
          <div className="daily-calendar-heatmap-scroll" tabIndex={0} aria-label={`${visibleYear}年のノート活動ヒートマップ`}>
            <div className="daily-calendar-heatmap">
              <div className="daily-calendar-heatmap-months" aria-hidden="true">
                {heatmap.monthColumns.map((monthColumn) => (
                  <span key={monthColumn.label} style={{ left: `${monthColumn.weekIndex * 15}px` }}>
                    {monthColumn.label}
                  </span>
                ))}
              </div>
              <div className="daily-calendar-heatmap-body">
                <div className="daily-calendar-heatmap-weekdays" aria-hidden="true">
                  {HEATMAP_WEEKDAYS.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
                </div>
                <div className="daily-calendar-heatmap-grid">
                  {heatmap.weeks.map((week, weekIndex) => (
                    <div className="daily-calendar-heatmap-week" key={`week-${weekIndex}`}>
                      {week.map((day) => {
                        if (!day.inYear) {
                          return <span key={day.dateKey} className="daily-calendar-heatmap-cell is-outside" aria-hidden="true" />
                        }
                        const path = dailyNoteLocation(day.date).path
                        const hasNote = notePaths.has(path)
                        const isSelected = path === selectedPath
                        const isToday = isSameLocalDate(day.date, today)
                        const label = `${dateKeyLabel(day.dateKey)}、ノート活動${day.count}件、${hasNote ? 'デイリーノートあり' : 'デイリーノートなし'}`
                        return (
                          <button
                            key={day.dateKey}
                            type="button"
                            className={`daily-calendar-heatmap-cell level-${activityLevel(day.count, maxActivityCount)}${hasNote ? ' has-note' : ''}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${activeActivityDate === day.dateKey ? ' is-activity-selected' : ''}`}
                            aria-label={label}
                            aria-current={isToday ? 'date' : undefined}
                            title={`${dateKeyLabel(day.dateKey)} · ノート活動${day.count}件`}
                            data-date-key={day.dateKey}
                            onClick={(event) => selectHeatmapDay(day, event.currentTarget)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="daily-calendar-heatmap-legend" aria-label="活動量の見方">
            <span>少ない</span>
            <span className="daily-calendar-heatmap-legend-scale" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <i key={index} className={`daily-calendar-heatmap-cell level-${index}`} />
              ))}
            </span>
            <span>多い</span>
          </div>
          <section className="daily-calendar-activity-feed" aria-label="最近のノート活動">
            <header>
              <strong>最近の活動</strong>
              <small>{yearActivityDays}日</small>
            </header>
            {recentActivity.length > 0 ? recentActivity.map(([dateKey, entries]) => {
              const preview = entries.slice(0, 2).map((entry) => entry.note.name).join('、')
              const remaining = entries.length - 2
              return (
                <button
                  key={dateKey}
                  type="button"
                  className="daily-calendar-activity-feed-row"
                  aria-label={`${dateKeyLabel(dateKey)}のノート活動${entries.length}件`}
                  aria-expanded={activeActivityDate === dateKey}
                  aria-controls="daily-calendar-activity-popover"
                  onClick={(event) => {
                    activeActivityTriggerRef.current = event.currentTarget
                    setActiveActivityDate((current) => current === dateKey ? null : dateKey)
                  }}
                >
                  <span className="daily-calendar-activity-feed-copy">
                    <strong>{dateKeyLabel(dateKey)}</strong>
                    <small>{preview}{remaining > 0 ? `、ほか${remaining}件` : ''}</small>
                  </span>
                  <span className="daily-calendar-activity-feed-count">{entries.length}件</span>
                </button>
              )
            }) : (
              <p className="daily-calendar-activity-feed-empty">この年のノート活動はまだありません。</p>
            )}
          </section>
        </>
      ) : (
        <>
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
              const dateKey = calendarDateKey(date)
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
        </>
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
