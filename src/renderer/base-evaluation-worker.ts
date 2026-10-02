import { evaluateBase, type BaseEvaluationOptions } from '../core/base-evaluator'
import type { BaseProfile } from '../core/base-profile'
import type { NoteDocument } from '../shared/types'
type Request = { profile: BaseProfile; notes: NoteDocument[]; viewIndex: number; options: BaseEvaluationOptions }
globalThis.onmessage = (event: MessageEvent<Request>): void => {
  try { globalThis.postMessage({ ok: true, evaluation: evaluateBase(event.data.profile, event.data.notes, event.data.viewIndex, event.data.options) }) }
  catch (error) { globalThis.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) }) }
}
