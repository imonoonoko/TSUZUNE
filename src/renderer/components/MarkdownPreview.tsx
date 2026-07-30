import ReactMarkdown from 'react-markdown'
import { transformWikiLinksForPreview } from '../../core/links'

interface MarkdownPreviewProps {
  content: string
  onWikiLink: (target: string) => void
}
export default function MarkdownPreview({
  content,
  onWikiLink
}: MarkdownPreviewProps): React.JSX.Element {
  const transformed = transformWikiLinksForPreview(content)

  return (
    <article className="markdown-preview" aria-label="Markdownプレビュー">
      <ReactMarkdown
        components={{
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
