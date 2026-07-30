import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  CreateDirectoryInput,
  CreateNoteInput,
  DriveRemoteVault,
  DriveSyncApplyResult,
  DriveSyncPreview,
  EntryOperationOutput,
  GoogleDriveStatus,
  MoveNoteInput,
  NoteDocument,
  PairDriveVaultInput,
  RenameEntryInput,
  Result,
  SaveNoteInput,
  SaveNoteOutput,
  TsuzuneApi,
  VaultChangeEvent,
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
  setLastNote: (path: string | null) =>
    invoke<null>('settings:setLastNote', path),
  chooseGoogleOAuthConfig: () =>
    invoke<GoogleDriveStatus | null>('google:chooseConfig'),
  getGoogleDriveStatus: () =>
    invoke<GoogleDriveStatus>('google:status'),
  connectGoogle: () =>
    invoke<GoogleDriveStatus>('google:connect'),
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
  }
}

contextBridge.exposeInMainWorld('tsuzune', api)
