import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Root, RootContent } from 'mdast'
import { transformWikiLinksForPreview } from '../core/links'

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

export function markdownMathRanges(markdown: string): { from: number; to: number; display: boolean }[] {
  if (!markdown.includes('$')) return []
  const ranges: { from: number; to: number; display: boolean }[] = []
  const visit = (node: Root | RootContent): void => {
    if ((node.type === 'math' || node.type === 'inlineMath') && node.position) {
      ranges.push({ from: node.position.start.offset!, to: node.position.end.offset!, display: node.type === 'math' })
    } else if ('children' in node) node.children.forEach(visit)
  }
  visit(parser.parse(markdown))
  return ranges
}

export function transformMathPreview(markdown: string): string {
  return transformWikiLinksForPreview(markdown, markdownMathRanges(markdown))
}
