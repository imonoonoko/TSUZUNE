import { parseFrontmatter } from './frontmatter'

export const TODO_PATH = 'ToDo.md'
export interface TodoItem { from: number; to: number; title: string; done: boolean }

function scanTodos(content: string): { items: TodoItem[]; unclosed: boolean } {
  const frontmatter = parseFrontmatter(content)
  if (frontmatter.found && frontmatter.raw === null) return { items: [], unclosed: true }
  const body = frontmatter.body.replace(/^\uFEFF/, '')
  const offset = content.length - body.length
  const items: TodoItem[] = []
  let fence: string | null = null
  for (const line of body.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    if (!line[0]) continue
    const text = line[0].replace(/[\r\n]+$/, '')
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text)
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null
      continue
    }
    if (marker && (marker[1][0] !== '`' || !marker[2].includes('`'))) { fence = marker[1]; continue }
    const task = /^- \[([ xX])\] (.+)$/.exec(text)
    if (task) items.push({ from: offset + line.index, to: offset + line.index + line[0].length,
      title: task[2], done: task[1] !== ' ' })
  }
  return { items, unclosed: fence !== null }
}

export function readTodos(content: string): TodoItem[] { return scanTodos(content).items }

export function changeTodo(content: string, item: TodoItem, action: 'toggle' | 'delete'): string {
  const current = readTodos(content).find(candidate => candidate.from === item.from)
  if (!current || current.title !== item.title || current.done !== item.done) throw new Error('ToDoが変更されています。再読込してください。')
  return action === 'delete'
    ? content.slice(0, current.from) + content.slice(current.to)
    : content.slice(0, current.from + 3) + (current.done ? ' ' : 'x') + content.slice(current.from + 4)
}

export function addTodo(content: string, title: string): string {
  const normalized = title.trim()
  if (!normalized || /[\r\n]/.test(normalized)) throw new Error('ToDoを一行で入力してください。')
  if (scanTodos(content).unclosed) throw new Error('ToDo.mdのFrontmatterまたはコードブロックを閉じてから追加してください。')
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  return `${content}${content && !content.endsWith('\n') ? eol : ''}- [ ] ${normalized}${eol}`
}
