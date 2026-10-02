import { useRef, useState } from 'react'
import { parseBaseProfile, updateBaseProfileSource, type BaseFilter, type BaseProfile, type BaseTableView } from '../../core/base-profile'
import { BASE_STANDARD_SUMMARIES } from '../../core/base-evaluator'
type Props = { content: string; profile: BaseProfile; selectedView: number; onPreview: (content: string, viewIndex: number) => void | Promise<boolean | void>; onSave: (content: string) => void; onClose: () => void; disabled?: boolean }
export default function BaseSettingsPanel({ content, profile, selectedView, onPreview, onSave, onClose, disabled }: Props): React.JSX.Element {
  const [original] = useState(content)
  const [draft, setDraft] = useState(profile)
  const [index, setIndex] = useState(selectedView)
  const [error, setError] = useState('')
  const [previewSource, setPreviewSource] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [advanced, setAdvanced] = useState<string | null>(null)
  const [newColumn, setNewColumn] = useState('')
  const revision = useRef(0)
  const views = draft.views ?? [draft.view]; const view = views[index] ?? views[0]
  const change = (next: BaseProfile): void => { revision.current++; setDraft(next); setPreviewSource(null); setError(''); setAdvanced(null) }
  const updateView = (next: Partial<BaseTableView>): void => { const changed = [...views]; changed[index] = { ...view, ...next }; change({ ...draft, views: changed, view: changed[0] }) }
  const source = (): string => {
    const proposed = advanced ?? updateBaseProfileSource(original, draft)
    const result = parseBaseProfile(proposed)
    if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Invalid Base configuration.')
    return proposed
  }
  const preview = async (): Promise<void> => {
    try {
      const proposed = source(); const requestedRevision = revision.current; setError(''); setPreviewing(true)
      const accepted = await onPreview(proposed, index)
      if (accepted === false) throw new Error('プレビュー評価に失敗しました。設定を修正してください。')
      if (requestedRevision === revision.current) setPreviewSource(proposed)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); setPreviewSource(null) } finally { setPreviewing(false) }
  }
  const propertyConfig = (property: string, next: { displayName?: string; type?: string }): void => change({ ...draft, properties: { ...draft.properties, [property]: { ...draft.properties?.[property], ...next } } })
  const busy = disabled || previewing
  return <section className="base-settings-panel" aria-label="Base設定">
    <h3>Base設定</h3>
    <label>ビュー<select value={index} onChange={(event) => { revision.current++; setIndex(Number(event.target.value)); setPreviewSource(null) }}>{views.map((item, at) => <option key={at} value={at}>{item.name}</option>)}</select></label>
    <button type="button" onClick={() => { const next = [...views, { type: 'table' as const, name: `Table ${views.length + 1}`, filters: [], order: ['file.name'] }]; change({ ...draft, views: next, view: next[0] }); setIndex(next.length - 1) }}>ビュー追加</button>
    <button type="button" disabled={views.length === 1} onClick={() => { const next = views.filter((_, at) => at !== index); change({ ...draft, views: next, view: next[0] }); setIndex(Math.max(0, index - 1)) }}>ビュー削除</button>
    <label>ビュー名<input value={view.name} onChange={(event) => updateView({ name: event.target.value })} /></label>
    <fieldset><legend>列 / 表示名 / 型</legend>{view.order.map((property, at) => <div key={`${at}:${property}`}>
      <span>{property}</span>
      <input aria-label={`${property}の表示名`} value={draft.properties?.[property]?.displayName ?? ''} onChange={(event) => propertyConfig(property, { displayName: event.target.value || undefined })} />
      {!property.startsWith('file.') && !property.startsWith('formula.') && <select aria-label={`${property}の型`} value={draft.properties?.[property]?.type ?? ''} onChange={(event) => propertyConfig(property, { type: event.target.value || undefined })}><option value="">自動（scalar / list）</option><option value="date">日付</option><option value="datetime">日時</option></select>}
      <button type="button" disabled={at === 0} aria-label={`${property}を上へ`} onClick={() => { const next = [...view.order]; [next[at - 1], next[at]] = [next[at], next[at - 1]]; updateView({ order: next }) }}>↑</button>
      <button type="button" disabled={at === view.order.length - 1} aria-label={`${property}を下へ`} onClick={() => { const next = [...view.order]; [next[at + 1], next[at]] = [next[at], next[at + 1]]; updateView({ order: next }) }}>↓</button>
      <button type="button" disabled={view.order.length === 1} aria-label={`${property}の列を削除`} onClick={() => updateView({ order: view.order.filter((_, position) => position !== at) })}>削除</button>
    </div>)}<label>追加Property<input value={newColumn} placeholder="note.status / file.tags / formula.total" onChange={(event) => setNewColumn(event.target.value)} /></label><button type="button" disabled={!newColumn.trim() || view.order.includes(newColumn.trim())} onClick={() => { updateView({ order: [...view.order, newColumn.trim()] }); setNewColumn('') }}>列追加</button></fieldset>
    <fieldset><legend>全体条件</legend><FilterList items={draft.filters} onChange={(filters) => change({ ...draft, filters })} /></fieldset>
    <fieldset><legend>ビュー条件</legend><FilterList items={view.filters} onChange={(filters) => updateView({ filters })} /></fieldset>
    <NamedExpressions title="数式（読み取り専用列）" values={draft.formulas ?? {}} onChange={(formulas) => change({ ...draft, formulas })} />
    <fieldset><legend>ソート（上から優先）</legend>{(view.sorts ?? (view.sort ? [view.sort] : [])).map((item, at, all) => <div key={at}>
      <input aria-label={`ソート${at + 1}のProperty`} value={item.property} onChange={(event) => { const next = all.map((value, position) => position === at ? { ...value, property: event.target.value } : value); updateView({ sorts: next, sort: next[0] }) }} />
      <select aria-label={`ソート${at + 1}の方向`} value={item.direction} onChange={(event) => { const next = all.map((value, position) => position === at ? { ...value, direction: event.target.value as 'ASC' | 'DESC' } : value); updateView({ sorts: next, sort: next[0] }) }}><option>ASC</option><option>DESC</option></select>
      <button type="button" onClick={() => { const next = all.filter((_, position) => at !== position); updateView({ sorts: next, sort: next[0] }) }}>削除</button>
    </div>)}<button type="button" onClick={() => updateView({ sorts: [...(view.sorts ?? (view.sort ? [view.sort] : [])), { property: 'file.name', direction: 'ASC' }] })}>ソート追加</button></fieldset>
    <label>グループProperty<input value={view.groupBy?.property ?? ''} onChange={(event) => updateView({ groupBy: event.target.value ? { property: event.target.value, direction: view.groupBy?.direction ?? 'ASC' } : undefined })} /></label>
    <label>グループ順<select value={view.groupBy?.direction ?? 'ASC'} onChange={(event) => view.groupBy && updateView({ groupBy: { ...view.groupBy, direction: event.target.value as 'ASC' | 'DESC' } })}><option>ASC</option><option>DESC</option></select></label>
    <label>最大行数<input type="number" min="0" value={view.limit ?? ''} onChange={(event) => updateView({ limit: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <fieldset><legend>列の集計（全体と各グループ）</legend>{view.order.map((property) => <label key={property}>{property}<select aria-label={`${property}の集計`} value={view.summaries?.[property] ?? ''} onChange={(event) => { const summaries = { ...view.summaries }; if (event.target.value) summaries[property] = event.target.value; else delete summaries[property]; updateView({ summaries }) }}><option value="">なし</option>{[...BASE_STANDARD_SUMMARIES, ...Object.keys(draft.summaries ?? {})].map((name) => <option key={name}>{name}</option>)}</select></label>)}</fieldset>
    <NamedExpressions title="独自集計（values を使う式）" values={draft.summaries ?? {}} onChange={(summaries) => change({ ...draft, summaries })} />
    <details><summary>詳細YAML / 保存差分</summary><label>変更前<textarea readOnly value={original} /></label><label>変更後<textarea value={advanced ?? (() => { try { return updateBaseProfileSource(original, draft) } catch { return '' } })()} onChange={(event) => { revision.current++; setAdvanced(event.target.value); setPreviewSource(null) }} /></label></details>
    {error && <p role="alert">{error}</p>}
    <p role="status">{previewSource ? '下書きの評価結果と保存差分を確認できます。保存すると元のBaseを更新します。' : '下書きをプレビューして、表の結果と保存差分を確認してください。'}</p>
    <button type="button" disabled={busy} onClick={() => void preview()}>下書きをプレビュー</button>
    <button type="button" disabled={busy || !previewSource} onClick={() => previewSource && onSave(previewSource)}>確認した変更を保存</button>
    <button type="button" onClick={onClose}>閉じる</button>
  </section>
}
function FilterList({ items, onChange }: { items: BaseFilter[]; onChange: (items: BaseFilter[]) => void }): React.JSX.Element {
  return <div className="base-filter-list">{items.map((item, index) => <div key={index}><FilterEditor item={item} onChange={(next) => onChange(items.map((value, at) => at === index ? next : value))} /><button type="button" onClick={() => onChange(items.filter((_, at) => at !== index))}>条件削除</button></div>)}<button type="button" onClick={() => onChange([...items, { kind: 'expression', expression: 'file.ext == "md"' }])}>条件追加</button><button type="button" onClick={() => onChange([...items, { kind: 'and', children: [] }])}>条件グループ追加</button></div>
}
function FilterEditor({ item, onChange }: { item: BaseFilter; onChange: (item: BaseFilter) => void }): React.JSX.Element {
  if (item.kind === 'and' || item.kind === 'or' || item.kind === 'not') return <fieldset><legend>条件グループ</legend><select aria-label="条件グループの演算" value={item.kind} onChange={(event) => onChange({ ...item, kind: event.target.value as 'and' | 'or' | 'not' })}><option value="and">AND（すべて）</option><option value="or">OR（いずれか）</option><option value="not">NOT（いずれも除外）</option></select><FilterList items={item.children} onChange={(children) => onChange({ ...item, children })} /></fieldset>
  const initial = item.kind === 'expression' ? item.expression : item.kind === 'inFolder' ? `file.inFolder(${JSON.stringify(item.folder)})` : item.kind === 'comparison' ? `${item.property} ${item.operator} ${JSON.stringify(item.value)}` : item.kind === 'contains' ? `${item.property}.contains(${JSON.stringify(item.value)})` : ''
  const comparison = /^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*)$/.exec(initial)
  const property = comparison?.[1] ?? ''; const operator = comparison?.[2] ?? '=='; const value = comparison?.[3] ?? '""'
  const update = (nextProperty: string, nextOperator: string, nextValue: string): void => onChange({ kind: 'expression', expression: `${nextProperty} ${nextOperator} ${nextValue}` })
  return <div><label>Property<input aria-label="条件Property" value={property} placeholder="note.status" onChange={(event) => update(event.target.value, operator, value)} /></label><label>演算<select aria-label="条件の比較演算" value={operator} onChange={(event) => update(property, event.target.value, value)}>{['==', '!=', '>', '<', '>=', '<='].map((op) => <option key={op}>{op}</option>)}</select></label><label>比較値<input aria-label="条件の比較値" value={value} onChange={(event) => update(property, operator, event.target.value)} /></label><label>条件式（関数・詳細）<input aria-label="条件式" value={initial} onChange={(event) => onChange({ kind: 'expression', expression: event.target.value })} /></label></div>
}
function NamedExpressions({ title, values, onChange }: { title: string; values: Record<string, string>; onChange: (values: Record<string, string>) => void }): React.JSX.Element {
  const [name, setName] = useState(''); const [expression, setExpression] = useState('')
  return <fieldset><legend>{title}</legend>{Object.entries(values).map(([key, source]) => <div key={key}><span>{key}</span><input aria-label={`${key}の式`} value={source} onChange={(event) => onChange({ ...values, [key]: event.target.value })} /><button type="button" aria-label={`${key}を削除`} onClick={() => { const next = { ...values }; delete next[key]; onChange(next) }}>削除</button></div>)}<label>名前<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>式<input value={expression} onChange={(event) => setExpression(event.target.value)} /></label><button type="button" disabled={!name.trim() || !expression.trim() || Object.hasOwn(values, name.trim())} onClick={() => { onChange({ ...values, [name.trim()]: expression }); setName(''); setExpression('') }}>式追加</button></fieldset>
}
