import { describe, expect, it } from 'vitest'
import { planBulkEntryMoves, runBulkEntryMoves } from '../src/shared/entry-moves'

describe('Explorer bulk move', () => {
  it('coalesces ancestor selections and skips entries already in the destination', () => {
    expect(planBulkEntryMoves(['folder/a.md', 'folder', 'folder', 'dest/b.md'], 'dest',
      ['folder', 'folder/a.md', 'dest', 'dest/b.md'], ['folder', 'dest'])).toEqual(['folder'])
  })

  it('rejects collisions, stale selections and invalid destinations before moving', () => {
    expect(() => planBulkEntryMoves(['a/x.md', 'b/X.md'], 'dest', ['a/x.md', 'b/X.md', 'dest'], ['dest'])).toThrow(/同じ名前/)
    expect(() => planBulkEntryMoves(['a.md'], 'dest', ['a.md', 'dest/A.md', 'dest'], ['dest'])).toThrow(/既に/)
    expect(() => planBulkEntryMoves(['stale.md'], 'dest', ['dest'], ['dest'])).toThrow(/変更/)
    expect(() => planBulkEntryMoves(['folder'], 'folder/sub', ['folder', 'folder/sub'], ['folder', 'folder/sub'])).toThrow(/内側/)
  })

  it('stops on a partial failure and preserves the paths of completed moves', async () => {
    const calls: string[] = []
    const result = await runBulkEntryMoves(['a.md', 'b.md', 'c.md'], async path => {
      calls.push(path)
      if (path === 'b.md') throw new Error('move failed')
      return { moved: true, continue: true }
    })
    expect(calls).toEqual(['a.md', 'b.md'])
    expect(result).toEqual({ completed: ['a.md'], remaining: ['b.md', 'c.md'] })
  })

  it('counts a committed move before stopping on a refresh failure', async () => {
    expect(await runBulkEntryMoves(['a.md', 'b.md'], async () => ({ moved: true, continue: false }))).toEqual({
      completed: ['a.md'], remaining: ['b.md']
    })
  })
})
