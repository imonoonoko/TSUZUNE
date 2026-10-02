import { useEffect, useState } from 'react'
import type { DriveAutoSyncStatus } from '../../shared/drive-auto-sync'

export default function DriveAutoSyncSettings({ rootPath, disabled, beforeEnable }: {
  rootPath: string | null
  disabled: boolean
  beforeEnable(): Promise<boolean>
}): React.JSX.Element {
  const [status, setStatus] = useState<DriveAutoSyncStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setStatus(null)
    const accept = (next: DriveAutoSyncStatus): void => {
      if (active && next.rootPath === rootPath) setStatus(next)
    }
    if (!window.tsuzune.getDriveAutoSyncStatus) return
    const unsubscribe = window.tsuzune.onDriveAutoSyncStatus(accept)
    void window.tsuzune.getDriveAutoSyncStatus().then((result) => {
      if (result.ok) accept(result.value)
      else if (active) setError(result.error.message)
    }).catch((cause: unknown) => { if (active) setError(String(cause)) })
    return () => { active = false; unsubscribe() }
  }, [rootPath])

  const toggle = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (enabled && !await beforeEnable()) {
        setError('編集中のノートを保存してから、自動同期を有効にしてください。')
        return
      }
      const result = await window.tsuzune.setDriveAutoSyncEnabled(enabled)
      if (!result.ok) setError(result.error.message)
      else if (result.value.rootPath === rootPath) setStatus(result.value)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  return <div className="google-sync-step">
    <label className="drive-auto-sync-toggle">
      <input type="checkbox" checked={status?.enabled ?? false}
        disabled={disabled || busy || !rootPath || !status}
        onChange={(event) => void toggle(event.target.checked)} />
      このVaultを自動同期する
    </label>
    <p>TSUZUNEの起動中は、保存から約5秒後に同期し、Drive側の変更を1分ごとに確認します。ウィンドウを閉じて通知領域に置いても続きます。</p>
    <p>初回は手動で同期してください。競合がある間は自動同期を止め、削除は伝播しません。</p>
    <p role="status">{status?.message ?? '自動同期の状態を確認しています…'}</p>
    {status?.lastCheckedAt && <p>最終確認: {new Date(status.lastCheckedAt).toLocaleString('ja-JP')}</p>}
    {status?.conflictPaths.length ? <ul>{status.conflictPaths.map((path) => <li key={path}>{path}</li>)}</ul> : null}
    {error && <p role="alert">{error}</p>}
  </div>
}
