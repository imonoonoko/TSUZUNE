// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useNoteSearch } from '../src/renderer/hooks/useNoteSearch'

const notes = [{ path: 'sample.md', name: 'sample', content: 'first', modifiedAt: 1, size: 5 }]
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('immediately returns ordinary results when the Worker is unavailable', () => {
  vi.stubGlobal('Worker', undefined)
  const { result } = renderHook(() => useNoteSearch(notes, 'first'))
  expect(result.current.pending).toBe(false)
  expect(result.current.results.map(note => note.path)).toEqual(['sample.md'])
})

it('falls back for ordinary search when Worker construction fails and reports advanced errors', async () => {
  vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker unavailable') } })
  const { result, rerender } = renderHook(({ query }) => useNoteSearch(notes, query), { initialProps: { query: 'first' } })
  await waitFor(() => expect(result.current.results.map(note => note.path)).toEqual(['sample.md']))
  rerender({ query: 'content:/first/' })
  expect(result.current.results).toEqual([])
  await waitFor(() => expect(result.current.error).toBe('Worker unavailable'))
})
