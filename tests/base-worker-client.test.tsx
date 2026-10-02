import { Worker as ThreadWorker } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'
import { runBaseWorker } from '../src/renderer/base-worker-client'
import type { BaseEvaluation } from '../src/core/base-evaluator'
const evaluation: BaseEvaluation = { scope: 'normal-discovery-snapshot', rows: [], columns: [], targetCount: 0, excludedCount: 0, diagnostics: [] }
function worker() { return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'] } }
describe('Base worker lifecycle', () => {
  it('terminates after a result and returns it', async () => {
    const instance = worker(); const promise = runBaseWorker(instance, {}, {})
    instance.onmessage?.call(null as unknown as Worker, { data: { ok: true, evaluation } } as MessageEvent)
    expect(await promise).toEqual(evaluation)
    expect(instance.terminate).toHaveBeenCalledTimes(1)
  })
  it('terminates on explicit cancellation, including already aborted signals', async () => {
    const controller = new AbortController(); const instance = worker(); const promise = runBaseWorker(instance, {}, { signal: controller.signal })
    controller.abort(); await expect(promise).rejects.toThrow(/cancelled/); expect(instance.terminate).toHaveBeenCalledTimes(1)
    const aborted = worker(); await expect(runBaseWorker(aborted, {}, { signal: controller.signal })).rejects.toThrow(/cancelled/); expect(aborted.postMessage).not.toHaveBeenCalled()
  })
  it('reports worker errors and terminates', async () => {
    const instance = worker(); const promise = runBaseWorker(instance, {}, {})
    instance.onerror?.call(null as unknown as Worker, { message: 'worker failure' } as ErrorEvent)
    await expect(promise).rejects.toThrow('worker failure'); expect(instance.terminate).toHaveBeenCalledTimes(1)
  })
  it('terminates a real thread stuck in catastrophic regular-expression matching', async () => {
    const thread = new ThreadWorker('const { parentPort } = require("node:worker_threads"); parentPort.on("message", () => { /(a+)+$/.test("a".repeat(200) + "!"); });', { eval: true })
    const instance = { postMessage: (message: unknown) => thread.postMessage(message), terminate: vi.fn(() => { void thread.terminate() }), onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'] }
    const began = Date.now()
    await expect(runBaseWorker(instance, {}, { timeoutMs: 100 })).rejects.toThrow(/timed out/)
    expect(instance.terminate).toHaveBeenCalledTimes(1)
    expect(Date.now() - began).toBeLessThan(1000)
  })
  it('terminates if structured cloning/postMessage fails', async () => {
    const instance = worker(); instance.postMessage.mockImplementation(() => { throw new Error('clone failed') })
    await expect(runBaseWorker(instance, {}, {})).rejects.toThrow('clone failed'); expect(instance.terminate).toHaveBeenCalledTimes(1)
  })
})
