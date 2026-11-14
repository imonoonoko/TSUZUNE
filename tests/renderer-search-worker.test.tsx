import { expect, it, vi } from 'vitest'
import type { NoteDocument } from '../src/shared/types'
import { createNoteSearchWorker } from '../src/renderer/search-worker-client'

const note = (content: string): NoteDocument => ({ name: 'Note', path: 'note.md', content, modifiedAt: 1, size: content.length })
const result = { path: 'note.md', name: 'Note', excerpt: 'new', modifiedAt: 1, score: 10 }

function setup() {
  const transport = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'] }
  const createTransport = vi.fn(() => transport)
  const client = createNoteSearchWorker(createTransport)
  const reply = (id: number) => transport.onmessage?.call(null as unknown as Worker, { data: { id, results: [result] } } as MessageEvent)
  return { client, createTransport, transport, reply }
}

it('reuses the worker snapshot until the note collection changes', async () => {
  const { client, createTransport, transport, reply } = setup()
  const notes = [note('old')]
  const first = client.search(notes, 'old')
  const [request] = transport.postMessage.mock.calls[0]
  expect(request.notes).toEqual(notes)
  reply(request.id)
  await first

  const second = client.search(notes, 'new')
  const [reuse] = transport.postMessage.mock.calls[1]
  expect(reuse.notes).toBeUndefined()
  reply(reuse.id)
  await second

  const updated = [note('new')]
  const third = client.search(updated, 'new')
  const [replacement] = transport.postMessage.mock.calls[2]
  expect(replacement.notes).toEqual(updated)
  reply(replacement.id)
  await expect(third).resolves.toMatchObject({ results: [result] })
  expect(createTransport).toHaveBeenCalledTimes(1)
  client.close()
  expect(transport.terminate).toHaveBeenCalledTimes(1)
})

it('ignores the superseded reply and resends notes after an advanced cancellation', async () => {
  const { client, transport, reply } = setup()
  const notes = [note('new')]
  const ordinaryAbort = new AbortController()
  const first = client.search(notes, 'old', { signal: ordinaryAbort.signal })
  ordinaryAbort.abort()
  await expect(first).rejects.toThrow('取り消')
  const advancedAbort = new AbortController()
  const second = client.search(notes, '(new)', { signal: advancedAbort.signal, advanced: true })
  reply(transport.postMessage.mock.calls[0][0].id)
  advancedAbort.abort()
  await expect(second).rejects.toThrow('取り消')
  expect(transport.terminate).toHaveBeenCalledTimes(1)
  const third = client.search(notes, 'new')
  const [replacement] = transport.postMessage.mock.calls[2]
  expect(replacement.notes).toEqual(notes)
  reply(replacement.id)
  await expect(third).resolves.toMatchObject({ results: [result] })
  client.close()
})
it('terminates a timed-out query and reloads the snapshot on the next request', async () => {
  const { client, createTransport, transport, reply } = setup()
  const notes = [note('new')]
  await expect(client.search(notes, 'content:/old/', { advanced: true, timeoutMs: 5 })).rejects.toThrow('時間内')
  expect(transport.terminate).toHaveBeenCalledTimes(1)
  const next = client.search(notes, 'new')
  const [request] = transport.postMessage.mock.calls[1]
  expect(request.notes).toEqual(notes)
  expect(createTransport).toHaveBeenCalledTimes(2)
  reply(request.id)
  await expect(next).resolves.toMatchObject({ results: [result] })
  client.close()
})
