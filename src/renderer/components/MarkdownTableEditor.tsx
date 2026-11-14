import './MarkdownTableEditor.css'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MarkdownTable } from '../../core/markdown-table'

export default function MarkdownTableEditor({ table, readOnly, onApply, onClose }: {
  table: MarkdownTable
  readOnly: boolean
  onApply: (table: MarkdownTable) => string | null
  onClose: () => void
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(() => ({ ...table, rows: table.rows.map(row => [...row]), align: [...table.align] }))
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState({ row: 0, column: 0 })
  function rowAction(action: 'add' | 'delete' | 'move', target: number): void {
    if (readOnly) return
    const rows = draft.rows.map(row => [...row])
    if (action === 'add') rows.splice(target, 0, Array(draft.align.length).fill(''))
    else if (action === 'delete') rows.splice(target, 1)
    else [rows[selected.row], rows[target]] = [rows[target], rows[selected.row]]
    setDraft({ ...draft, rows })
    setSelected({ ...selected, row: Math.min(target, rows.length - 1) })
  }
  function columnAction(action: 'add' | 'delete' | 'move', target: number): void {
    if (readOnly) return
    const rows = draft.rows.map(row => [...row])
    const align = [...draft.align]
    if (action === 'add') { rows.forEach(row => row.splice(target, 0, '')); align.splice(target, 0, null) }
    else if (action === 'delete') { rows.forEach(row => row.splice(target, 1)); align.splice(target, 1) }
    else {
      rows.forEach(row => { [row[selected.column], row[target]] = [row[target], row[selected.column]] })
      ;[align[selected.column], align[target]] = [align[target], align[selected.column]]
    }
    setDraft({ ...draft, rows, align })
    setSelected({ ...selected, column: Math.min(target, align.length - 1) })
  }
  useEffect(() => { dialog.current?.showModal() }, [])
  return createPortal(<dialog ref={dialog} className="markdown-table-dialog" aria-label="Markdown表を編集"
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose() }
    }}>
    <header><h2>表を編集</h2><button type="button" onClick={onClose}>キャンセル</button></header>
    <p>セルにMarkdownを入力できます。「表を適用」で本文へ反映します。</p>
    <fieldset className="markdown-table-actions" disabled={readOnly}>
      <legend>{selected.row ? `${selected.row}行` : '見出し'}・{selected.column + 1}列を選択中</legend>
      <button type="button" onClick={() => rowAction('add', Math.max(1, selected.row))}>上に行を追加</button>
      <button type="button" onClick={() => rowAction('add', selected.row + 1)}>下に行を追加</button>
      <button type="button" disabled={!selected.row} onClick={() => rowAction('delete', selected.row)}>行を削除</button>
      <button type="button" disabled={selected.row < 2} onClick={() => rowAction('move', selected.row - 1)}>行を上へ</button>
      <button type="button" disabled={!selected.row || selected.row === draft.rows.length - 1} onClick={() => rowAction('move', selected.row + 1)}>行を下へ</button>
      <button type="button" onClick={() => columnAction('add', selected.column)}>左に列を追加</button>
      <button type="button" onClick={() => columnAction('add', selected.column + 1)}>右に列を追加</button>
      <button type="button" disabled={draft.align.length === 1} onClick={() => columnAction('delete', selected.column)}>列を削除</button>
      <button type="button" disabled={!selected.column} onClick={() => columnAction('move', selected.column - 1)}>列を左へ</button>
      <button type="button" disabled={selected.column === draft.align.length - 1} onClick={() => columnAction('move', selected.column + 1)}>列を右へ</button>
      <label>列の配置<select aria-label="列の配置" value={draft.align[selected.column] ?? ''} onChange={event => setDraft({ ...draft,
        align: draft.align.map((alignment, column) => column === selected.column ? (event.target.value || null) as MarkdownTable['align'][number] : alignment)
      })}><option value="">指定なし</option><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select></label>
    </fieldset>
    <div className="markdown-table-grid"><table><thead><tr><th scope="col">行</th>{draft.align.map((_, column) => <th scope="col" key={column}>{column + 1}列</th>)}</tr></thead><tbody>{draft.rows.map((row, rowIndex) => <tr key={rowIndex}>
      <th scope="row">{rowIndex === 0 ? '見出し' : `${rowIndex}行`}</th>
      {row.map((cell, column) => <td key={column} data-selected={selected.row === rowIndex && selected.column === column}><input aria-label={`${rowIndex === 0 ? '見出し' : `${rowIndex}行`} ${column + 1}列`}
        value={cell} disabled={readOnly} onFocus={() => setSelected({ row: rowIndex, column })} onChange={event => setDraft(current => ({ ...current,
          rows: current.rows.map((values, index) => index === rowIndex ? values.map((value, index) => index === column ? event.target.value : value) : values)
        }))} /></td>)}
    </tr>)}</tbody></table></div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" disabled={readOnly} onClick={() => setError(onApply(draft))}>表を適用</button></footer>
  </dialog>, document.body)
}
