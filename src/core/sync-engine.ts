export interface SyncFile {
  id?: string
  path: string
  hash: string
}

export interface SyncPrevious {
  id?: string
  path: string
  localHash: string
  remoteHash: string
}

export interface SyncInput {
  local: readonly SyncFile[]
  remote: readonly SyncFile[]
  previous: readonly SyncPrevious[]
  deletionPolicy?: SyncDeletionPolicy
}

export interface SyncDeletionPolicy {
  propagateLocalDeletion?: boolean
  propagateRemoteDeletion?: boolean
}

export type SyncDecision =
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

function indexById<T extends { id?: string }>(files: readonly T[]): Map<string, T> {
  const indexed = new Map<string, T>()
  for (const file of files) {
    if (!file.id) continue
    if (indexed.has(file.id)) throw new Error(`Duplicate sync file id: ${file.id}`)
    indexed.set(file.id, file)
  }
  return indexed
}

function planByPath(input: SyncInput): SyncDecision[] {
  const localByPath = new Map(input.local.map((file) => [file.path, file]))
  const remoteByPath = new Map(input.remote.map((file) => [file.path, file]))
  const previousByPath = new Map(input.previous.map((file) => [file.path, file]))
  const paths = [
    ...new Set([...localByPath.keys(), ...remoteByPath.keys(), ...previousByPath.keys()])
  ].sort()
  const decisions: SyncDecision[] = []

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

export function planSync(input: SyncInput): SyncDecision[] {
  const localById = indexById(input.local)
  const remoteById = indexById(input.remote)
  const movements = new Map<string, { oldPath: string; path: string; reason?: 'local_moved' | 'remote_moved' }>()

  for (const previous of input.previous) {
    if (!previous.id) continue
    const local = localById.get(previous.id)
    const remote = remoteById.get(previous.id)
    if (!local || !remote) continue

    const localMoved = local.path !== previous.path
    const remoteMoved = remote.path !== previous.path
    if (localMoved && remoteMoved && local.path !== remote.path) {
      throw new Error(`Both copies moved to different paths: ${previous.path}`)
    }
    if (!localMoved && !remoteMoved) continue

    movements.set(previous.id, {
      oldPath: previous.path,
      path: localMoved ? local.path : remote.path,
      reason:
        localMoved === remoteMoved
          ? undefined
          : localMoved
            ? 'local_moved'
            : 'remote_moved'
    })
  }

  const normalizePath = <T extends { id?: string; path: string }>(file: T): T => {
    const movement = file.id ? movements.get(file.id) : undefined
    return movement ? { ...file, path: movement.path } : file
  }
  const normalized: SyncInput = {
    ...input,
    local: input.local.map(normalizePath),
    remote: input.remote.map(normalizePath),
    previous: input.previous.map(normalizePath)
  }
  const moveDecisions: SyncDecision[] = [...movements.values()]
    .filter((movement): movement is typeof movement & { reason: 'local_moved' | 'remote_moved' } => Boolean(movement.reason))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, oldPath, reason }) => ({ path, oldPath, action: 'move', reason }))

  return [...moveDecisions, ...planByPath(normalized)]
}
