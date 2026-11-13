import { useEffect, useRef, useState } from 'react'
import { mediaMimeType } from '../../shared/attachments'

import './MediaPlayer.css'

interface MediaPlayerProps {
  path: string | null
  label: string
  expectedVaultPath?: string
  onOpenExternally?: () => void
  openDisabled?: boolean
  openLabel?: string
}

export default function MediaPlayer(props: MediaPlayerProps): React.JSX.Element {
  return <ScopedMediaPlayer key={JSON.stringify([props.expectedVaultPath, props.path])} {...props} />
}

function ScopedMediaPlayer({ path, label, expectedVaultPath, onOpenExternally, openDisabled = false, openLabel = '既定のアプリで開く' }: MediaPlayerProps): React.JSX.Element {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const player = useRef<HTMLMediaElement | null>(null)
  useEffect(() => {
    let active = true
    const element = player.current
    if (path) void window.tsuzune.getVaultMediaUrl(path, expectedVaultPath).then(result => {
      if (!active) return
      if (result.ok) setUrl(result.value)
      else setError('ファイルを読み込めません。場所や形式を確認してください。')
    }).catch(() => { if (active) setError('ファイルを読み込めません。') })
    return () => {
      active = false
      if (element) { element.pause(); element.removeAttribute('src'); element.load() }
    }
  }, [path, expectedVaultPath])

  if (!path) return <span className="media-player media-error" role="status">{label}: 添付が見つからないか、内部再生の対象外です。</span>
  const Player = mediaMimeType(path)?.startsWith('video/') ? 'video' : 'audio'
  const openExternally = (): void => {
    if (openDisabled) return
    if (onOpenExternally) { onOpenExternally(); return }
    void window.tsuzune.openVaultFile(path, expectedVaultPath).then(result => {
      if (!result.ok) setError('外部アプリで開けませんでした。')
    }).catch(() => setError('外部アプリで開けませんでした。'))
  }
  return <span className="media-player" role="group" aria-label={`再生: ${label}`}>
    <span className="media-player-label">{label}</span>
    <Player ref={element => { player.current = element }} src={url} controls preload="metadata" aria-label={label}
      hidden={!!error} onError={() => setError('再生できません。ファイルの破損、変更、または未対応の形式・codecが考えられます。')} />
    {error ? <><span role="status">{error}</span><button type="button" disabled={openDisabled} onClick={openExternally}>{openLabel}</button></> : null}
  </span>
}

export function MediaLink({ path, href, children, expectedVaultPath }: { path: string | null; href: string; children: React.ReactNode; expectedVaultPath?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLAnchorElement>(null)
  if (!path) return <span className="inactive-link" title="音声・動画のリンク先を確認してください。">{children}</span>
  return <span className="media-link">
    <a ref={opener} href={href} data-media-link="true" onClick={event => { event.preventDefault(); setOpen(true) }}>{children}</a>
    {open ? <span className="media-link-content"><MediaPlayer path={path} label={path} expectedVaultPath={expectedVaultPath} />
      <button type="button" onClick={() => { setOpen(false); opener.current?.focus() }}>再生表示を閉じる</button></span> : null}
  </span>
}
