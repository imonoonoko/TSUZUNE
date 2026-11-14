import type { AdvancedSearchResult } from '../core/advanced-search'
import type { NoteDocument } from '../shared/types'

export interface SearchWorkerRequest { id: number; query: string; notes?: NoteDocument[] }
export interface SearchWorkerReply { id: number; results?: AdvancedSearchResult[]; error?: string }
interface SearchWorkerOptions { timeoutMs?: number; signal?: AbortSignal; advanced?: boolean }
type Transport = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>
interface SearchResponse { results: AdvancedSearchResult[] }

export function createNoteSearchWorker(createWorker: () => Transport = () =>
  new Worker(new URL('./search-worker.ts', import.meta.url), { type: 'module' })
) {
  let worker: Transport | undefined
  let snapshot: NoteDocument[] | undefined
  let nextId = 0
  let cancel: (() => void) | undefined

  function reset(): void {
    worker?.terminate()
    worker = undefined
    snapshot = undefined
  }

  return {
    close() {
      cancel?.()
      reset()
    },
    search(notes: NoteDocument[], query: string, options: SearchWorkerOptions = {}): Promise<SearchResponse> {
      cancel?.()
      if (options.signal?.aborted) return Promise.reject(new Error('検索を取り消しました。'))

      return new Promise((resolve, reject) => {
        const active = worker ??= createWorker()
        const request: SearchWorkerRequest = { id: ++nextId, query, ...(snapshot !== notes ? { notes } : {}) }
        const finish = (error?: Error, reply?: SearchResponse) => {
          clearTimeout(timer)
          options.signal?.removeEventListener('abort', abort)
          cancel = undefined
          if (error) reject(error)
          else resolve(reply!)
        }
        const abort = () => {
          if (options.advanced) reset()
          finish(new Error('検索を取り消しました。'))
        }
        const fail = (error: Error) => {
          reset()
          finish(error)
        }
        const timer = setTimeout(() => fail(new Error('検索が時間内に完了しませんでした。検索条件を見直してください。')), options.timeoutMs ?? 3000)
        cancel = abort
        options.signal?.addEventListener('abort', abort, { once: true })
        active.onmessage = (event: MessageEvent<SearchWorkerReply>) => {
          if (worker !== active || cancel !== abort || event.data.id !== request.id) return
          const { results, error } = event.data
          if (results) finish(undefined, { results })
          else finish(new Error(error ?? '検索に失敗しました。'))
        }
        active.onerror = (event: ErrorEvent) => {
          if (worker === active && cancel === abort) fail(new Error(event.message || '検索処理を開始できませんでした。'))
          else if (worker === active && !cancel) reset()
        }
        try {
          active.postMessage(request)
          snapshot = notes
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)))
        }
      })
    }
  }
}
