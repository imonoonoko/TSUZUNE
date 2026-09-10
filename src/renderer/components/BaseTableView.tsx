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
    }

type BaseTableViewProps = {
  state: BaseTableState
  onReload: () => void
  onOpenNote: (path: string) => void
}

function cellText(cell: BaseCell): string {
  if (cell.kind === 'missing') return '—'
  if (cell.kind === 'empty') return ''
  if (cell.kind === 'diagnostic') return `未対応: ${cell.message}`
  return String(cell.value)
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
  onOpenNote
}: BaseTableViewProps): React.JSX.Element {
  if (state.status === 'loading') {
    return (
      <section className="base-table-panel" aria-label="Baseテーブル">
        <p role="status" aria-live="polite">Baseを読み込んでいます…</p>
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
  return (
    <section className="base-table-panel" aria-label="Baseテーブル">
      <header className="base-table-header">
        <div>
          <h2>{profile.view.name}</h2>
          <p>{state.path}</p>
        </div>
        <div className="base-table-meta" aria-label="Baseの状態">
          <span>可視スナップショット</span>
          <span>{evaluation.rows.length}行 / 対象 {evaluation.targetCount}件</span>
          <button type="button" onClick={onReload}>再読み込み</button>
        </div>
      </header>
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
            <caption>{profile.view.name}（読み取り専用）</caption>
            <thead>
              <tr>
                {evaluation.columns.map((column) => <th key={column} scope="col">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {evaluation.rows.map((row) => (
                <tr key={row.path}>
                  {evaluation.columns.map((column) => {
                    const cell = row.cells[column] ?? { kind: 'missing' as const }
                    const value = cellText(cell)
                    return (
                      <td key={column}>
                        {column === 'file.name' || column === 'file.path' ? (
                          <button
                            type="button"
                            className="base-table-note-link"
                            aria-label={`${row.path}を開く`}
                            onClick={() => onOpenNote(row.path)}
                          >
                            {value || '—'}
                          </button>
                        ) : value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
