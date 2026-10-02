export interface DriveAutoSyncStatus {
  rootPath: string | null
  enabled: boolean
  state: 'off' | 'waiting' | 'syncing' | 'synced' | 'conflict' | 'error'
  lastCheckedAt: string | null
  lastSyncAt: string | null
  message: string
  conflictPaths: string[]
}

export function parseDriveAutoSyncByVault(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([path, enabled]) => path.length > 0 && enabled === true))
}
