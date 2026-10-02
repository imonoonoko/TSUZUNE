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
  evaluating,
  onStopEvaluation
}: BaseTableViewProps): React.JSX.Element {
  const [settings, setSettings] = useState(false)
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
  const renderRows = (rows: BaseEvaluation['rows']): React.JSX.Element[] => rows.map((row) => (
    <tr key={row.path}>{evaluation.columns.map((column) => {
      const cell = row.cells[column] ?? { kind: 'missing' as const }; const value = cellText(cell)
      return <td key={column}>{column === 'file.name' || column === 'file.path' ? <button type="button" className="base-table-note-link" aria-label={`${row.path}を開く`} onClick={() => onOpenNote(row.path)}>{value || '—'}</button> : cell.kind === 'value' ? <BaseValueDisplay value={cell.value} open={onOpenNote} image={onResolveImage} /> : value}
        {!column.startsWith('file.') && !column.startsWith('formula.') && onEditCell && <button type="button" className="base-cell-edit" disabled={editingDisabled} aria-label={`${row.path}の${column}を編集`} onClick={() => cell.kind === 'diagnostic' ? onOpenNote(row.path) : onEditCell(row.path, column.replace(/^note\./, ''))}>{cell.kind === 'diagnostic' ? 'ソースで編集' : '編集'}</button>}
      </td>
    })}</tr>
  ))
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
          <span>{evaluation.rows.length}行 / 対象 {evaluation.targetCount}件</span>
          <button type="button" onClick={onReload}>再読み込み</button>
          {(profile.views?.length ?? 1) > 1 && <label>ビュー<select value={selectedView} onChange={(event) => onSelectView?.(Number(event.target.value))}>{profile.views!.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>}
          {onSaveProfile && state.content && <button type="button" onClick={() => setSettings(!settings)}>設定</button>}
          {evaluating && <><span role="status">評価中…</span><button type="button" onClick={onStopEvaluation}>評価を停止</button></>}
        </div>
      </header>
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
      {evaluation.rows.length === 0 ? (
        <p className="base-table-empty" role="status">条件に一致するノートはありません。</p>
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
              {evaluation.groups ? evaluation.groups.map((group, index) => <GroupRows key={index} name={baseValueText(group.key) || '（空）'} columns={evaluation.columns.length} rows={renderRows(group.rows)} summary={renderSummary(group.summaries)} />) : renderRows(evaluation.rows)}
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
