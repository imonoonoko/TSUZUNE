import type { BaseEvaluation, BaseEvaluationOptions } from '../core/base-evaluator'
import type { BaseProfile } from '../core/base-profile'
import type { NoteDocument } from '../shared/types'
export interface BaseWorkerOptions extends BaseEvaluationOptions { timeoutMs?: number; signal?: AbortSignal }
export function evaluateBaseInWorker(profile: BaseProfile, notes: readonly NoteDocument[], viewIndex = 0, options: BaseWorkerOptions = {}): Promise<BaseEvaluation> {
  const worker = new Worker(new URL('./base-evaluation-worker.ts', import.meta.url), { type: 'module' })
  return runBaseWorker(worker, { profile, notes, viewIndex, options: { propertyTypes: options.propertyTypes, now: options.now, deadline: Date.now() + (options.timeoutMs ?? 3000), maxSteps: options.maxSteps, thisFile: options.thisFile } }, options)
}
/** Exported for lifecycle tests: every completion, error, timeout, and cancellation terminates. */
export function runBaseWorker(worker: Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>, request: unknown, options: Pick<BaseWorkerOptions, 'timeoutMs' | 'signal'>): Promise<BaseEvaluation> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error, evaluation?: BaseEvaluation): void => {
      if (settled) return
      settled = true; clearTimeout(timer); options.signal?.removeEventListener('abort', abort); worker.terminate()
      if (error) reject(error); else resolve(evaluation!)
    }
    const abort = (): void => finish(new Error('Base evaluation cancelled.'))
    const timer = setTimeout(() => finish(new Error('Base evaluation timed out. Reduce the expression or regular expression.')), options.timeoutMs ?? 3000)
    worker.onmessage = (event: MessageEvent<{ ok: boolean; evaluation?: BaseEvaluation; message?: string }>): void => event.data.ok ? finish(undefined, event.data.evaluation) : finish(new Error(event.data.message ?? 'Base evaluation failed.'))
    worker.onerror = (event: ErrorEvent): void => finish(new Error(event.message || 'Base worker failed.'))
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) { abort(); return }
    try { worker.postMessage(request) } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
  })
}
