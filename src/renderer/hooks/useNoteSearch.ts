import { useEffect, useMemo, useState } from 'react'
import { isAdvancedSearchQuery, type AdvancedSearchResult } from '../../core/advanced-search'
import { searchRendererRanked, searchSuggestionNotes } from '../../core/search'
import type { NoteDocument } from '../../shared/types'
import { createNoteSearchWorker } from '../search-worker-client'

interface SearchState {
  notes: NoteDocument[]
  query: string
  results: AdvancedSearchResult[]
  error?: string
}

const noResults: AdvancedSearchResult[] = []
export function useNoteSearch(notes: NoteDocument[], query: string, suggestions = false) {
  const [client] = useState(createNoteSearchWorker)
  const [state, setState] = useState<SearchState>()
  const advanced = isAdvancedSearchQuery(query)
  const immediate = !advanced && (suggestions || typeof Worker === 'undefined')
  const active = Boolean(query.trim()) && !immediate

  const synchronous = useMemo(() => immediate
    ? (suggestions ? searchSuggestionNotes(notes, query) : searchRendererRanked(notes, query))
    : noResults, [immediate, suggestions, notes, query])

  useEffect(() => () => client.close(), [client])
  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      void client.search(notes, query, { signal: abort.signal, advanced }).then(
        response => {
          if (!abort.signal.aborted) setState({ notes, query, ...response })
        },
        error => {
          if (abort.signal.aborted) return
          if (advanced) {
            setState({ notes, query, results: [], error: error instanceof Error ? error.message : String(error) })
          } else {
            setState({ notes, query, results: searchRendererRanked(notes, query) })
          }
        }
      )
    }, advanced ? 120 : 0)
    return () => { clearTimeout(timer); abort.abort() }
  }, [active, advanced, client, notes, query])

  const current = active && state?.notes === notes && state.query === query ? state : undefined
  return {
    results: active ? current?.results ?? noResults : synchronous,
    error: current?.error,
    pending: active && !current
  }
}
