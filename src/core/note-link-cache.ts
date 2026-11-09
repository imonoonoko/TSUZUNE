import { extractNoteLinks, type NoteLinkOccurrence } from './links'
import type { NoteDocument } from '../shared/types'

interface Entry { content: string; links: NoteLinkOccurrence[] }

/** Extracted syntax only: resolved targets always belong to the current snapshot. */
export class NoteLinkCache {
  private entries = new Map<string, Entry>()
  private characters = 0
  private occurrences = 0

  clear(): void {
    this.entries.clear()
    this.characters = this.occurrences = 0
  }

  retain(notes: readonly NoteDocument[]): void {
    const current = new Map(notes.map(note => [note.path, note.content]))
    for (const [path, entry] of this.entries) {
      if (current.get(path) !== entry.content) this.remove(path)
    }
  }

  private remove(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.characters -= entry.content.length
    this.occurrences -= entry.links.length
    this.entries.delete(key)
  }

  extract(content: string, sourcePath: string): NoteLinkOccurrence[] {
    let entry = this.entries.get(sourcePath)
    if (entry?.content !== content) {
      this.remove(sourcePath)
      entry = { content, links: extractNoteLinks(content, sourcePath) }
      // A scan miss must not evict unchanged entries that the same scan will
      // reach later. Snapshot pruning releases edited/deleted/ignored sources.
      if (this.entries.size >= 2048 ||
          this.characters + content.length > 8_000_000 ||
          this.occurrences + entry.links.length > 50_000) return entry.links
      this.entries.set(sourcePath, entry)
      this.characters += content.length
      this.occurrences += entry.links.length
    }
    // Callers may mutate their result; never expose the retained occurrences.
    return entry.links.map(link => ({ ...link, range: { ...link.range }, destinationRange: { ...link.destinationRange } }))
  }
}
