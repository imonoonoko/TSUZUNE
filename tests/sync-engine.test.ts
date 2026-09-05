import { describe, expect, it } from 'vitest'
import { planSync } from '../src/core/sync-engine'

describe('planSync', () => {
  it('keeps a local move and edit attached to the same logical note', () => {
    expect(
      planSync({
        local: [{ id: 'note-1', path: 'Archive/A.md', hash: 'local-v2' }],
        remote: [{ id: 'note-1', path: 'Inbox/A.md', hash: 'base' }],
        previous: [
          {
            id: 'note-1',
            path: 'Inbox/A.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'local_moved'
      },
      {
        path: 'Archive/A.md',
        action: 'upload',
        reason: 'local_changed'
      }
    ])
  })

  it('keeps a remote move and edit attached to the same logical note', () => {
    expect(
      planSync({
        local: [{ id: 'note-1', path: 'Inbox/A.md', hash: 'base' }],
        remote: [{ id: 'note-1', path: 'Archive/A.md', hash: 'remote-v2' }],
        previous: [
          {
            id: 'note-1',
            path: 'Inbox/A.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Archive/A.md',
        oldPath: 'Inbox/A.md',
        action: 'move',
        reason: 'remote_moved'
      },
      {
        path: 'Archive/A.md',
        action: 'download',
        reason: 'remote_changed'
      }
    ])
  })

  it('plans provider-neutral local and remote changes deterministically', () => {
    expect(
      planSync({
        local: [
          { path: 'z-local.md', hash: 'local-new' },
          { path: 'm-conflict.md', hash: 'local-v2' }
        ],
        remote: [
          { path: 'a-remote.md', hash: 'remote-new' },
          { path: 'm-conflict.md', hash: 'remote-v2' },
          { path: 'x-deleted.md', hash: 'base' }
        ],
        previous: [
          {
            path: 'm-conflict.md',
            localHash: 'base',
            remoteHash: 'base'
          },
          {
            path: 'x-deleted.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ],
        deletionPolicy: { propagateLocalDeletion: true }
      })
    ).toEqual([
      {
        path: 'a-remote.md',
        action: 'download',
        reason: 'new_remote'
      },
      {
        path: 'm-conflict.md',
        action: 'conflict',
        reason: 'both_changed'
      },
      {
        path: 'x-deleted.md',
        action: 'trash_remote',
        reason: 'local_deleted',
        preservedSide: 'remote'
      },
      {
        path: 'z-local.md',
        action: 'upload',
        reason: 'new_local'
      }
    ])
  })
})
