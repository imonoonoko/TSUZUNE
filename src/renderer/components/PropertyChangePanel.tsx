import { useMemo, useState } from 'react'
import type {
  PropertyApplyResult,
  PropertyChangeOperation,
  PropertyChangeScope,
  PropertyDeclaredType,
  PropertyPreviewResult,
  PropertyValue
} from '../../shared/property-changes'
import PropertyValueFields from './PropertyValueFields'

type PreviewWithReferences = PropertyPreviewResult & { baseReferences?: string[] }

interface PropertyChangePanelProps {
  scope: PropertyChangeScope
  paths: string[]
  property: string
  declaredType?: PropertyDeclaredType
  initialValue?: PropertyValue
  single?: boolean
  onPreview: (operation: PropertyChangeOperation, paths: string[]) => Promise<PreviewWithReferences>
  onApply: (operation: PropertyChangeOperation, targets: { path: string; expectedRevision: string }[]) => Promise<PropertyApplyResult>
  onClose?: () => void
}

const types: PropertyDeclaredType[] = ['text', 'number', 'checkbox', 'list', 'date', 'datetime']
const typeLabels: Record<PropertyDeclaredType, string> = { text: 'テキスト', number: '数値', checkbox: 'チェックボックス', list: 'リスト', date: '日付', datetime: '日時' }

function formatValue(value: PropertyValue | null): string {
  if (value === null) return '（なし）'
  if (value.type === 'checkbox') return value.value ? 'true' : 'false'
  if (value.type === 'list') return value.value.map((item) => item.value).join('、')
  return value.value
}

