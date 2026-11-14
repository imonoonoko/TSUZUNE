import { parseFrontmatter } from './frontmatter'
import { commonmarkLanguage } from '@codemirror/lang-markdown'

export interface MarkdownHeading {
  id: string
  title: string
  level: number
  line: number
  previewLine: number
  sourceOffset: number
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const frontmatter = parseFrontmatter(markdown)
  const hasValidFrontmatter = frontmatter.found && frontmatter.warnings.length === 0
  const body = hasValidFrontmatter ? frontmatter.body : markdown
  const bodyOffset = hasValidFrontmatter ? markdown.length - body.length : 0
  const headings: MarkdownHeading[] = []
  const excluded: { from: number; to: number }[] = []
  let excludedIndex = 0
  // Lezer expects the normalized lines supplied by CodeMirror; keep raw offsets for callers.
  commonmarkLanguage.parser.parse(body.replace(/\r\n/g, '\n')).iterate({ enter(node) {
    if (['FencedCode', 'CodeBlock', 'Comment', 'CommentBlock', 'HTMLBlock'].includes(node.name)) {
      excluded.push({ from: node.from, to: node.to })
      return false
    }
  } })
  let sourceOffset = bodyOffset
  let syntaxOffset = 0
  let line = hasValidFrontmatter ? markdown.slice(0, bodyOffset).split(/\r?\n/).length : 1
  let previewLine = 1
  let setextCandidate: { title: string; line: number; previewLine: number; sourceOffset: number } | null = null

  for (const rawLine of body.split(/\r?\n/)) {
    const syntaxLine = sourceOffset === 0 ? rawLine.replace(/^\uFEFF/, '') : rawLine
    while (excludedIndex < excluded.length && excluded[excludedIndex].to <= syntaxOffset) excludedIndex++
    const range = excluded[excludedIndex]
    if (range && syntaxOffset >= range.from) {
      setextCandidate = null
    } else {
      const setextMatch = /^ {0,3}(=+|-+)[ \t]*$/.exec(syntaxLine)
      if (setextMatch && setextCandidate) {
        headings.push({
          ...setextCandidate,
          id: `heading-${setextCandidate.sourceOffset}`,
          level: setextMatch[1][0] === '=' ? 1 : 2
        })
        setextCandidate = null
      } else {
        const headingMatch = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|)$/.exec(syntaxLine)
        setextCandidate = /^ {0,3}\S/.test(syntaxLine) && !headingMatch && !/^ {0,3}(?:>|[-+*] |\d+[.)] )/.test(syntaxLine)
          ? { title: rawLine.trim(), line, previewLine, sourceOffset }
          : null
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
    }

    sourceOffset += rawLine.length + (sourceOffset + rawLine.length < markdown.length ? (markdown[sourceOffset + rawLine.length] === '\r' ? 2 : 1) : 0)
    syntaxOffset += rawLine.length + 1
    line += 1
    previewLine += 1
  }

  return headings
}
