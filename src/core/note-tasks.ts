import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { RootContent, Root } from 'mdast'
import { parseFrontmatter } from './frontmatter'

export interface NoteTask { from: number; to: number; checkbox: number; title: string; done: boolean }
const parser = unified().use(remarkParse).use(remarkGfm)

export function readNoteTasks(content: string): NoteTask[] {
  const frontmatter = parseFrontmatter(content)
  if (frontmatter.found && frontmatter.raw === null) return []
  const body = frontmatter.body.replace(/^\uFEFF/, '')
  const offset = content.length - body.length
  const tasks: NoteTask[] = []
  function visit(node: Root | RootContent): void {
    if (node.type === 'listItem' && typeof node.checked === 'boolean' && node.position) {
      const from = offset + node.position.start.offset!
      const text = content.slice(from).split(/[\r\n]/, 1)[0]
      const match = /^((?:[-+*]|\d+[.)])[ \t]+\[)([ xX])\][ \t]+(.*)$/.exec(text)
      if (match) tasks.push({ from, to: from + text.length, checkbox: from + match[1].length, title: match[3], done: node.checked })
    }
    // Only list containers can contribute tasks; examples in code, HTML and quotations remain prose.
    if (node.type === 'root' || node.type === 'list' || node.type === 'listItem') node.children.forEach(visit)
  }
  visit(parser.parse(body))
  return tasks
}

export function toggleNoteTask(content: string, task: NoteTask): string {
  const current = readNoteTasks(content).find(item => item.from === task.from)
  if (!current || current.to !== task.to || current.checkbox !== task.checkbox || current.title !== task.title || current.done !== task.done) {
    throw new Error('タスクの行が変更されています。一覧を再読込してください。')
  }
  return content.slice(0, current.checkbox) + (current.done ? ' ' : 'x') + content.slice(current.checkbox + 1)
}
