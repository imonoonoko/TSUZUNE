import { markdownLanguage } from '@codemirror/lang-markdown'
import { markdownExcludedRanges } from './links'

function markdownBlocks(source: string): { blockId: string; content: string; sourceOffset: number }[] {
  const tree = markdownLanguage.parser.parse(source)
  const excluded = markdownExcludedRanges(source, tree)
  const blocks: { blockId: string; content: string; sourceOffset: number }[] = []
  for (const match of source.matchAll(/(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*(?=\r?$)/gm)) {
    const id = match[1]
    const marker = match.index + match[0].indexOf('^')
    if (excluded.some(range => marker >= range.from && marker < range.to)) continue
    let node = tree.resolveInner(marker + 1)
    while (node.parent && node.name !== 'Paragraph') node = node.parent
    if (node.name !== 'Paragraph') continue
    const standalone = source.slice(node.from, node.to).trim() === `^${id}`
    if (standalone) {
      const previous = node.prevSibling
      if (node.parent?.name !== 'Document' || !previous || !/\r?\n[ \t]*\r?\n/.test(source.slice(previous.to, node.from))) continue
      blocks.push({ blockId: id, content: source.slice(previous.from, previous.to), sourceOffset: previous.from })
    } else {
      if (source.slice(marker + match[0].length - match[0].indexOf('^'), node.to).trim()) continue
      if (node.parent?.name === 'ListItem') node = node.parent
      if (node.parent?.name === 'Blockquote') continue
      blocks.push({ blockId: id, content: source.slice(node.from, match.index).trimEnd() + source.slice(match.index + match[0].length, node.to), sourceOffset: node.from })
    }
  }
  return blocks
}

export function resolveMarkdownBlock(source: string, id: string): { content: string; sourceOffset: number } | { reason: string } {
  if (!/^[A-Za-z0-9-]+$/.test(id)) return { reason: 'ブロックIDは英数字とハイフンで指定してください。' }
  const blocks = markdownBlocks(source).filter(block => block.blockId === id)
  return blocks.length === 1 ? { content: blocks[0].content, sourceOffset: blocks[0].sourceOffset } : { reason: blocks.length > 1
    ? `ブロックID「${id}」が複数あります。` : `ブロック「${id}」が見つかりません。` }
}

export function listMarkdownBlocks(source: string): { blockId: string; content: string; sourceOffset: number }[] {
  const blocks = markdownBlocks(source)
  const counts = new Map<string, number>()
  for (const block of blocks) counts.set(block.blockId, (counts.get(block.blockId) ?? 0) + 1)
  return blocks.filter(block => counts.get(block.blockId) === 1)
}
