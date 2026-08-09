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
  const replacement = `${prefix}${value.slice(lineStart)}`
  return {
    value: `${value.slice(0, lineStart)}${replacement}`,
    selectionStart: start + prefix.length,
    selectionEnd: end + prefix.length
  }
}
