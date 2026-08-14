export type Result<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: AppError
    }

export interface AppError {
  code:
    | 'NO_VAULT'
    | 'INVALID_PATH'
    | 'INVALID_NAME'
    | 'ALREADY_EXISTS'
    | 'NOT_FOUND'
    | 'ACCESS_DENIED'
    | 'FILE_CHANGED'
    | 'SAVE_FAILED'
    | 'UNKNOWN'
  message: string
  currentContent?: string
  currentModifiedAt?: number
}

export interface NoteDocument {
  path: string
  name: string
  content: string
  modifiedAt: number
  createdAt?: number | null
  size: number
}

export interface VaultAttachment {
  path: string
  name: string
  modifiedAt: number
  createdAt: number | null
  size: number
}

export interface VaultBookmark {
  type: 'file'
  path: string
  title?: string
  group?: string
  ctime: number
}

export interface SaveBookmarkInput {
  path: string
  title?: string
  group?: string
}

export interface VaultSnapshot {
  rootPath: string
  rootName: string
  directories: string[]
  notes: NoteDocument[]
  attachments?: VaultAttachment[]
  bookmarks?: VaultBookmark[]
  pathAliases?: Record<string, string>
}

export interface SaveNoteInput {
  path: string
  content: string
  expectedModifiedAt: number
  force?: boolean
}

export interface SaveNoteOutput {
  path: string
  modifiedAt: number
  size: number
}

export interface CreateNoteInput {
  directory: string
  name: string
  content?: string
}

export interface CreateDirectoryInput {
  parent: string
  name: string
}

export interface RenameEntryInput {
  path: string
  newName: string
}

export interface MoveNoteInput {
  path: string
  destinationDirectory: string
  destinationPath?: string
}

export interface EntryOperationOutput {
  oldPath?: string
  path: string
}

export interface VaultChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

export interface AppSettings {
  lastVaultPath: string | null
  lastNotePath: string | null
  userIgnoreFilters: string[]
  graphForces: GraphForceSettings
  aiImmutablePaths?: string[]
  aiReviewPaths?: string[]
  graphDisplay: GraphDisplaySettings
  graphFilters: GraphFilterSettings
  graphGroups: GraphGroup[]
  graphViewStates: GraphViewStates
}

export type GraphViewScope = 'local' | 'vault'
export interface AiWriteReviewProposal {
  id: string
  path: string
  operation: 'create' | 'update'
  content: string
  expectedRevision: string | null
  reason: string
  sourceRefs: string[]
  createdAt: string
}


export interface GraphSettingsSectionState {
  filters: boolean
  groups: boolean
  display: boolean
  forces: boolean
}

export interface GraphViewState {
  scale: number
  query: string
  settingsOpen: boolean
  settingsSections: GraphSettingsSectionState
}

export type GraphViewStates = Record<GraphViewScope, GraphViewState>

export interface GraphGroup {
  id: string
  query: string
  color: string
}

export interface GraphForceSettings {
  centerForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
}

export interface GraphDisplaySettings {
  arrows: boolean
  textFade: number
  nodeSize: number
  lineSize: number
}

export interface GraphFilterSettings {
  showTags: boolean
  showAttachments: boolean
  existingFilesOnly: boolean
  showOrphans: boolean
  outgoingLinks: boolean
  incomingLinks: boolean
  neighborLinks: boolean
}

export type AppUpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export interface AppUpdateStatus {
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  downloadPercent: number | null
  message: string | null
}

export interface WikiLinkOccurrence {
  raw: string
  target: string
  alias: string | null
}

export type LinkStatus = 'resolved' | 'missing' | 'ambiguous' | 'invalid'

export interface ResolvedWikiLink {
  target: string
  alias: string | null
  status: LinkStatus
  resolvedPath?: string
  candidates: string[]
  reason?: string
}

export interface SearchResult {
  path: string
  name: string
  excerpt: string
  modifiedAt: number
  score: number
}

export interface GoogleAccount {
  sub: string
  name: string
  email: string
  picture: string | null
}

export type GoogleAuthorizedFeature = 'drive_sync' | 'calendar_read'

export interface GoogleDriveStatus {
  configured: boolean
  connected: boolean
  account: GoogleAccount | null
  authorizedFeatures: GoogleAuthorizedFeature[]
  lastSyncAt: string | null
  vaultFolderUrl: string | null
}

export interface DriveRemoteVault {
  rootFolderId: string
  vaultId: string
  name: string
}

export interface PairDriveVaultInput {
  rootFolderId: string
  vaultId: string
}