function PropertyChangePanelContent({ paths, property, declaredType, initialValue, single = false, onPreview, onApply, onClose }: PropertyChangePanelProps) {
  const uniquePaths = useMemo(() => [...new Set(paths)], [paths])
  const [selected, setSelected] = useState<string[]>(() => single ? uniquePaths.slice(0, 1) : [])
  const [kind, setKind] = useState<'set' | 'convert' | 'rename'>(single ? 'set' : 'convert')
  const initialType = declaredType ?? initialValue?.type ?? 'text'
  const fixedValueType = !!declaredType || !!initialValue
  const [targetType, setTargetType] = useState<PropertyDeclaredType>(initialType)
  const [newName, setNewName] = useState('')
  const initialDraft = initialValue?.type === 'text' && (declaredType === 'date' || declaredType === 'datetime')
    ? { type: declaredType, value: initialValue.value } as PropertyValue
    : initialValue ?? { type: initialType === 'checkbox' ? 'checkbox' : initialType === 'list' ? 'list' : initialType, value: initialType === 'checkbox' ? false : initialType === 'list' ? [] : '' } as PropertyValue
  const [setValue, setSetValue] = useState<PropertyValue>(initialDraft)
  const [preview, setPreview] = useState<PreviewWithReferences | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<PropertyApplyResult | null>(null)

  const operation: PropertyChangeOperation | null = kind === 'convert' && !single
    ? { kind, property, targetType }
    : kind === 'rename' && !single
      ? { kind, property, newName }
      : single
        ? { kind: 'set', property, value: setValue }
        : null

  const invalidate = () => { setPreview(null); setOutcome(null); setError('') }
  const togglePath = (path: string) => {
    setSelected((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path])
    invalidate()
  }
  const selectedItems = preview?.items.filter((item) => selected.includes(item.path)) ?? []
  const canApply = !!operation && !!preview && !outcome && selected.length > 0 && selectedItems.length === selected.length && selectedItems.every((item) => !item.issue && item.expectedRevision !== null) && !busy

  const runPreview = async () => {
    if (!operation || selected.length === 0) return
    setBusy(true); setError(''); setOutcome(null)
    try { setPreview(await onPreview(operation, [...selected])) }
    catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : 'プレビューに失敗しました') }
    finally { setBusy(false) }
  }

  const runApply = async () => {
    if (!operation || !preview || !canApply) return
    setBusy(true); setError('')
    try {
      setOutcome(await onApply(operation, selectedItems.map(({ path, expectedRevision }) => ({ path, expectedRevision: expectedRevision! }))))
    } catch (reason) { setError(reason instanceof Error ? reason.message : '変更を適用できませんでした') }
    finally { setBusy(false) }
  }

  const retry = () => {
    if (!outcome) return
    const retryable = [...outcome.notAttempted, ...outcome.failed.map(({ path }) => path)]
    if (retryable.length === 0) return
    setSelected(retryable)
    setPreview(null)
    setOutcome(null)
    setError('対象を再選択しました。最新状態をプレビューしてください。')
  }

  return <section aria-labelledby="property-change-title">
    <h2 id="property-change-title">Propertyを変更</h2>
    <p>{property} · {uniquePaths.length}件</p>
    <fieldset disabled={busy}>
      <legend>変更内容</legend>
      {!single && <label><input type="radio" name="property-operation" checked={kind === 'convert'} onChange={() => { setKind('convert'); invalidate() }} />型を変換</label>}
      {!single && <label><input type="radio" name="property-operation" checked={kind === 'rename'} onChange={() => { setKind('rename'); invalidate() }} />名前を変更</label>}
      {single && <label><input type="radio" name="property-operation" checked={kind === 'set'} onChange={() => { setKind('set'); invalidate() }} />値を設定</label>}
      {kind === 'convert' && <label>変換先の型<select aria-label="変換先の型" value={targetType} onChange={(event) => { setTargetType(event.target.value as PropertyDeclaredType); invalidate() }}>
        {types.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
      </select></label>}
      {kind === 'rename' && <label>新しい名前<input aria-label="新しい名前" value={newName} onChange={(event) => { setNewName(event.target.value); invalidate() }} /></label>}
      {single && !fixedValueType && <label>値の型<select aria-label="値の型" value={targetType} onChange={(event) => {
        const nextType = event.target.value as PropertyDeclaredType
        setTargetType(nextType)
        setSetValue(nextType === 'checkbox' ? { type: 'checkbox', value: false } : nextType === 'list' ? { type: 'list', value: [] } : { type: nextType, value: '' })
        invalidate()
      }}>{types.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>}
      {single && <PropertyValueFields label="設定値" value={setValue} disabled={busy} onChange={(next) => { setSetValue(next); invalidate() }} />}
    </fieldset>
    <fieldset disabled={busy}>
      <legend>対象ノート</legend>
      {uniquePaths.map((path) => <label key={path}><input type="checkbox" aria-label={`${path}を対象にする`} checked={selected.includes(path)} onChange={() => togglePath(path)} />{path}</label>)}
    </fieldset>
    <button type="button" disabled={busy || selected.length === 0 || !operation} onClick={() => void runPreview()}>変更をプレビュー</button>
    {preview && <section aria-label="変更プレビュー">
      <h3>変更プレビュー</h3>
      {preview.items.filter((item) => selected.includes(item.path)).map((item) => <article key={item.path}>
        <h4>{item.path}</h4><p>変更前: {formatValue(item.before)}</p><p>変更後: {formatValue(item.after)}</p>
        {item.issue && <p role="alert">{item.issue.message}</p>}
      </article>)}
      {kind === 'rename' && preview.baseReferences && <p>Basesの列・filter・sort参照: {preview.baseReferences.join('、') || 'なし'}（参照元のBases設定はこの操作では変更されません）</p>}
      <button type="button" disabled={!canApply} onClick={() => void runApply()}>変更を保存</button>
    </section>}
    {error && <p role="alert">{error}</p>}
    {outcome && <section aria-label="変更結果" role="status">
      <h3>変更結果</h3>
      <p>保存: {outcome.saved.join('、') || 'なし'}</p><p>変更なし: {outcome.unchanged.join('、') || 'なし'}</p>
      <p>失敗: {outcome.failed.map(({ path, message }) => `${path}: ${message}`).join('、') || 'なし'}</p>
      <p>未実行: {outcome.notAttempted.join('、') || 'なし'}</p>
      {outcome.registryError && <p>Properties設定の更新エラー: {outcome.registryError}</p>}
      {(outcome.failed.length > 0 || outcome.notAttempted.length > 0) && <button type="button" onClick={retry}>失敗・未実行を再試行</button>}
    </section>}
    {onClose && <button type="button" disabled={busy} onClick={onClose}>閉じる</button>}
  </section>
}

export default function PropertyChangePanel(props: PropertyChangePanelProps) {
  const key = `${props.scope.rootPath}\0${props.scope.rootRevision}\0${props.paths.join('\0')}\0${props.property}`
  return <PropertyChangePanelContent key={key} {...props} />
}
