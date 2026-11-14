import { isAdvancedSearchQuery, searchAdvancedNotes } from '../core/advanced-search'
import { createRendererSearchIndex, searchRendererRanked } from '../core/search'
import type { NoteDocument } from '../shared/types'
import type { SearchWorkerReply, SearchWorkerRequest } from './search-worker-client'

let notes: NoteDocument[] = []
let index: ReturnType<typeof createRendererSearchIndex> | undefined
self.onmessage = (event: MessageEvent<SearchWorkerRequest>): void => {
  const { id, query } = event.data
  const reply = (message: SearchWorkerReply) => self.postMessage(message)
  try {
    if (event.data.notes) {
      notes = event.data.notes
      index = undefined
    }
    if (isAdvancedSearchQuery(query)) {
      reply({ id, results: searchAdvancedNotes(notes, query) })
    } else {
      index ??= createRendererSearchIndex(notes)
      reply({ id, results: searchRendererRanked(notes, query, index) })
    }
  } catch (error) {
    reply({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
