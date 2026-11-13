import type { BaseDiagnostic, BaseProfile } from '../../core/base-profile'
import type {
  BaseCell,
  BaseEvaluation,
  BaseEvaluationDiagnostic
} from '../../core/base-evaluator'

export type BaseTableState =
  | { status: 'loading'; path: string }
  | { status: 'missing'; path: string; message: string }
  | { status: 'error'; path: string; message: string }
  | { status: 'diagnostic'; path: string; diagnostics: BaseDiagnostic[] }
  | {
      status: 'ready'
      path: string
      profile: BaseProfile
      evaluation: BaseEvaluation
      content?: string
      modifiedAt?: number
      notes?: NoteDocument[]
      declaredTypes?: Record<string, string>
      viewIndex?: number
    }

type BaseTableViewProps = {
  state: BaseTableState
  onReload: () => void
  onOpenNote: (path: string) => void
  onEditCell?: (path: string, property: string) => void
  editingDisabled?: boolean
  onSelectView?: (viewIndex: number) => void
  onSaveProfile?: (content: string) => void
  onPreviewProfile?: (content: string, viewIndex: number) => void | Promise<boolean | void>
  onResolveImage?: (path: string) => Promise<string | null>
  onMoveCard?: (path: string, operation: Extract<import('../../shared/property-changes').PropertyChangeOperation, { kind: 'set' }>) => void
  evaluating?: boolean
  onStopEvaluation?: () => void
}

function cellText(cell: BaseCell): string {
  if (cell.kind === 'missing') return '—'
  if (cell.kind === 'empty') return ''
  if (cell.kind === 'diagnostic') return `未対応: ${cell.message}`
  return baseValueText(cell.value)
}

