import { createHash } from 'node:crypto'
import { listHeadingSlugs } from '../core/note-navigation'
import type { NoteDocument } from '../shared/types'

/** Saved source coordinates: UTF-16 [start,end), lines are 1-based inclusive. */
export interface SourceReference {
  note_id: string
  revision: string
  section_id: string
  heading: string
  slug: string
  start_character: number
  end_character: number
  start_line: number
  end_line: number
  heading_omitted?: boolean
}
export interface NoteSection extends SourceReference { level: number; parent_section_id?: string }
export interface SectionPageInput { limit?: number; after?: string; max_characters?: number }
export const responseLength = (value: unknown): number => JSON.stringify(value, null, 2).length
export function characterBudget(value = 15000): number {
  if (!Number.isInteger(value) || value < 1000 || value > 100000) throw new Error('max_characters must be 1000–100000.')
  return value
}
function lineAt(content: string, offset: number): number { return content.slice(0, offset).split('\n').length }
export function sourceRange(note: NoteDocument, revision: string, start: number, end: number, section?: NoteSection): SourceReference {
  return { note_id: note.path, revision, section_id: section?.section_id ?? 'preamble',
    heading: section?.heading ?? '', slug: section?.slug ?? '', start_character: start, end_character: end,
    start_line: lineAt(note.content, start), end_line: lineAt(note.content, Math.max(start, end - 1)) }
}
export function noteSections(note: NoteDocument, revision: string): NoteSection[] {
  const headings = listHeadingSlugs(note.content), sections: NoteSection[] = [], parents: NoteSection[] = []
  const first = headings[0]?.heading.sourceOffset ?? note.content.length
  if (first > 0 || !headings.length) sections.push({ ...sourceRange(note, revision, 0, first), level: 0 })
  const lastLine = lineAt(note.content,Math.max(0,note.content.length-1))
  for (const {heading,slug} of headings) {
    while (parents.length && parents.at(-1)!.level >= heading.level) {
      const previous=parents.pop()!
      previous.end_character=heading.sourceOffset; previous.end_line=Math.max(previous.start_line,heading.line-1)
    }
    const section: NoteSection = {note_id:note.path,revision,section_id:heading.id,heading:heading.title,slug,
      start_character:heading.sourceOffset,end_character:note.content.length,start_line:heading.line,end_line:lastLine,level:heading.level,
      ...(parents.length ? {parent_section_id:parents.at(-1)!.section_id} : {})}
    sections.push(section);parents.push(section)
  }
  return sections
}

