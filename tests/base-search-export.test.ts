import { describe, expect, it } from 'vitest'
import { serializeBaseExport } from '../src/core/base-export'
import { searchBaseRows } from '../src/core/base-search'
import type { BaseEvaluation } from '../src/core/base-evaluator'

const evaluation: BaseEvaluation = {
  scope: 'normal-discovery-snapshot', targetCount: 2, excludedCount: 0, diagnostics: [], columns: ['file.name', 'status'],
  rows: [
    { path: 'A.md', cells: { 'file.name': { kind: 'value', value: 'Alpha, one.md' }, status: { kind: 'value', value: 'Open' } } },
    { path: 'B.md', cells: { 'file.name': { kind: 'value', value: 'Beta.md' }, status: { kind: 'value', value: 'Done' } } }
  ]
}

describe('Base search and export', () => {
  it('searches visible values case-insensitively and rejects oversized queries', () => {
    expect(searchBaseRows(evaluation, 'OPEN').map(row => row.path)).toEqual(['A.md'])
    expect(searchBaseRows(evaluation, '').map(row => row.path)).toEqual(['A.md', 'B.md'])
    expect(() => searchBaseRows(evaluation, 'a'.repeat(257))).toThrow()
  })
  it('exports a quoted CSV header and tab-separated TSV from the evaluated rows', () => {
    expect(serializeBaseExport(evaluation, 'csv')).toBe('file.name,status\r\n"Alpha, one.md",Open\r\nBeta.md,Done')
    expect(serializeBaseExport(evaluation, 'tsv')).toBe('file.name\tstatus\r\nAlpha, one.md\tOpen\r\nBeta.md\tDone')
  })
  it('keeps spreadsheet formulas inert and preserves negative numbers', () => {
    const inputs = [' =SUM(1,2)', '+text', '@name', '-text', '-23.5']
    const data: BaseEvaluation = { ...evaluation, columns: ['file.name'], rows: inputs.map((value, index) => ({
      path: index + '.md', cells: { 'file.name': { kind: 'value', value } }
    })) }
    expect(serializeBaseExport(data, 'tsv').split('\r\n').slice(1)).toEqual(["' =SUM(1,2)", "'+text", "'@name", "'-text", '-23.5'])
  })
})