export type DriveSyncAction =
  | 'upload'
  | 'download'
  | 'move'
  | 'conflict'
  | 'preserve'

export interface DriveSyncPreviewItem {
  path: string
  oldPath?: string
  action: DriveSyncAction
  reason:
    | 'new_local'
    | 'new_remote'
    | 'local_changed'
    | 'remote_changed'
    | 'local_moved'
    | 'remote_moved'
    | 'both_changed'
    | 'both_new_different'
    | 'local_deleted'
    | 'remote_deleted'
}

export interface DriveSyncPreview {
  planId: string
  createdAt: string
  items: DriveSyncPreviewItem[]
  counts: {
    upload: number
    download: number
    move: number
    conflict: number
    preserve: number
  }
}

export interface DriveSyncApplyResult {
  uploaded: number
  downloaded: number
  moved: number
  conflicts: number
  preserved: number
  conflictPaths: string[]
  completedAt: string
}

export interface TsuzuneApi {
  chooseVault(): Promise<Result<VaultSnapshot | null>>
  openLastVault(): Promise<Result<VaultSnapshot | null>>
  getSettings(): Promise<Result<AppSettings>>
  getSnapshot(): Promise<Result<VaultSnapshot>>
  readNote(path: string): Promise<Result<NoteDocument>>
  readVaultImage(path: string): Promise<Result<string>>
  openVaultFile(path: string): Promise<Result<null>>
  revealVaultFile(path: string): Promise<Result<null>>
  openVaultFileWindow(path: string): Promise<Result<null>>
  copyText(text: string): Promise<Result<null>>
  saveNote(input: SaveNoteInput): Promise<Result<SaveNoteOutput>>
  createNote(input: CreateNoteInput): Promise<Result<EntryOperationOutput>>
  createDirectory(input: CreateDirectoryInput): Promise<Result<EntryOperationOutput>>
  renameEntry(input: RenameEntryInput): Promise<Result<EntryOperationOutput>>
  moveNote(input: MoveNoteInput): Promise<Result<EntryOperationOutput>>
  trashEntry(path: string): Promise<Result<EntryOperationOutput>>
  saveBookmark(input: SaveBookmarkInput): Promise<Result<VaultBookmark>>
  removeBookmark(path: string): Promise<Result<null>>
  setLastNote(path: string | null): Promise<Result<null>>
  setUserIgnoreFilters(filters: string[]): Promise<Result<null>>
  setGraphForces(settings: GraphForceSettings): Promise<Result<null>>
  setAiImmutablePaths(paths: string[]): Promise<Result<null>>
  setAiReviewPaths(paths: string[]): Promise<Result<null>>
  listAiReviewProposals(): Promise<Result<AiWriteReviewProposal[]>>
  approveAiReviewProposal(id: string): Promise<Result<EntryOperationOutput>>
  cancelAiReviewProposal(id: string): Promise<Result<null>>
  setGraphDisplay(settings: GraphDisplaySettings): Promise<Result<null>>
  setGraphFilters(settings: GraphFilterSettings): Promise<Result<null>>
  setGraphGroups(groups: GraphGroup[]): Promise<Result<null>>
  setGraphViewState(
    scope: GraphViewScope,
    state: GraphViewState
  ): Promise<Result<null>>
  chooseGoogleOAuthConfig(): Promise<Result<GoogleDriveStatus | null>>
  getGoogleDriveStatus(): Promise<Result<GoogleDriveStatus>>
  connectGoogle(): Promise<Result<GoogleDriveStatus>>
  authorizeGoogleCalendar(): Promise<Result<GoogleDriveStatus>>
  disconnectGoogle(): Promise<Result<GoogleDriveStatus>>
  listDriveVaults(): Promise<Result<DriveRemoteVault[]>>
  pairDriveVault(input: PairDriveVaultInput): Promise<Result<GoogleDriveStatus>>
  previewDriveSync(): Promise<Result<DriveSyncPreview>>
  applyDriveSync(planId: string): Promise<Result<DriveSyncApplyResult>>
  getUpdateStatus(): Promise<Result<AppUpdateStatus>>
  checkForUpdates(): Promise<Result<AppUpdateStatus>>
  downloadUpdate(): Promise<Result<AppUpdateStatus>>
  installUpdate(): Promise<Result<null>>
  openExternal(url: string): Promise<Result<null>>
  confirmClose(allow: boolean): void
  onVaultChanged(callback: (event: VaultChangeEvent) => void): () => void
  onRequestClose(callback: () => void): () => void
  onUpdateStatus(callback: (status: AppUpdateStatus) => void): () => void
}
