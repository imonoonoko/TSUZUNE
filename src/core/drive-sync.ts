export interface DriveSyncFile {
  path: string
  hash: string
}

export interface DriveSyncPrevious {
  path: string
  localHash: string
  remoteHash: string
}

export interface DriveSyncInput {
  local: readonly DriveSyncFile[]
  remote: readonly DriveSyncFile[]
  previous: readonly DriveSyncPrevious[]
  deletionPolicy?: DriveSyncDeletionPolicy
}

export interface DriveSyncDeletionPolicy {
  propagateLocalDeletion?: boolean
  propagateRemoteDeletion?: boolean
}

export type DriveSyncDecision =
  | {
      path: string
      oldPath: string
      action: 'move'
      reason: 'local_moved' | 'remote_moved'
    }
  | {
      path: string
      action: 'upload'
      reason: 'new_local' | 'local_changed'
    }
  | {
      path: string
      action: 'download'
      reason: 'new_remote' | 'remote_changed'
    }
  | {
      path: string
      action: 'preserve' | 'trash_remote'
      reason: 'local_deleted'
      preservedSide: 'remote'
    }
  | {
      path: string
      action: 'preserve' | 'trash_local'
      reason: 'remote_deleted'
      preservedSide: 'local'
    }
  | {
      path: string
      action: 'conflict'
      reason: 'both_changed' | 'both_new_different'
    }

export function planDriveSync(input: DriveSyncInput): DriveSyncDecision[] {
  const localByPath = new Map(input.local.map((file) => [file.path, file]))
  const remoteByPath = new Map(input.remote.map((file) => [file.path, file]))
  const previousByPath = new Map(input.previous.map((file) => [file.path, file]))
  const paths = [
    ...new Set([...localByPath.keys(), ...remoteByPath.keys(), ...previousByPath.keys()])
  ].sort()
  const decisions: DriveSyncDecision[] = []

  for (const path of paths) {
    const local = localByPath.get(path)
    const remote = remoteByPath.get(path)
    const previous = previousByPath.get(path)

    if (previous && !local && remote) {
      decisions.push({
        path,
        action: input.deletionPolicy?.propagateLocalDeletion
          ? 'trash_remote'
          : 'preserve',
        reason: 'local_deleted',
        preservedSide: 'remote'
      })
      continue
    }

    if (previous && local && !remote) {
      decisions.push({
        path,
        action: input.deletionPolicy?.propagateRemoteDeletion
          ? 'trash_local'
          : 'preserve',
        reason: 'remote_deleted',
        preservedSide: 'local'
      })
      continue
    }

    if (!previous && local && !remote) {
      decisions.push({ path, action: 'upload', reason: 'new_local' })
      continue
    }

    if (!previous && !local && remote) {
      decisions.push({ path, action: 'download', reason: 'new_remote' })
      continue
    }

    if (!local || !remote) {
      continue
    }

    if (local.hash === remote.hash) {
      continue
    }

    if (!previous) {
      decisions.push({ path, action: 'conflict', reason: 'both_new_different' })
      continue
    }

    const localChanged = local.hash !== previous.localHash
    const remoteChanged = remote.hash !== previous.remoteHash

    if (localChanged && remoteChanged) {
      decisions.push({ path, action: 'conflict', reason: 'both_changed' })
    } else if (localChanged) {
      decisions.push({ path, action: 'upload', reason: 'local_changed' })
    } else if (remoteChanged) {
      decisions.push({ path, action: 'download', reason: 'remote_changed' })
    }
  }

  return decisions
}
