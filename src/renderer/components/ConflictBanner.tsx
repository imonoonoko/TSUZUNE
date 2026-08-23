export type ConflictState =
  | {
      kind: 'changed'
      externalContent: string
      externalModifiedAt: number
      externalSize: number
      localHeld: boolean
    }
  | {
      kind: 'missing'
    }

type ConflictBannerProps = {
  conflict: ConflictState | null
  inert: boolean
  onLoadExternal: () => void
  onKeepLocal: () => void
  onOverwriteExternal: () => void
  onSaveMissingAsNew: () => void
  onDiscardMissing: () => void
}

export default function ConflictBanner({
  conflict,
  inert,
  onLoadExternal,
  onKeepLocal,
  onOverwriteExternal,
  onSaveMissingAsNew,
  onDiscardMissing
}: ConflictBannerProps): React.JSX.Element | null {
  if (!conflict) {
    return null
  }

  if (conflict.kind === 'missing') {
    return (
      <div className="conflict-banner" role="alert" inert={inert}>
        <strong>このノートは外部で削除または移動されました。</strong>
        <div>
          <button type="button" onClick={onSaveMissingAsNew}>
            別名で保存
          </button>
          <button type="button" onClick={onDiscardMissing}>
            破棄して閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="conflict-banner" role="alert" inert={inert}>
      <strong>このノートは別のアプリでも変更されました。</strong>
      {!conflict.localHeld ? (
        <div>
          <button type="button" onClick={onLoadExternal}>
            外部版を読み込む
          </button>
          <button type="button" onClick={onKeepLocal}>
            編集中の内容を保持
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOverwriteExternal}>
          こちらの内容で上書き保存
        </button>
      )}
    </div>
  )
}
