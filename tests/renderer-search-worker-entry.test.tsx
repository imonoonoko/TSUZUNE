import { afterEach, expect, it, vi } from 'vitest'
import type { SearchWorkerReply, SearchWorkerRequest } from '../src/renderer/search-worker-client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('searches each replacement snapshot and uses it for subsequent plain and advanced requests', async () => {
  const worker = { onmessage: null as ((event: MessageEvent<SearchWorkerRequest>) => void) | null, postMessage: vi.fn<(reply: SearchWorkerReply) => void>() }
  vi.stubGlobal('self', worker)
  await import('../src/renderer/search-worker')

  const note = (content: string) => ({ path: 'sample.md', name: 'sample', content, size: content.length, modifiedAt: 1 })
  const search = (request: SearchWorkerRequest) => {
    worker.onmessage?.({ data: request } as MessageEvent<SearchWorkerRequest>)
    return worker.postMessage.mock.lastCall?.[0]
  }
  expect(search({ id: 1, notes: [note('first')], query: 'first' })?.results).toHaveLength(1)
  expect(search({ id: 2, query: 'second' })?.results).toEqual([])
  expect(search({ id: 3, notes: [note('İ😀\nsecond result')], query: 'first' })?.results).toEqual([])
  expect(search({ id: 4, query: 'second' })?.results).toHaveLength(1)
  expect(search({ id: 5, query: 'line:/second/' })?.results?.[0]?.sourceMatch).toMatchObject({ match_start: 4, match_end: 10 })
})
