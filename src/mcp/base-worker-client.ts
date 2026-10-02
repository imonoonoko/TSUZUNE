import { Worker } from 'node:worker_threads'
import type { BaseProfile } from '../core/base-profile'
import type { BaseEvaluation, BaseEvaluationOptions } from '../core/base-evaluator'
import type { NoteDocument } from '../shared/types'

export interface BaseWorkerRequest { profile: BaseProfile; notes: NoteDocument[]; viewIndex: number; options: BaseEvaluationOptions }
export interface BaseWorkerOptions { timeoutMs?: number; signal?: AbortSignal; workerUrl?: URL }
/** Each request owns one Worker; termination completes before the promise settles. */
export function evaluateBaseInWorker(request: BaseWorkerRequest, options: BaseWorkerOptions = {}): Promise<BaseEvaluation> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(new Error('Bases evaluation cancelled.')); return }
    const timeoutMs = options.timeoutMs ?? 3000
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) { reject(new Error('Invalid Worker timeout.')); return }
    const worker = new Worker(options.workerUrl ?? new URL('./base-worker.js', import.meta.url), { workerData: request })
    let settled = false
    const finish = (error?: Error, result?: BaseEvaluation): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', cancel)
      void worker.terminate().then(() => { if (error) reject(error); else resolve(result!) }, reject)
    }
    const cancel = (): void => finish(new Error('Bases evaluation cancelled.'))
    const timer = setTimeout(() => finish(new Error('Bases evaluation timed out. Restart the query.')), timeoutMs)
    options.signal?.addEventListener('abort', cancel, { once: true })
    worker.once('message', (message: { result?: BaseEvaluation; error?: string }) => {
      if (message.error || !message.result) finish(new Error(message.error ?? 'Invalid Bases Worker result.'))
      else finish(undefined, message.result)
    })
    worker.once('error', (error) => finish(error))
    worker.once('exit', () => { if (!settled) finish(new Error('Bases Worker exited without a result.')) })
    if (options.signal?.aborted) cancel()
  })
}
