import { describe, expect, it } from 'vitest'
import { planDriveSync } from '../src/core/drive-sync'

describe('planDriveSync', () => {
  it('copies a new local note to Drive', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Inbox/新規.md', hash: 'local-new' }],
        remote: [],
        previous: []
      })
    ).toEqual([
      {
        path: 'Inbox/新規.md',
        action: 'upload',
        reason: 'new_local'
      }
    ])
  })

  it('copies a new Drive note to the local Vault', () => {
    expect(
      planDriveSync({
        local: [],
        remote: [{ path: 'Projects/共有.md', hash: 'remote-new' }],
        previous: []
      })
    ).toEqual([
      {
        path: 'Projects/共有.md',
        action: 'download',
        reason: 'new_remote'
      }
    ])
  })

  it('preserves the Drive copy when a previously synced local note is missing', () => {
    expect(
      planDriveSync({
        local: [],
        remote: [{ path: 'Archive/残す.md', hash: 'base' }],
        previous: [
          {
            path: 'Archive/残す.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Archive/残す.md',
        action: 'preserve',
        reason: 'local_deleted',
        preservedSide: 'remote'
      }
    ])
  })

  it('preserves the local copy when a previously synced Drive note is missing', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Archive/残す.md', hash: 'base' }],
        remote: [],
        previous: [
          {
            path: 'Archive/残す.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Archive/残す.md',
        action: 'preserve',
        reason: 'remote_deleted',
        preservedSide: 'local'
      }
    ])
  })

  it('does nothing when both copies still match the previous sync', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Stable.md', hash: 'base' }],
        remote: [{ path: 'Stable.md', hash: 'base' }],
        previous: [
          {
            path: 'Stable.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([])
  })

  it('uploads when only the local copy changed', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Local changed.md', hash: 'local-v2' }],
        remote: [{ path: 'Local changed.md', hash: 'base' }],
        previous: [
          {
            path: 'Local changed.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Local changed.md',
        action: 'upload',
        reason: 'local_changed'
      }
    ])
  })

  it('downloads when only the Drive copy changed', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Remote changed.md', hash: 'base' }],
        remote: [{ path: 'Remote changed.md', hash: 'remote-v2' }],
        previous: [
          {
            path: 'Remote changed.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Remote changed.md',
        action: 'download',
        reason: 'remote_changed'
      }
    ])
  })

  it('reports a conflict when both copies changed differently', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Conflict.md', hash: 'local-v2' }],
        remote: [{ path: 'Conflict.md', hash: 'remote-v2' }],
        previous: [
          {
            path: 'Conflict.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([
      {
        path: 'Conflict.md',
        action: 'conflict',
        reason: 'both_changed'
      }
    ])
  })

  it('reports a conflict when different copies exist before the first sync', () => {
    expect(
      planDriveSync({
        local: [{ path: 'Existing.md', hash: 'local' }],
        remote: [{ path: 'Existing.md', hash: 'remote' }],
        previous: []
      })
    ).toEqual([
      {
        path: 'Existing.md',
        action: 'conflict',
        reason: 'both_new_different'
      }
    ])
  })

  it('does nothing when both previously synced copies are missing', () => {
    expect(
      planDriveSync({
        local: [],
        remote: [],
        previous: [
          {
            path: 'Gone.md',
            localHash: 'base',
            remoteHash: 'base'
          }
        ]
      })
    ).toEqual([])
  })

  it('returns decisions in deterministic path order', () => {
    expect(
      planDriveSync({
        local: [
          { path: 'z-local.md', hash: 'new' },
          { path: 'm-conflict.md', hash: 'local' }
        ],
        remote: [
          { path: 'a-remote.md', hash: 'new' },
          { path: 'm-conflict.md', hash: 'remote' }
        ],
        previous: []
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
        reason: 'both_new_different'
      },
      {
        path: 'z-local.md',
        action: 'upload',
        reason: 'new_local'
      }
    ])
  })
})