function BaseImage({ path, resolve }: { path: string; resolve?: (path: string) => Promise<string | null> }): React.JSX.Element {
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => { let current = true; setSource(null); if (/^https?:\/\//i.test(path)) setSource(path); else if (resolve) void resolve(path).then((result) => { if (current) setSource(result) }).catch(() => {}); return () => { current = false } }, [path, resolve])
  return source ? <img src={source} alt={path} loading="lazy" style={{ maxWidth: 160, maxHeight: 120 }} /> : <span>{path}</span>
}
function BaseValueDisplay({ value, open, image }: { value: BaseValue; open: (path: string) => void; image?: (path: string) => Promise<string | null> }): React.JSX.Element {
  if (Array.isArray(value)) return <span>{value.map((item, index) => <span key={index}>{index ? ', ' : ''}<BaseValueDisplay value={item} open={open} image={image} /></span>)}</span>
  if (special(value, 'html')) return <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value.value, { FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'img', 'video', 'audio'], FORBID_ATTR: ['style'], ALLOWED_URI_REGEXP: /^https?:\/\//i }) }} />
  if (special(value, 'image')) return <BaseImage path={value.value} resolve={image} />
  if (special(value, 'icon')) { const key = value.value.replace(/(^|-)([a-z])/g, (_, __, letter: string) => letter.toUpperCase()) as keyof typeof icons; const Icon = icons[key]; return Icon ? <Icon size={18} aria-label={value.value} /> : <span>{value.value}</span> }
  if (special(value, 'link')) { const label = value.label != null ? <BaseValueDisplay value={value.label} open={open} image={image} /> : baseValueText(value); return /^https?:\/\//i.test(value.value) ? <a href={value.value} target="_blank" rel="noopener noreferrer">{label}</a> : <button type="button" className="base-table-note-link" onClick={() => open(value.value)}>{label}</button> }
  return <span>{baseValueText(value)}</span>
}

function diagnosticText(diagnostic: BaseDiagnostic | BaseEvaluationDiagnostic): string {
  const location = 'line' in diagnostic && diagnostic.line
    ? `（${diagnostic.line}行目）`
    : 'path' in diagnostic && diagnostic.path
      ? `（${diagnostic.path}${'property' in diagnostic && diagnostic.property ? `・${diagnostic.property}` : ''}）`
      : ''
  return `${diagnostic.message}${location}`
}

export default function BaseTableView({
  state,
  onReload,
  onOpenNote,
  onEditCell,
  editingDisabled,
  onSelectView,
  onSaveProfile,
  onPreviewProfile,
  onResolveImage,
  onMoveCard,
  evaluating,
  onStopEvaluation
}: BaseTableViewProps): React.JSX.Element {
  const [settings, setSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  if (state.status === 'loading') {
    return (
      <section className="base-table-panel" aria-label="Baseテーブル">
        <p role="status" aria-live="polite">Baseを読み込んでいます…</p>
        {evaluating && onStopEvaluation && <button type="button" onClick={onStopEvaluation}>評価を停止</button>}
      </section>
    )
  }

  if (state.status === 'missing' || state.status === 'error') {
    return (
      <section className="base-table-panel" aria-label="Baseテーブル">
        <h2>{state.path}</h2>
        <p role="alert">{state.message}</p>
        <button type="button" className="primary-button" onClick={onReload}>再読み込み</button>
      </section>
    )
  }

  if (state.status === 'diagnostic') {
    return (
      <section className="base-table-panel" aria-label="Baseテーブル">
        <h2>{state.path}</h2>
        <div role="alert" className="base-table-diagnostics">
          <strong>Baseを表示できません。</strong>
          <ul>
            {state.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:${diagnostic.line ?? index}`}>{diagnosticText(diagnostic)}</li>
            ))}
          </ul>
        </div>
        <button type="button" className="primary-button" onClick={onReload}>再読み込み</button>
      </section>
    )
  }

  const { profile, evaluation } = state
  const selectedView = state.viewIndex ?? evaluation.viewIndex ?? 0
  const view = (profile.views ?? [profile.view])[selectedView] ?? profile.view
  const canMoveTo = (index: number): boolean => Boolean(onMoveCard && !editingDisabled && state.status === 'ready' && evaluation.groups?.[index]?.rows.length)
  const canDragCard = (path: string): boolean => Boolean(onMoveCard && !editingDisabled && state.status === 'ready' && evaluation.groups?.some((_, index) => kanbanMove(state, path, index)))
  const downloadBase = (format: 'csv' | 'tsv'): void => {
    let content: string
    try {
      content = serializeBaseExport(evaluation, format)
      setExportError(null)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '書き出しに失敗しました。')
      return
    }
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/tab-separated-values;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${view.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.${format}`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const rows = searchBaseRows(evaluation, query)
  const visiblePaths = new Set(rows.map(row => row.path))
  const renderRows = (sourceRows: BaseEvaluation['rows']): React.JSX.Element[] => sourceRows.filter(row => visiblePaths.has(row.path)).map((row) => (
    <tr key={row.path}>{evaluation.columns.map((column) => {
      const cell = row.cells[column] ?? { kind: 'missing' as const }; const value = cellText(cell)
      return <td key={column}>{column === 'file.name' || column === 'file.path' ? <button type="button" className="base-table-note-link" aria-label={`${row.path}を開く`} onClick={() => onOpenNote(row.path)}>{value || '—'}</button> : cell.kind === 'value' ? <BaseValueDisplay value={cell.value} open={onOpenNote} image={onResolveImage} /> : value}
        {!column.startsWith('file.') && !column.startsWith('formula.') && onEditCell && <button type="button" className="base-cell-edit" disabled={editingDisabled} aria-label={`${row.path}の${column}を編集`} onClick={() => cell.kind === 'diagnostic' ? onOpenNote(row.path) : onEditCell(row.path, column.replace(/^note\./, ''))}>{cell.kind === 'diagnostic' ? 'ソースで編集' : '編集'}</button>}
      </td>
    })}</tr>
  ))
  const renderCard = (row: BaseEvaluation['rows'][number]): React.JSX.Element => {
    const cover = view.image ? row.cells[view.image] : undefined
    return <article className="base-card" key={row.path} draggable={view.type === 'kanban' && canDragCard(row.path)} onDragStart={event => { if (!canDragCard(row.path)) { event.preventDefault(); return }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(kanbanCardMime, row.path) }}>
      <h3><button type="button" className="base-table-note-link" aria-label={`${cellText(row.cells['file.name'] ?? { kind: 'missing' })}を開く`} onClick={() => onOpenNote(row.path)}>{cellText(row.cells['file.name'] ?? { kind: 'value', value: row.path.split('/').at(-1) ?? row.path })}</button></h3>
      {cover?.kind === 'value' && <BaseValueDisplay value={cover.value} open={onOpenNote} image={onResolveImage} />}
      <dl>{evaluation.columns.filter(column => column !== 'file.name').map(column => <div key={column}><dt>{evaluation.labels?.[column] ?? column}</dt><dd>{row.cells[column]?.kind === 'value' ? <BaseValueDisplay value={row.cells[column].value} open={onOpenNote} image={onResolveImage} /> : cellText(row.cells[column] ?? { kind: 'missing' })}{!column.startsWith('file.') && !column.startsWith('formula.') && onEditCell && <button type="button" className="base-cell-edit" disabled={editingDisabled} aria-label={`${row.path}の${column}を編集`} onClick={() => onEditCell(row.path, column.replace(/^note\./, ''))}>編集</button>}</dd></div>)}</dl>
    </article>
  }
  const renderSummary = (values: Record<string, BaseCell> | undefined): React.JSX.Element => <tr className="base-summary-row">{evaluation.columns.map((column) => <td key={column}>{values?.[column] ? cellText(values[column]) : ''}</td>)}</tr>
  return (
    <section className="base-table-panel" aria-label="Baseテーブル">
      <header className="base-table-header">
        <div>
          <h2>{view.name}</h2>
          <p>{state.path}</p>
        </div>
        <div className="base-table-meta" aria-label="Baseの状態">
          <span>可視スナップショット</span>
          <span>{rows.length}行 / 対象 {evaluation.targetCount}件</span>
          <label>検索<input type="search" aria-label="Base内を検索" value={query} onChange={event => setQuery(event.target.value)} maxLength={256} /></label>
          <button type="button" onClick={() => downloadBase('csv')}>CSVを書き出す</button>
          <button type="button" onClick={() => downloadBase('tsv')}>TSVを書き出す</button>
          <button type="button" onClick={onReload}>再読み込み</button>
          {(profile.views?.length ?? 1) > 1 && <label>ビュー<select value={selectedView} onChange={(event) => onSelectView?.(Number(event.target.value))}>{profile.views!.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>}
          {onSaveProfile && state.content && <button type="button" onClick={() => setSettings(!settings)}>設定</button>}
          {evaluating && <><span role="status">評価中…</span><button type="button" onClick={onStopEvaluation}>評価を停止</button></>}
        </div>
      </header>
      {exportError && <p role="alert">{exportError}</p>}
      {settings && state.content && onSaveProfile && <BaseSettingsPanel key={state.path} content={state.content} profile={profile} selectedView={selectedView} disabled={editingDisabled} onSave={onSaveProfile} onPreview={(content, index) => onPreviewProfile?.(content, index)} onClose={() => setSettings(false)} />}
      {evaluation.diagnostics.length > 0 && (
        <div role="status" className="base-table-diagnostics">
          <strong>一部のPropertyを表示できません。</strong>
          <ul>
            {evaluation.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}:${diagnostic.path ?? index}:${diagnostic.property ?? ''}`}>
                {diagnosticText(diagnostic)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="base-table-empty" role="status">条件に一致するノートはありません。</p>
      ) : view.type === 'kanban' ? (
        <div className={`base-kanban-board base-width-${view.columnWidth ?? 'default'}`} aria-label="Kanbanボード">{(evaluation.groups ?? []).map((group, index) => <section className="base-kanban-column" key={index} onDragOver={event => { if (canMoveTo(index) && Array.from(event.dataTransfer.types).includes(kanbanCardMime)) event.preventDefault() }} onDrop={event => { if (!canMoveTo(index) || !Array.from(event.dataTransfer.types).includes(kanbanCardMime)) return; event.preventDefault(); const path = event.dataTransfer.getData(kanbanCardMime); const operation = kanbanMove(state, path, index); if (operation) onMoveCard?.(path, operation) }}><h3>{baseValueText(group.key) || '（空）'} <span>{group.rows.filter(row => visiblePaths.has(row.path)).length}</span></h3><div>{group.rows.filter(row => visiblePaths.has(row.path)).map(row => renderCard(row))}</div></section>)}</div>
      ) : view.type === 'cards' ? (
        <div className={`base-cards-grid base-width-${view.cardWidth ?? 'default'}`}>{(evaluation.groups ? evaluation.groups.flatMap(group => group.rows) : rows).filter(row => visiblePaths.has(row.path)).map(renderCard)}</div>
      ) : view.type === 'list' ? (
        <ol className="base-list-view" style={{ listStyleType: view.markers === 'none' ? 'none' : view.markers === 'numbers' ? 'decimal' : 'disc' }}>{rows.map(row => <li key={row.path}><button type="button" className="base-table-note-link" onClick={() => onOpenNote(row.path)}>{cellText(row.cells['file.name'] ?? { kind: 'value', value: row.path.split('/').at(-1) ?? row.path })}</button><span>{evaluation.columns.filter(column => column !== 'file.name').map(column => `${evaluation.labels?.[column] ?? column}: ${cellText(row.cells[column] ?? { kind: 'missing' })}`).join(view.separator ?? ' · ')}</span></li>)}</ol>
      ) : (
        <div className="base-table-scroll">
          <table>
            <caption>{view.name}（file.* / formula.* は読み取り専用）</caption>
            <thead>
              <tr>
                {evaluation.columns.map((column) => <th key={column} scope="col">{evaluation.labels?.[column] ?? column}</th>)}
              </tr>
            </thead>
            <tbody>
              {evaluation.groups ? evaluation.groups.map((group, index) => <GroupRows key={index} name={baseValueText(group.key) || '（空）'} columns={evaluation.columns.length} rows={renderRows(group.rows)} summary={renderSummary(group.summaries)} />) : renderRows(rows)}
            </tbody>
            {evaluation.summaries && Object.keys(evaluation.summaries).length > 0 && <tfoot>{renderSummary(evaluation.summaries)}</tfoot>}
          </table>
        </div>
      )}
    </section>
  )
}
function GroupRows({ name, columns, rows, summary }: { name: string; columns: number; rows: React.JSX.Element[]; summary: React.JSX.Element }): React.JSX.Element { return <><tr className="base-group-row"><th colSpan={columns} scope="rowgroup">{name}</th></tr>{rows}{summary}</> }
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { icons } from 'lucide-react'
import { baseValueText, special, type BaseValue } from '../../core/base-expression'
import type { NoteDocument } from '../../shared/types'
import BaseSettingsPanel from './BaseSettingsPanel'
import { searchBaseRows } from '../../core/base-search'
import { serializeBaseExport } from '../../core/base-export'
import { kanbanMove } from '../../core/base-kanban'
const kanbanCardMime = 'application/x-tsuzune-kanban-card'
