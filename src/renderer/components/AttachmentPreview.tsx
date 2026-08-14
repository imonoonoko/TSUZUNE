import { useEffect, useState } from 'react'
import { basenameRelative } from '../../core/paths'
import type { VaultAttachment } from '../../shared/types'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.svg',
  '.webp',
  '.avif'
])

function isImage(path: string): boolean {
  const name = basenameRelative(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot).toLocaleLowerCase())
}

export default function AttachmentPreview({
  attachment,
  onOpenExternally
}: {
  attachment: VaultAttachment
  onOpenExternally: () => void
}): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    setFailed(false)

    if (!isImage(attachment.path)) {
      return () => {
        active = false
      }
    }

    void window.tsuzune.readVaultImage(attachment.path).then((result) => {
      if (!active) {
        return
      }
      if (result.ok) {
        setDataUrl(result.value)
      } else {
        setFailed(true)
      }
    })

    return () => {
      active = false
    }
  }, [attachment.path])

  return (
    <section className="attachment-preview" aria-label="添付ファイルプレビュー">
      {dataUrl ? (
        <img src={dataUrl} alt={attachment.name} />
      ) : (
        <div className="attachment-preview-placeholder">
          <strong>{attachment.name}</strong>
          <span>{failed ? 'プレビューを読み込めませんでした。' : 'この形式は外部アプリで開けます。'}</span>
        </div>
      )}
      <button type="button" onClick={onOpenExternally}>
        既定のアプリで開く
      </button>
    </section>
  )
}
