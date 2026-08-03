import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { transformWikiLinksForPreview } from '../../core/links'
import {
  basenameRelative,
  dirnameRelative,
  joinRelative
} from '../../core/paths'
import type { VaultAttachment } from '../../shared/types'

interface MarkdownPreviewProps {
  content: string
  notePath: string
  attachments: readonly VaultAttachment[]
  onWikiLink: (target: string) => void
}

function vaultAssetTarget(src: string): string | null {
  const prefix = '#/vault-asset/'
  if (!src.startsWith(prefix)) {
    return null
  }

  try {
    return decodeURIComponent(src.slice(prefix.length))
  } catch {
    return null
  }
}

function resolveAttachmentPath(
  target: string,
  notePath: string,
  attachments: readonly VaultAttachment[]
): string | null {
  const normalizedTarget = target.replaceAll('\\', '/').replace(/^\/+/, '')
  const candidates = [
    normalizedTarget,
    joinRelative(dirnameRelative(notePath), normalizedTarget)
  ]

  for (const candidate of candidates) {
    const exact = attachments.find(
      (attachment) =>
        attachment.path.toLocaleLowerCase() === candidate.toLocaleLowerCase()
    )
    if (exact) {
      return exact.path
    }
  }

  const targetName = basenameRelative(normalizedTarget).toLocaleLowerCase()
  const basenameMatches = attachments.filter(
    (attachment) =>
      basenameRelative(attachment.path).toLocaleLowerCase() === targetName
  )
  return basenameMatches.length === 1 ? basenameMatches[0].path : null
}

function VaultImage({
  src,
  alt,
  title,
  notePath,
  attachments
}: {
  src: string
  alt: string
  title?: string
  notePath: string
  attachments: readonly VaultAttachment[]
}): React.JSX.Element {
  const target = vaultAssetTarget(src)
  const accessibleAlt =
    target && alt === target ? basenameRelative(alt) : alt
  const attachmentPath = useMemo(
    () =>
      target
        ? resolveAttachmentPath(target, notePath, attachments)
        : null,
    [attachments, notePath, target]
  )
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    setFailed(false)

    if (!attachmentPath) {
      setFailed(true)
      return () => {
        active = false
      }
    }

    void window.tsuzune.readVaultImage(attachmentPath).then((result) => {
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
  }, [attachmentPath])

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={accessibleAlt}
        title={title}
        data-vault-image-ready="true"
      />
    )
  }

  if (failed) {
    return (
      <span className="inactive-link">{accessibleAlt || target || '画像'}</span>
    )
  }

  return (
    <span className="vault-image-status" role="status">
      {accessibleAlt || target || '画像'}を読み込み中…
    </span>
  )
}

export default function MarkdownPreview({
  content,
  notePath,
  attachments,
  onWikiLink
}: MarkdownPreviewProps): React.JSX.Element {
  const transformed = transformWikiLinksForPreview(content)

  return (
    <article className="markdown-preview" aria-label="Markdownプレビュー">
      <ReactMarkdown
        components={{
          img: ({ src, alt, title }) =>
            src?.startsWith('#/vault-asset/') ? (
              <VaultImage
                src={src}
                alt={alt ?? ''}
                title={title}
                notePath={notePath}
                attachments={attachments}
              />
            ) : (
              <img src={src} alt={alt ?? ''} title={title} />
            ),
          a: ({ href, children }) => {
            if (href?.startsWith('#/wiki/')) {
              const target = decodeURIComponent(href.slice('#/wiki/'.length))
              return (
                <a
                  href={href}
                  className="wiki-link"
                  onClick={(event) => {
                    event.preventDefault()
                    onWikiLink(target)
                  }}
                >
                  {children}
                </a>
              )
            }

            if (href?.startsWith('http://') || href?.startsWith('https://')) {
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault()
                    void window.tsuzune.openExternal(href)
                  }}
                >
                  {children}
                </a>
              )
            }

            return <span className="inactive-link">{children}</span>
          }
        }}
      >
        {transformed}
      </ReactMarkdown>
    </article>
  )
}
