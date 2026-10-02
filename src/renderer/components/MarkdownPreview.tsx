import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { inspectFrontmatterProperty, parseFrontmatter } from '../../core/frontmatter'
import { extractMarkdownHeadings } from '../../core/markdown-headings'
import { transformWikiLinksForPreview } from '../../core/links'
import { notePreviewText, resolveNoteNavigation, type NoteNavigationTarget } from '../../core/note-navigation'
import type { CompiledPathAliases } from '../../core/path-aliases'
import {
  basenameRelative,
  dirnameRelative,
  joinRelative,
  validateRelativePath
} from '../../core/paths'
import type { NoteDocument, VaultAttachment } from '../../shared/types'

interface MarkdownPreviewProps {
  content: string
  notePath: string
  attachments: readonly VaultAttachment[]
  onWikiLink: (target: string) => void
  notes?: readonly NoteDocument[]
  pathAliases?: CompiledPathAliases
  onNavigate?: (target: NoteNavigationTarget) => void
}

function NoteLink({
  href, children, kind, wikiTarget, notePath, content, notes, pathAliases, onWikiLink, onNavigate
}: {
  href: string
  children: React.ReactNode
  kind: 'wiki' | 'markdown'
  wikiTarget?: string
  notePath: string
  content: string
  notes: readonly NoteDocument[]
  pathAliases?: CompiledPathAliases
  onWikiLink: (target: string) => void
  onNavigate?: (target: NoteNavigationTarget) => void
}): React.JSX.Element {
  const [showPreview, setShowPreview] = useState(false)
  const target = resolveNoteNavigation(kind === 'wiki' ? wikiTarget ?? '' : href, kind, notePath, notes, content, pathAliases)
  const open = (): void => {
    setShowPreview(false)
    if (target.status === 'resolved') {
      if (onNavigate) onNavigate(target)
      else if (kind === 'wiki' && wikiTarget) onWikiLink(wikiTarget)
    } else if (kind === 'wiki' && wikiTarget && target.status === 'missing' && !target.fragment) {
      onWikiLink(wikiTarget)
    } else {
      onNavigate?.(target)
    }
  }
  return (
    <span className="note-link-preview-anchor"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
      onFocus={() => setShowPreview(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setShowPreview(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setShowPreview(false)
        }
      }}>
      <a href={href} className={kind === 'wiki' ? 'wiki-link' : undefined}
        onClick={(event) => { event.preventDefault(); open() }}>{children}</a>
      {showPreview ? (
        <span className="note-link-preview" role="group" aria-label="リンク先プレビュー">
          <span>{target.status === 'resolved' ? target.path : target.reason}</span>
          <span>{notePreviewText(target, notePath, content, notes)}</span>
          {target.status === 'resolved' ? <button type="button" onClick={open}>開く</button> : null}
        </span>
      ) : null}
    </span>
  )
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

function resolveMarkdownImagePath(
  src: string,
  notePath: string,
  attachments: readonly VaultAttachment[]
): string | null {
  if (!src || src.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(src) || /[?#]/.test(src)) return null
  let decoded: string
  try { decoded = decodeURIComponent(src) } catch { return null }
  const rootRelative = decoded.startsWith('/')
  const parts = rootRelative ? [] : dirnameRelative(notePath).split('/').filter(Boolean)
  const path = (rootRelative ? decoded.slice(1) : decoded).replaceAll('\\', '/')
  for (const part of path.split('/')) {
    if (part === '.') continue
    if (part === '..') { if (!parts.length) return null; parts.pop() }
    else if (part) parts.push(part)
    else return null
  }
  const resolved = parts.join('/')
  if (!resolved || !validateRelativePath(resolved).valid) return null
  return attachments.find(attachment => attachment.path.toLocaleLowerCase() === resolved.toLocaleLowerCase())?.path ?? null
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
  const isWikiAsset = src.startsWith('#/vault-asset/')
  const target = isWikiAsset ? vaultAssetTarget(src) : src
  const accessibleAlt =
    isWikiAsset && target && alt === target ? basenameRelative(alt) : alt
  const attachmentPath = useMemo(
    () =>
      target
        ? isWikiAsset
          ? resolveAttachmentPath(target, notePath, attachments)
          : resolveMarkdownImagePath(target, notePath, attachments)
        : null,
    [attachments, isWikiAsset, notePath, target]
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
    }).catch(() => {
      if (active) setFailed(true)
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

// Keep component types stable: scroll persistence must not remount images or links.
const PreviewContext = createContext<(MarkdownPreviewProps & { headings: ReturnType<typeof extractMarkdownHeadings> })>(null!)

function useHeadingProps(
    node: { position?: { start?: { line?: number } } } | undefined,
    level: number
  ): { id?: string; tabIndex?: number } {
    const { headings } = useContext(PreviewContext)
    const heading = headings.find(
      (candidate) => candidate.previewLine === node?.position?.start?.line && candidate.level === level
    )
    return heading ? { id: heading.id, tabIndex: -1 } : {}
}

const previewComponents: Components = {
  h1: ({ node, children }) => <h1 {...useHeadingProps(node, 1)}>{children}</h1>,
  h2: ({ node, children }) => <h2 {...useHeadingProps(node, 2)}>{children}</h2>,
  h3: ({ node, children }) => <h3 {...useHeadingProps(node, 3)}>{children}</h3>,
  h4: ({ node, children }) => <h4 {...useHeadingProps(node, 4)}>{children}</h4>,
  h5: ({ node, children }) => <h5 {...useHeadingProps(node, 5)}>{children}</h5>,
  h6: ({ node, children }) => <h6 {...useHeadingProps(node, 6)}>{children}</h6>,
  img: ({ src, alt, title }) => {
    const { notePath, attachments } = useContext(PreviewContext)
    return src && /^https?:\/\//i.test(src) ? (
      <img src={src} alt={alt ?? ''} title={title} />
    ) : (
      <VaultImage
        src={src ?? ''}
        alt={alt ?? ''}
        title={title}
        notePath={notePath}
        attachments={attachments}
      />
    )
  },
  a: ({ href, children }) => {
    const { notePath, content, notes = [], pathAliases, onWikiLink, onNavigate } = useContext(PreviewContext)
    if (href?.startsWith('#/wiki/')) {
      let target: string
      try { target = decodeURIComponent(href.slice('#/wiki/'.length)) }
      catch { return <span className="inactive-link">{children}</span> }
      return (
        <NoteLink href={href} kind="wiki" wikiTarget={target} notePath={notePath}
          content={content} notes={notes} pathAliases={pathAliases}
          onWikiLink={onWikiLink} onNavigate={onNavigate}>{children}</NoteLink>
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

    if (href && (href.startsWith('#') || /\.md(?:#|$)/i.test(href))) {
      return <NoteLink href={href} kind="markdown" notePath={notePath}
        content={content} notes={notes} pathAliases={pathAliases}
        onWikiLink={onWikiLink} onNavigate={onNavigate}>{children}</NoteLink>
    }

    return <span className="inactive-link">{children}</span>
  }
}

export default function MarkdownPreview({
  content,
  notePath,
  attachments,
  onWikiLink,
  notes = [],
  pathAliases,
  onNavigate
}: MarkdownPreviewProps): React.JSX.Element {
  const frontmatter = parseFrontmatter(content)
  const hasValidFrontmatter =
    frontmatter.found && frontmatter.warnings.length === 0
  const properties = hasValidFrontmatter
    ? Object.entries(frontmatter.attributes)
    : []
  const transformed = transformWikiLinksForPreview(
    hasValidFrontmatter ? frontmatter.body : content
  )
  const headings = extractMarkdownHeadings(content)

  return (
    <PreviewContext.Provider value={{ content, notePath, attachments, onWikiLink, notes, pathAliases, onNavigate, headings }}>
    <article className="markdown-preview" aria-label="Markdownプレビュー">
      {properties.length > 0 ? (
        <details className="markdown-properties" aria-label="プロパティ">
          <summary>プロパティ <span>{properties.length}件</span></summary>
          <dl className="markdown-properties-list">
            {properties.map(([name, value]) => {
              const inspected = inspectFrontmatterProperty(content, name)
              return (
              <div className="markdown-property" key={name}>
                <dt>{name}</dt>
                <dd>{inspected.ok && inspected.property?.type === 'checkbox'
                  ? <input type="checkbox" aria-label={name} checked={inspected.property.value} disabled />
                  : value ?? '（空）'}</dd>
              </div>
              )
            })}
          </dl>
        </details>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={previewComponents}
      >
        {transformed}
      </ReactMarkdown>
    </article>
    </PreviewContext.Provider>
  )
}
