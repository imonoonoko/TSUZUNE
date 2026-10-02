import { parentPort, workerData } from 'node:worker_threads'
import { evaluateBase } from '../core/base-evaluator'
import type { BaseWorkerRequest } from './base-worker-client'

try {
  const request = workerData as BaseWorkerRequest
  parentPort?.postMessage({ result: evaluateBase(request.profile, request.notes, request.viewIndex, request.options) })
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) })
}
