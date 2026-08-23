import { readFile, writeFile } from 'node:fs/promises'
import { describe, it } from 'vitest'
import {
  EntryMoveCoordinator,
  type EntryMoveJournalStage
} from '../../src/main/entry-move'
import { VaultService } from '../../src/main/vault'

const root = process.env.TSUZUNE_CRASH_FIXTURE_ROOT
const crashStage = process.env.TSUZUNE_CRASH_FIXTURE_STAGE as
  | EntryMoveJournalStage
  | undefined

describe.skipIf(!root || !crashStage)('entry move crash child', () => {
  it('exits immediately after the requested durable journal stage', async () => {
    const vault = new VaultService()
    await vault.setRootPath(root!)
    const ledgerPath = `${root}/drive-pending.json`
    const readPending = async (): Promise<Record<string, string>> =>
      JSON.parse(await readFile(ledgerPath, 'utf8')) as Record<string, string>
    const writePending = async (value: Record<string, string>): Promise<void> =>
      writeFile(ledgerPath, JSON.stringify(value), 'utf8')
    const coordinator = new EntryMoveCoordinator({
      vault,
      drive: {
        inspectLocalMoves: async () => ({
          tracked: 1,
          untracked: 0,
          pendingMoves: await readPending()
        }),
        recordLocalMoves: async (mappings) => {
          const pending = await readPending()
          for (const mapping of mappings) pending[mapping.oldPath] = mapping.path
          await writePending(pending)
        },
        replacePendingMoves: writePending
      },
      afterJournalStage: async (stage) => {
        if (stage === crashStage) {
          ;(process as NodeJS.Process & { reallyExit(code?: number): never }).reallyExit(86)
        }
      }
    })
    const plan = await coordinator.preflight('Inbox/A.md', 'Archive/A.md', 'ai')
    await coordinator.apply({
      source: plan.source,
      destination: plan.destination,
      expected_fingerprint: plan.fingerprint,
      actor: 'ai',
      reason: 'crash test',
      source_refs: []
    })
  })
})
