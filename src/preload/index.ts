import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  AppUpdateStatus,
  CreateDirectoryInput,
  CreateNoteInput,
  DriveRemoteVault,
  DriveSyncApplyResult,
  DriveSyncPreview,
  EntryOperationOutput,
  GoogleDriveStatus,
  GraphDisplaySettings,
  GraphFilterSettings,
  GraphGroup,
  GraphForceSettings,
  GraphViewScope,
  GraphViewState,
  MoveNoteInput,
  NoteDocument,
  PairDriveVaultInput,
  RenameEntryInput,
  Result,
  SaveBookmarkInput,
  SaveNoteInput,
  SaveNoteOutput,
  TsuzuneApi,
  VaultChangeEvent,
  VaultBookmark,
  VaultSnapshot
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<Result<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api: TsuzuneApi = {
  chooseVault: () => invoke<VaultSnapshot | null>('vault:choose'),
  openLastVault: () => invoke<VaultSnapshot | null>('vault:openLast'),
  getSettings: () => invoke<AppSettings>('settings:get'),
  getSnapshot: () => invoke<VaultSnapshot>('vault:snapshot'),
  readNote: (path: string) => invoke<NoteDocument>('vault:readNote', path),
  readVaultImage: (path: string) => invoke<string>('vault:readImage', path),
  openVaultFile: (path: string) => invoke<null>('system:openVaultFile', path),
  revealVaultFile: (path: string) =>
    invoke<null>('system:revealVaultFile', path),
  openVaultFileWindow: (path: string) =>
    invoke<null>('system:openVaultFileWindow', path),
  copyText: (text: string) => invoke<null>('system:copyText', text),
  saveNote: (input: SaveNoteInput) => invoke<SaveNoteOutput>('note:save', input),
  createNote: (input: CreateNoteInput) =>
    invoke<EntryOperationOutput>('entry:createNote', input),
  createDirectory: (input: CreateDirectoryInput) =>
    invoke<EntryOperationOutput>('entry:createDirectory', input),
  renameEntry: (input: RenameEntryInput) =>
    invoke<EntryOperationOutput>('entry:rename', input),
  moveNote: (input: MoveNoteInput) =>
    invoke<EntryOperationOutput>('entry:moveNote', input),
  trashEntry: (path: string) => invoke<EntryOperationOutput>('entry:trash', path),
  saveBookmark: (input: SaveBookmarkInput) =>
    invoke<VaultBookmark>('bookmark:save', input),
  removeBookmark: (path: string) => invoke<null>('bookmark:remove', path),
  setLastNote: (path: string | null) =>
    invoke<null>('settings:setLastNote', path),
  setUserIgnoreFilters: (filters: string[]) =>
    invoke<null>('settings:setUserIgnoreFilters', filters),
  setGraphForces: (settings: GraphForceSettings) =>
    invoke<null>('settings:setGraphForces', settings),
  setGraphDisplay: (settings: GraphDisplaySettings) =>
    invoke<null>('settings:setGraphDisplay', settings),
  setGraphFilters: (settings: GraphFilterSettings) =>
    invoke<null>('settings:setGraphFilters', settings),
  setGraphGroups: (groups: GraphGroup[]) =>
    invoke<null>('settings:setGraphGroups', groups),
  setGraphViewState: (scope: GraphViewScope, state: GraphViewState) =>
    invoke<null>('settings:setGraphViewState', scope, state),
  chooseGoogleOAuthConfig: () =>
    invoke<GoogleDriveStatus | null>('google:chooseConfig'),
  getGoogleDriveStatus: () =>
    invoke<GoogleDriveStatus>('google:status'),
  connectGoogle: () =>
    invoke<GoogleDriveStatus>('google:connect'),
  authorizeGoogleCalendar: () =>
    invoke<GoogleDriveStatus>('google:authorizeCalendar'),
  disconnectGoogle: () =>
    invoke<GoogleDriveStatus>('google:disconnect'),
  listDriveVaults: () =>
    invoke<DriveRemoteVault[]>('drive:listVaults'),
  pairDriveVault: (input: PairDriveVaultInput) =>
    invoke<GoogleDriveStatus>('drive:pairVault', input),
  previewDriveSync: () =>
    invoke<DriveSyncPreview>('drive:preview'),
  applyDriveSync: (planId: string) =>
    invoke<DriveSyncApplyResult>('drive:apply', planId),
  getUpdateStatus: () => invoke<AppUpdateStatus>('app:updateStatus'),
  checkForUpdates: () => invoke<AppUpdateStatus>('app:updateCheck'),
  downloadUpdate: () => invoke<AppUpdateStatus>('app:updateDownload'),
  installUpdate: () => invoke<null>('app:updateInstall'),
  openExternal: (url: string) => invoke<null>('system:openExternal', url),
  confirmClose: (allow: boolean) => ipcRenderer.send('app:confirmClose', allow),
  onVaultChanged: (callback: (event: VaultChangeEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, change: VaultChangeEvent): void =>
      callback(change)
    ipcRenderer.on('vault:changed', listener)
    return () => ipcRenderer.removeListener('vault:changed', listener)
  },
  onRequestClose: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:requestClose', listener)
    return () => ipcRenderer.removeListener('app:requestClose', listener)
  },
  onUpdateStatus: (callback: (status: AppUpdateStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: AppUpdateStatus
    ): void => callback(status)
    ipcRenderer.on('app:updateStatusChanged', listener)
    return () => ipcRenderer.removeListener('app:updateStatusChanged', listener)
  }
}

contextBridge.exposeInMainWorld('tsuzune', api)
