import type { NoteDocument } from '../shared/types'
import { joinRelative, withoutMarkdownExtension } from './paths'

export const TEMPLATE_DIRECTORY = '90_テンプレート'

export interface TemplateValues {
  title: string
  now: Date
}

export interface DailyNoteValues {
  now: Date
  completed: string
  insight: string
  memo?: string
  next: string
}

export type DailyNoteFormValues = Omit<DailyNoteValues, 'now'>

export interface IdeaNoteValues {
  title: string
  body: string
  reason: string
  projectPath: string
  memo?: string
  next: string
}

export type IdeaNoteFormValues = IdeaNoteValues

export interface NoteLocation {
  directory: string
  name: string
  path: string
}

export interface PlainNoteValues {
  title: string
  body: string
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function listTemplates(notes: NoteDocument[]): NoteDocument[] {
  const prefix = `${TEMPLATE_DIRECTORY}/`
  return notes
    .filter((note) => note.path.startsWith(prefix))
    .sort((left, right) => left.path.localeCompare(right.path, 'ja'))
}

export function renderTemplate(
  markdown: string,
  values: TemplateValues
): string {
  const date = localDate(values.now)
  const time = localTime(values.now)
  return markdown
    .replaceAll('{{title}}', values.title)
    .replaceAll('{{date}}', date)
    .replaceAll('{{time}}', time)
    .replaceAll('{{datetime}}', `${date}T${time}`)
}

function appendSection(lines: string[], heading: string, value: string): void {
  const content = value.trim()
  if (content) {
    lines.push(`## ${heading}`, '', content, '')
  }
}

function readSection(markdown: string, heading: string): string {
  const marker = `## ${heading}\n\n`
  const markerIndex = markdown.indexOf(marker)
  if (markerIndex < 0) {
    return ''
  }
  const contentStart = markerIndex + marker.length
  const nextHeading = markdown.indexOf('\n\n## ', contentStart)
  return markdown.slice(contentStart, nextHeading < 0 ? undefined : nextHeading).trimEnd()
}

function renderTasks(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- [ ] ${line}`)
    .join('\n')
}

function readTasks(markdown: string, heading: string): string {
  const section = readSection(markdown, heading)
  if (!section) {
    return ''
  }
  const lines = section.split('\n')
  return lines.every((line) => line.startsWith('- [ ] '))
    ? lines.map((line) => line.slice(6)).join('\n')
    : section
}

export function renderPlainNote(values: PlainNoteValues): string {
  const body = values.body
  return body.trim()
    ? `# ${values.title.trim()}\n\n${body}${body.endsWith('\n') ? '' : '\n'}`
    : `# ${values.title.trim()}\n`
}

export function dailyNoteLocation(now: Date): NoteLocation {
  const name = localDate(now)
  const directory = '02_デイリー'
  return { directory, name, path: joinRelative(directory, `${name}.md`) }
}

export function renderDailyNote(values: DailyNoteValues): string {
  const lines = [`# ${localDate(values.now)}`, '']
  appendSection(lines, '今日やったこと', values.completed)
  appendSection(lines, '気づき', values.insight)
  appendSection(lines, 'メモ', values.memo ?? '')
  appendSection(
    lines,
    '次にすること',
    renderTasks(values.next)
  )
  return `${lines.join('\n').trimEnd()}\n`
}

export function parseDailyNote(markdown: string): DailyNoteFormValues | null {
  const match = /^# (\d{4})-(\d{2})-(\d{2})\n/.exec(markdown)
  if (!match) {
    return null
  }
  const now = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  if (
    now.getFullYear() !== Number(match[1]) ||
    now.getMonth() !== Number(match[2]) - 1 ||
    now.getDate() !== Number(match[3])
  ) {
    return null
  }
  const values = {
    completed: readSection(markdown, '今日やったこと'),
    insight: readSection(markdown, '気づき'),
    memo: readSection(markdown, 'メモ'),
    next: readTasks(markdown, '次にすること')
  }
  return renderDailyNote({ now, ...values }) === markdown ? values : null
}

export function ideaNoteLocation(title: string): NoteLocation {
  const name = title.trim()
  const directory = '01_受信箱/アイデア'
  return { directory, name, path: joinRelative(directory, `${name}.md`) }
}

export function renderIdeaNote(values: IdeaNoteValues): string {
  const lines = [`# ${values.title.trim()}`, '']
  appendSection(lines, 'アイデア', values.body)
  appendSection(lines, '思いついた理由', values.reason)
  appendSection(
    lines,
    '関連プロジェクト',
    values.projectPath
      ? `- [[${withoutMarkdownExtension(values.projectPath)}]]`
      : ''
  )
  appendSection(lines, 'メモ', values.memo ?? '')
  appendSection(
    lines,
    '次の一歩',
    renderTasks(values.next)
  )
  return `${lines.join('\n').trimEnd()}\n`
}

export function parseIdeaNote(markdown: string): IdeaNoteFormValues | null {
  const titleMatch = /^# ([^\n]+)\n/.exec(markdown)
  if (!titleMatch) {
    return null
  }
  const projectSection = readSection(markdown, '関連プロジェクト')
  const projectMatch = /^\- \[\[([^\]]+)\]\]$/.exec(projectSection)
  const values = {
    title: titleMatch[1],
    body: readSection(markdown, 'アイデア'),
    reason: readSection(markdown, '思いついた理由'),
    projectPath: projectMatch ? `${projectMatch[1]}.md` : '',
    memo: readSection(markdown, 'メモ'),
    next: readTasks(markdown, '次の一歩')
  }
  return renderIdeaNote(values) === markdown ? values : null
}
