import { baseValueText, special, type BaseValue } from './base-expression'
import type { BaseCell, BaseEvaluation } from './base-evaluator'
import { baseCellText } from './base-search'

function exportValue(cell: BaseCell | undefined): string {
  if (cell?.kind !== 'value') return baseCellText(cell)
  const render = (value: BaseValue): string => Array.isArray(value) ? value.map(render).join('; ') : special(value) && value.label != null ? render(value.label) : baseValueText(value)
  return render(cell.value)
}

const MAX_BASE_EXPORT_BYTES = 10 * 1024 * 1024

function serializeRows(rows: string[][], format: 'tsv' | 'csv'): string {
  if (!['tsv', 'csv'].includes(format) || !Array.isArray(rows) || !rows.length ||
    !Array.isArray(rows[0]) || !rows[0].length) throw new Error('出力する表の形式が不正です。')
  const delimiter = format === 'csv' ? ',' : '\t'
  const quote = format === 'csv' ? /[,\r\n"]/ : /[\t\r\n"]/
  let bytes = 0
  return Array.from(rows, (row, index) => {
    if (!Array.isArray(row) || row.length !== rows[0].length) throw new Error('出力する表の列数が揃っていません。')
    bytes += index ? 2 : 0
    return Array.from(row, (value, column) => {
      if (typeof value !== 'string') throw new Error('出力する値は文字列にしてください。')
      if (/^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/u.test(value) &&
        !(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)))) value = `'${value}`
      if (value.length > MAX_BASE_EXPORT_BYTES) throw new Error('出力の上限は10MiBです。')
      const field = quote.test(value) ? `"${value.replaceAll('"', '""')}"` : value
      bytes += new TextEncoder().encode(field).length + (column ? 1 : 0)
      if (bytes > MAX_BASE_EXPORT_BYTES) throw new Error('出力の上限は10MiBです。')
      return field
    }).join(delimiter)
  }).join('\r\n')
}

export function serializeBaseExport(evaluation: BaseEvaluation, format: 'csv' | 'tsv'): string {
  if (evaluation.rows.length > 10000 || evaluation.columns.length > 100) throw new Error('エクスポートの上限を超えました。')
  const columns = evaluation.columns
  const rows = [columns.map(column => evaluation.labels?.[column] ?? column),
    ...evaluation.rows.map(row => columns.map(column => exportValue(row.cells[column])))]
  return serializeRows(rows, format)
}
