import { useEffect, useRef, useState } from 'react'
import type { ImportApplyResult, ImportDraft, ImportFormat, ImportPreview, ImportReadRequest, ImportSource } from '../../shared/importer'
import type { PropertyChangeScope } from '../../shared/property-changes'
import type { Result } from '../../shared/types'
import { cycleDialogTab } from '../importer-dialog-focus'
import { buildImportDraft } from '../importer-convert'

type ImportApi = {
  readImportSource(request: ImportReadRequest, files: File[]): Promise<Result<ImportSource>>
  previewImport(input: { scope: PropertyChangeScope; sourceToken: string; destinationName: string; files: ImportDraft['files']; warnings: string[] }): Promise<Result<ImportPreview>>
  applyImport(input: { scope: PropertyChangeScope; planId: string }): Promise<Result<ImportApplyResult>>
  discardImport(token: string): Promise<Result<null>>
}
interface Props {
  scope: PropertyChangeScope
  api: ImportApi
  onApplied(result: ImportApplyResult): void
  onClose(): void
  onBusyChange?(busy: boolean): void
}
const labels: Record<ImportFormat, string> = { markdown: 'Markdownフォルダー', chatgpt: 'ChatGPT Export', notion: 'Notion Export', enex: 'Evernote ENEX' }
const descriptions: Record<ImportFormat, string> = {
  markdown: 'Markdownと添付を、フォルダー内の配置を保ってコピーします。隠しファイルや元アプリの設定は除きます。',
  chatgpt: 'conversations.json、番号付きJSON、またはエクスポートZIPを選びます。会話をMarkdownにし、原文JSONも残します。',
  notion: 'Notionの「Markdown & CSV」エクスポートを選びます。ページと添付を保ち、CSVにMarkdownの表を併設します。',
  enex: 'ENEXファイルを選びます。本文と添付を変換し、原文ENEXも残します。表しきれない内容は警告で確認できます。'
}
function defaultFolder(): string {
  const date = new Date()
  return `取り込み-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
}

export default function ImportDialog({ scope, api, onApplied, onClose, onBusyChange }: Props) {
  const [format, setFormat] = useState<ImportFormat>('markdown')
  const [notionKind, setNotionKind] = useState<'folder' | 'file'>('file')
  const kind = format === 'markdown' ? 'folder' : format === 'notion' ? notionKind : 'file'
  const [files, setFiles] = useState<File[]>([])
  const [destinationName, setDestinationName] = useState(defaultFolder)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [previewPath, setPreviewPath] = useState('')
  const [phase, setPhase] = useState<'idle' | 'reading' | 'applying'>('idle')
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<ImportApplyResult | null>(null)
  const sourceRef = useRef<ImportSource | null>(null)
  const draftRef = useRef<ImportDraft | null>(null)
  const activeRef = useRef(true)
  const busyRef = useRef(false)
  const dialogRef = useRef<HTMLElement>(null)
  const firstRef = useRef<HTMLSelectElement>(null)
  const busyCallbackRef = useRef(onBusyChange)
  busyCallbackRef.current = onBusyChange
  const busy = phase !== 'idle'

  const discard = () => {
    const source = sourceRef.current
    sourceRef.current = null
    draftRef.current = null
    if (source) void api.discardImport(source.token).catch(() => undefined)
  }
  useEffect(() => {
    activeRef.current = true
    firstRef.current?.focus()
    return () => {
      activeRef.current = false
      const source = sourceRef.current
      sourceRef.current = null
      if (source) void api.discardImport(source.token).catch(() => undefined)
      if (busyRef.current) busyCallbackRef.current?.(false)
    }
  }, [api])

  const reset = () => {
    discard()
    setDraft(null); setPreview(null); setError(''); setOutcome(null); setFiles([])
  }
  const close = () => {
    if (busyRef.current) return
    discard()
    onClose()
  }
  const start = (next: 'reading' | 'applying') => {
    busyRef.current = true; setPhase(next); setError(''); busyCallbackRef.current?.(true)
  }
  const finish = () => {
    busyRef.current = false
    if (activeRef.current) { setPhase('idle'); busyCallbackRef.current?.(false) }
  }
  const loadPreview = async () => {
    if (busyRef.current || !files.length || outcome) return
    start('reading'); setPreview(null)
    try {
      let source = sourceRef.current, converted = draftRef.current
      if (!source || !converted) {
        const request: ImportReadRequest = { scope, format, kind }
        const read = await api.readImportSource(request, files)
        if (!read.ok) throw new Error(read.error.message)
        if (!activeRef.current) { void api.discardImport(read.value.token).catch(() => undefined); return }
        source = read.value
        sourceRef.current = source
        converted = buildImportDraft(format, source.files)
        draftRef.current = converted
        setDraft(converted)
        setPreviewPath(converted.files.find(file => /\.md$/i.test(file.path))?.path ?? '')
      }
      if (!source || !converted) throw new Error('取り込み元の読み込みに失敗しました。')
      const result = await api.previewImport({ scope, sourceToken: source.token, destinationName,
        files: converted.files, warnings: converted.warnings })
      if (!activeRef.current) return
      if (!result.ok) throw new Error(result.error.message)
      setPreview(result.value)
    } catch (reason) {
      if (activeRef.current) { discard(); setError(reason instanceof Error ? reason.message : 'プレビューを作成できませんでした。') }
    } finally { finish() }
  }
  const apply = async () => {
    if (busyRef.current || !preview || outcome || preview.duplicateFolder || preview.conflicts.length) return
    start('applying')
    try {
      const result = await api.applyImport({ scope, planId: preview.planId })
      if (!activeRef.current) return
      if (!result.ok) throw new Error(result.error.message)
      setOutcome(result.value)
      discard()
      onApplied(result.value)
    } catch (reason) {
      if (activeRef.current) { setPreview(null); discard(); setError(reason instanceof Error ? reason.message : '取り込めませんでした。') }
    } finally { finish() }
  }
  const previewFile = draft?.files.find(file => file.path === previewPath)
  const previewText = previewFile ? new TextDecoder().decode(previewFile.bytes.subarray(0, 160000)).slice(0, 40000) : ''

  return <div className="modal-backdrop">
    <section ref={dialogRef} className="modal import-dialog" role="dialog" aria-modal="true" aria-label="他アプリから取り込む"
      aria-describedby="import-description" aria-busy={busy} onKeyDown={event => {
        if (event.key === 'Tab') {
          const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, [tabindex="0"]') ?? [])
            .filter(element => !element.matches(':disabled') && !element.closest('[hidden]') &&
              (element.tagName === 'SUMMARY' || !element.closest('details:not([open])')))
          cycleDialogTab(event, elements)
        }
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); close() }
      }}>
      <h2>他アプリから取り込む</h2>
      <p id="import-description">原本は変更しません。内容を確認してから、現在のVaultの新しいフォルダーへコピーします。</p>
      <label>取り込み元の形式
        <select ref={firstRef} aria-label="取り込み元の形式" value={format} disabled={busy || !!outcome} onChange={event => { reset(); setFormat(event.target.value as ImportFormat) }}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="import-help">{descriptions[format]}</p>
      {format === 'notion' && <label>選択する形式
        <select aria-label="選択する形式" value={notionKind} disabled={busy || !!outcome} onChange={event => { reset(); setNotionKind(event.target.value as 'folder' | 'file') }}>
          <option value="file">ZIPファイル</option><option value="folder">展開済みフォルダー</option>
        </select>
      </label>}
      <label>{kind === 'folder' ? '取り込みフォルダー' : '取り込みファイル'}
        <input key={`${format}:${kind}`} type="file" aria-label={kind === 'folder' ? '取り込みフォルダー' : '取り込みファイル'}
          {...(kind === 'folder' ? { webkitdirectory: '', directory: '' } : {})}
          multiple={kind === 'folder' || format === 'chatgpt' || format === 'enex'}
          accept={kind === 'folder' ? undefined : format === 'enex' ? '.enex' : format === 'notion' ? '.zip' : '.json,.zip'}
          disabled={busy || !!outcome} onChange={event => { reset(); setFiles(Array.from(event.target.files ?? [])) }} />
      </label>
      <small className="import-help">最大5,000ファイル・1ファイル128MiB・合計256MiB。ZIPは展開後も同じ上限です。</small>
      <label>取り込み先フォルダー名
        <input aria-label="取り込み先フォルダー名" value={destinationName} disabled={busy || !!outcome} maxLength={80}
          onChange={event => { setDestinationName(event.target.value); setPreview(null); setError('') }} />
      </label>
      {error && <p role="alert" className="error-message">{error}</p>}
      {busy && <p role="status">{phase === 'applying' ? '取り込み中です。完了までお待ちください。' : '原本を読み取り、内容を確認しています…'}</p>}
      {preview && !outcome && <section className="import-preview" aria-label="取り込みプレビュー">
        <h3>取り込みプレビュー</h3>
        <p>保存先: {preview.folder} / ノート {preview.noteCount}件 / 全{preview.fileCount}ファイル / {(preview.totalBytes / 1024).toFixed(1)}KiB</p>
        {preview.duplicateFolder && <p role="alert">同じ原本は「{preview.duplicateFolder}」へ取り込み済みです。</p>}
        {preview.conflicts.length > 0 && <p role="alert">同名の保存先があります。別のフォルダー名で確認してください: {preview.conflicts.join('、')}</p>}
        {preview.warnings.length > 0 && <details open className="import-warnings"><summary>確認事項（{preview.warnings.length}件）</summary>
          <ul>{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </details>}
        <details><summary>作成するファイル（{preview.paths.length}件）</summary><textarea aria-label="作成するファイル" readOnly rows={5} value={preview.paths.join('\n')} /></details>
        <label>本文を確認
          <select aria-label="本文を確認" value={previewPath} disabled={busy} onChange={event => setPreviewPath(event.target.value)}>
            {draft?.files.filter(file => /\.md$/i.test(file.path)).map(file => <option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
        </label>
        <pre aria-label="取り込み本文">{previewText}</pre>
        {previewText.length === 40000 && <p className="import-help">先頭40,000文字を表示しています。保存する本文は省略しません。</p>}
      </section>}
      {outcome && <p role="status">「{outcome.folder}」へノート{outcome.noteCount}件・全{outcome.fileCount}ファイルを取り込みました。左のファイル一覧から開けます。</p>}
      <div className="modal-actions">
        {!outcome && <button type="button" disabled={busy || !files.length || !destinationName.trim()} onClick={() => void loadPreview()}>プレビューを確認</button>}
        {preview && !outcome && <button type="button" className="primary-button" disabled={busy || !!preview.duplicateFolder || !!preview.conflicts.length} onClick={() => void apply()}>取り込む</button>}
        <button type="button" disabled={busy} onClick={close}>閉じる</button>
      </div>
    </section>
  </div>
}
