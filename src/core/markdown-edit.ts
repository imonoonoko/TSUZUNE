export type MarkdownFormat = 'heading' | 'bold' | 'list' | 'task' | 'link'

export interface MarkdownEditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function formatMarkdownSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: MarkdownFormat
): MarkdownEditResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))

  if (format === 'bold' || format === 'link') {
    const opening = format === 'bold' ? '**' : '[['
    const closing = format === 'bold' ? '**' : ']]'
    const fallback = format === 'bold' ? '太字' : 'ノート名'
    const selected = value.slice(start, end) || fallback
    const replacement = `${opening}${selected}${closing}`
    return {
      value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
      selectionStart: start + opening.length,
      selectionEnd: start + opening.length + selected.length
    }
  }

  const prefix = format === 'heading' ? '## ' : format === 'task' ? '- [ ] ' : '- '
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const searchFrom = end > start && value[end - 1] === '\n' ? end - 1 : end
  const nextLineBreak = value.indexOf('\n', searchFrom)
  const lineEnd = nextLineBreak < 0 ? value.length : nextLineBreak
  const selectedLines = value.slice(lineStart, lineEnd).split('\n')
  const replacement = selectedLines.map((line) => `${prefix}${line}`).join('\n')
  return {
    value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
    selectionStart: start + prefix.length,
    selectionEnd: end + prefix.length * selectedLines.length
  }
}

export function insertWikiLink(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  notePath: string
): MarkdownEditResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const target = notePath.replaceAll('\\', '/').replace(/\.md$/i, '')
  const label = value.slice(start, end)
  const link = `[[${target}]]`
  const replacement = label
    ? /[\r\n|\]]/.test(label)
      ? `${link}${label}`
      : `[[${target}|${label}]]`
    : link
  const cursor = start + replacement.length
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: cursor,
    selectionEnd: cursor
  }
}
