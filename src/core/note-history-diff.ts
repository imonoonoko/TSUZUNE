/** Compare exact lines, with bounded LCS work and a readable fallback for large edits. */
export function compareNoteVersions(before: string, after: string): { text: string; coarse: boolean; truncated: boolean } {
  if (before === after) return { text: '差分はありません。', coarse: false, truncated: false }
  const lines = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const a = lines(before), b = lines(after)
  let start = 0, endA = a.length, endB = b.length
  while (start < endA && start < endB && a[start] === b[start]) start++
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
  let text = '', count = 0, truncated = false
  const emit = (prefix: string, line: string): void => {
    if (count >= 2000 || text.length >= 150000) { truncated = true; return }
    const ending = line.endsWith('\r\n') ? ' [CRLF]' : line.endsWith('\n') ? '' : ' [末尾改行なし]'
    const rendered = prefix + line.replace(/\r?\n$/, '') + ending + '\n'
    const remaining = 150000 - text.length
    text += rendered.slice(0, remaining)
    if (rendered.length > remaining) truncated = true
    count++
  }
  if (start > 3) text += `… 共通の${start - 3}行 …\n`
  for (let i = Math.max(0, start - 3); i < start; i++) emit('  ', a[i])
  const n = endA - start, m = endB - start
  const coarse = (n + 1) * (m + 1) > 250000
  if (coarse) {
    for (let i = start; i < endA; i++) emit('- ', a[i])
    for (let j = start; j < endB; j++) emit('+ ', b[j])
  } else {
    const width = m + 1, table = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] = a[start + i] === b[start + j] ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
    let i = 0, j = 0
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) { emit('  ', a[start + i++]); j++ }
      else if (i < n && (j === m || table[(i + 1) * width + j] >= table[i * width + j + 1])) emit('- ', a[start + i++])
      else emit('+ ', b[start + j++])
    }
  }
  for (let i = endA; i < Math.min(a.length, endA + 3); i++) emit('  ', a[i])
  if (a.length - endA > 3 && text.length < 149950) text += `… 共通の${a.length - endA - 3}行 …\n`
  return { text, coarse, truncated }
}