export function boundedReference<T extends SourceReference>(reference: T): T {
  // Huge labels are display metadata; IDs and coordinates always survive.
  if (reference.heading.length <= 160 && reference.slug.length <= 160) return reference
  return {...reference, heading: '', slug: '', heading_omitted: true}
}
function scope(root: string, note: NoteDocument, revision: string, section: string): string {
  return createHash('sha256').update(JSON.stringify([root,note.path,revision,section])).digest('hex')
}
function cursor(fingerprint: string, offset: number): string {
  return Buffer.from(JSON.stringify({fingerprint,offset})).toString('base64url')
}
function offsetFor(after: string | undefined, fingerprint: string): number {
  if (!after) return 0
  try {
    if (after.length > 2048) throw new Error()
    const value = JSON.parse(Buffer.from(after, 'base64url').toString('utf8'))
    if (value.fingerprint !== fingerprint || !Number.isInteger(value.offset) || value.offset < 0) throw new Error()
    return value.offset
  } catch { throw new Error('Section cursor or source changed. Retrieve list_note_sections again.') }
}
export function listSections(root: string, note: NoteDocument, revision: string, input: SectionPageInput = {}) {
  const budget = characterBudget(input.max_characters), limit = input.limit ?? 50
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('limit must be 1–200.')
  const all = noteSections(note, revision), fingerprint = scope(root,note,revision,'list')
  const offset = offsetFor(input.after,fingerprint)
  if (offset > all.length) throw new Error('Invalid section cursor.')
  const output = {id:note.path,revision,sections:[] as NoteSection[],total:all.length,
    omitted_sections:all.length-offset, omitted_heading_labels:0, next_after:undefined as string|undefined}
  for (const section of all.slice(offset, offset+limit)) {
    output.sections.push(boundedReference(section))
    const next = offset+output.sections.length
    output.omitted_sections = all.length-next
    output.omitted_heading_labels = output.sections.filter(item=>item.heading_omitted).length
    output.next_after = next < all.length ? cursor(fingerprint,next) : undefined
    if (responseLength(output) > budget) {output.sections.pop();break}
  }
  if (!output.sections.length && offset < all.length) throw new Error('Section metadata exceeds the budget. Increase max_characters.')
  const next = offset+output.sections.length
  output.omitted_sections = all.length-next
  output.omitted_heading_labels = output.sections.filter(item=>item.heading_omitted).length
  output.next_after = next < all.length ? cursor(fingerprint,next) : undefined
  return output
}
export function fetchSection(root: string, note: NoteDocument, revision: string, sectionId: string, expectedRevision: string, input: SectionPageInput = {}) {
  if (expectedRevision !== revision) throw new Error('Revision changed. Retrieve list_note_sections again; no source text returned.')
  const budget = characterBudget(input.max_characters)
  const section = noteSections(note,revision).find(item=>item.section_id===sectionId)
  if (!section) throw new Error('Unknown section ID. Retrieve list_note_sections again.')
  const fingerprint = scope(root,note,revision,sectionId), offset = offsetFor(input.after,fingerprint)
  const total = section.end_character-section.start_character
  if (offset > total) throw new Error('Invalid section cursor.')
  const start = section.start_character+offset
  if (start>section.start_character && (/[\uDC00-\uDFFF]/.test(note.content[start]) || note.content[start]==='\n' && note.content[start-1]==='\r')) throw new Error('Invalid section cursor boundary.')
  const output = {id:note.path,revision,section:boundedReference(section),text:'',
    source_reference:boundedReference(sourceRange(note,revision,start,start,section)),
    total_characters:total,omitted_characters:total-offset, truncated:offset>0, next_after:undefined as string|undefined}
  // Fit serialized metadata and text together; never split a surrogate or CRLF pair.
  let lo = start, hi = section.end_character
  const selected = section
  function render(end: number) {
    output.text = note.content.slice(start,end)
    output.source_reference = boundedReference(sourceRange(note,revision,start,end,selected))
    output.omitted_characters = total-(end-selected.start_character)
    output.truncated = offset>0 || end<selected.end_character
    output.next_after = end<selected.end_character ? cursor(fingerprint,end-selected.start_character) : undefined
  }
  render(section.end_character)
  if (responseLength(output)<=budget) return output
  while (lo<hi) {const mid=Math.ceil((lo+hi)/2);render(mid);if(responseLength(output)<=budget)lo=mid;else hi=mid-1}
  let end=lo
  if (end<section.end_character && end>start && (/[\uD800-\uDBFF]/.test(note.content[end-1]) || note.content[end-1]==='\r' && note.content[end]==='\n')) end--
  render(end)
  if (responseLength(output)>budget || end===start && start<section.end_character) throw new Error('Section metadata exceeds the budget. Increase max_characters.')
  return output
}

/** Context text is formatted/projected. These are locators, never quote spans in that text. */
export function contextReferences(notes: NoteDocument[], revision: (note: NoteDocument)=>string, budget: number) {
  const output = {representation:'source_locators' as const, sections:[] as NoteSection[], omitted_references:0,
    instruction:'Context markdown is formatted and may be partial. Use fetch_note_section with the listed revision for exact quotations; list_note_sections for omitted locators.'}
  for (const note of notes) for (const section of noteSections(note,revision(note))) {
    output.sections.push(boundedReference(section))
    if(responseLength(output)>budget) {output.sections.pop();output.omitted_references++}
  }
  while (responseLength(output)>budget && output.sections.length) {output.sections.pop();output.omitted_references++}
  return output
}
