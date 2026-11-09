import { extractNoteLinks, type NoteLinkOccurrence } from './links'

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

  private remove(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.characters -= entry.content.length
    this.occurrences -= entry.links.length
    this.entries.delete(key)
  }

  extract(content: string, sourcePath: string): NoteLinkOccurrence[] {
    let entry = this.entries.get(sourcePath)
    if (entry?.content === content) {
      this.entries.delete(sourcePath)
      this.entries.set(sourcePath, entry)
    } else {
      this.remove(sourcePath)
      entry = { content, links: extractNoteLinks(content, sourcePath) }
      // Bound retained input and occurrences too, not just the number of files.
      if (content.length > 8_000_000 || entry.links.length > 50_000) return entry.links
      this.entries.set(sourcePath, entry)
      this.characters += content.length
      this.occurrences += entry.links.length
      while (this.entries.size > 2048 || this.characters > 8_000_000 || this.occurrences > 50_000) {
        this.remove(this.entries.keys().next().value!)
      }
    }
    // Callers may mutate their result; never expose the retained occurrences.
    return entry.links.map(link => ({ ...link, range: { ...link.range }, destinationRange: { ...link.destinationRange } }))
  }
}
