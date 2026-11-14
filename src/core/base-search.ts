import DOMPurify from 'dompurify'
import { baseValueText, special, type BaseValue } from './base-expression'
import type { BaseCell, BaseEvaluation } from './base-evaluator'
import { normalizeSuggestionText } from '../shared/search-normalize'

export function baseCellText(cell: BaseCell | undefined): string {
  if (!cell || cell.kind === 'missing') return '—'
  if (cell.kind === 'empty') return ''
  if (cell.kind === 'diagnostic') return `未対応: ${cell.message}`
  const text = (value: BaseValue): string => Array.isArray(value) ? value.map(text).join(', ') : special(value, 'html') ? DOMPurify.sanitize(value.value, { RETURN_DOM_FRAGMENT: true }).textContent ?? '' : special(value) && value.label != null ? text(value.label) : baseValueText(value)
  return text(cell.value)
}

export function searchBaseRows(evaluation: BaseEvaluation, query: string): BaseEvaluation['rows'] {
  if (query.length > 256) throw new Error('検索語は256文字以内にしてください。')
  const normalized = normalizeSuggestionText(query.trim())
  if (!normalized) return evaluation.rows
  return evaluation.rows.filter(row => evaluation.columns.some(column => normalizeSuggestionText(baseCellText(row.cells[column] ?? { kind: 'missing' })).includes(normalized)))
}
