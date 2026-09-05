import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { startDriveSyncBridge } from '../src/main/mcp-drive-sync-bridge'
import { DriveSyncMcpClient } from '../src/mcp/drive-sync'
import type { DriveSyncApplyResult, DriveSyncPreview } from '../src/shared/types'
import type {
  EntryMovePlan,
  EntryMoveResult,
  EntryTrashResult
} from '../src/main/entry-move'

const preview: DriveSyncPreview = {
  planId: 'plan-1',
  createdAt: '2026-08-14T00:00:00.000Z',
  items: [{ path: 'Notes/A.md', action: 'upload', reason: 'local_changed' }],
  counts: { upload: 1, download: 0, move: 0, conflict: 0, preserve: 0 }
}

const applied: DriveSyncApplyResult = {
  uploaded: 1,
  downloaded: 0,
  moved: 0,
  conflicts: 0,
  preserved: 0,
  conflictPaths: [],
  completedAt: '2026-08-14T00:00:01.000Z'
}

const movePlan: EntryMovePlan = {
  source_type: 'markdown',
  source: 'Inbox/A.md',
  destination: 'Archive/A.md',
  fingerprint: 'sha256:plan',
  source_revision: 'sha256:source',
  content_revision: 'sha256:content',
  counts: { markdown: 1, directories: 0, attachments: 0 },
  mappings: [{ old_path: 'Inbox/A.md', new_path: 'Archive/A.md' }],
  mapping_truncated: false,
  collision: false,
  protected_source: false,
  protected_destination: false,
  link_impact: { affected_count: 0, source_paths: [] },
  drive: { tracked_moves: 1, untracked_uploads: 0 }
}

const moved: EntryMoveResult = {
  old_path: 'Inbox/A.md',
  new_path: 'Archive/A.md',
  fingerprint: movePlan.fingerprint
}

const trashed: EntryTrashResult = {
  old_path: '01_受信箱/A.md',
  new_path: '.trash/20260902/A.md',
  source_revision: 'sha256:source'
}

describe('Drive sync MCP bridge', () => {
  it('previews and applies through the running app without exposing Google credentials', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-drive-mcp-'))
    const statePath = join(root, 'mcp-drive-sync.json')
    const apply = vi.fn(async (planId: string) => {
      expect(planId).toBe(preview.planId)
      return applied
    })
    const bridge = await startDriveSyncBridge({
      statePath,
      preview: async () => preview,
      apply,
      preflightMoveEntry: async () => movePlan,
      moveEntry: async () => moved,
      trashEntry: async () => trashed
    })

    try {
      const client = new DriveSyncMcpClient(statePath)
      expect(await client.preview()).toEqual(preview)
      expect(await client.apply(preview.planId)).toEqual(applied)
      expect(
        await client.preflightMoveEntry('Inbox/A.md', 'Archive/A.md')
      ).toEqual(movePlan)
      expect(
        await client.moveEntry({
          source: movePlan.source,
          destination: movePlan.destination,
          expected_fingerprint: movePlan.fingerprint
        })
      ).toEqual(moved)
      expect(
        await client.trashEntry({
          source: trashed.old_path,
          expected_revision: trashed.source_revision
        })
      ).toEqual(trashed)
      expect(apply).toHaveBeenCalledOnce()
      expect(await readFile(statePath, 'utf8')).not.toContain('refresh')
    } finally {
      await bridge.close()
    }
  })

  it('rejects unauthenticated loopback requests and requires the app after close', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-drive-mcp-'))
    const statePath = join(root, 'mcp-drive-sync.json')
    const bridge = await startDriveSyncBridge({
      statePath,
      preview: async () => preview,
      apply: async () => applied
    })
    const state = JSON.parse(await readFile(statePath, 'utf8')) as { origin: string }
    expect(
      await fetch(`${state.origin}/preview`, { method: 'POST' }).then(
        (response) => response.status
      )
    ).toBe(401)

    await bridge.close()
    await expect(new DriveSyncMcpClient(statePath).preview()).rejects.toThrow(
      'TSUZUNE本体を起動'
    )
  })
})
