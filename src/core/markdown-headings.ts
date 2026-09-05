import { parseFrontmatter } from './frontmatter'

export interface MarkdownHeading {
  id: string
  title: string
  level: number
  line: number
  previewLine: number
  sourceOffset: number
}

interface Fence {
  marker: '`' | '~'
  length: number
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const frontmatter = parseFrontmatter(markdown)
  const hasValidFrontmatter = frontmatter.found && frontmatter.warnings.length === 0
  const body = hasValidFrontmatter ? frontmatter.body : markdown
  const bodyOffset = hasValidFrontmatter ? markdown.length - body.length : 0
  const headings: MarkdownHeading[] = []
  let fence: Fence | null = null
  let sourceOffset = bodyOffset
  let line = hasValidFrontmatter ? markdown.slice(0, bodyOffset).split(/\r?\n/).length : 1
  let previewLine = 1

  for (const rawLine of body.split(/\r?\n/)) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(rawLine)

    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ''
      ) {
        fence = null
      }
    } else if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length }
    } else {
      const headingMatch = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|)$/.exec(rawLine)
      if (headingMatch) {
        const title = (headingMatch[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim()
        if (title) {
          headings.push({
            id: `heading-${sourceOffset}`,
            title,
            level: headingMatch[1].length,
            line,
            previewLine,
            sourceOffset
          })
        }
      }
    }

    sourceOffset += rawLine.length + (sourceOffset + rawLine.length < markdown.length ? (markdown[sourceOffset + rawLine.length] === '\r' ? 2 : 1) : 0)
    line += 1
    previewLine += 1
  }

  return headings
}
