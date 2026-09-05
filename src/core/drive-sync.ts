import { planSync, type SyncInput } from './sync-engine'

export type {
  SyncDecision as DriveSyncDecision,
  SyncDeletionPolicy as DriveSyncDeletionPolicy,
  SyncFile as DriveSyncFile,
  SyncInput as DriveSyncInput,
  SyncPrevious as DriveSyncPrevious
} from './sync-engine'

export function planDriveSync(input: SyncInput) {
  return planSync(input)
}
