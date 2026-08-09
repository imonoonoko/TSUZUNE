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
  next: string
}

export type DailyNoteFormValues = Omit<DailyNoteValues, 'now'>

export interface IdeaNoteValues {
  title: string
  body: string
  reason: string
  projectPath: string
  next: string
}

export type IdeaNoteFormValues = IdeaNoteValues

export interface NoteLocation {
  directory: string
  name: string
  path: string
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

export function dailyNoteLocation(now: Date): NoteLocation {
  const name = localDate(now)
  const directory = '02_デイリー'
  return { directory, name, path: joinRelative(directory, `${name}.md`) }
}

export function renderDailyNote(values: DailyNoteValues): string {
  const lines = [`# ${localDate(values.now)}`, '']
  appendSection(lines, '今日やったこと', values.completed)
  appendSection(lines, '気づき', values.insight)
  appendSection(
    lines,
    '次にすること',
    values.next.trim() ? `- [ ] ${values.next.trim()}` : ''
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
  const nextSection = readSection(markdown, '次にすること')
  const values = {
    completed: readSection(markdown, '今日やったこと'),
    insight: readSection(markdown, '気づき'),
    next: nextSection.startsWith('- [ ] ') ? nextSection.slice(6) : nextSection
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
  appendSection(
    lines,
    '次の一歩',
    values.next.trim() ? `- [ ] ${values.next.trim()}` : ''
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
  const nextSection = readSection(markdown, '次の一歩')
  const values = {
    title: titleMatch[1],
    body: readSection(markdown, 'アイデア'),
    reason: readSection(markdown, '思いついた理由'),
    projectPath: projectMatch ? `${projectMatch[1]}.md` : '',
    next: nextSection.startsWith('- [ ] ') ? nextSection.slice(6) : nextSection
  }
  return renderIdeaNote(values) === markdown ? values : null
}
