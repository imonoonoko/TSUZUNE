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
  size: number
}

export interface VaultSnapshot {
  rootPath: string
  rootName: string
  directories: string[]
  notes: NoteDocument[]
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

export interface TsuzuneApi {
  chooseVault(): Promise<Result<VaultSnapshot | null>>
  openLastVault(): Promise<Result<VaultSnapshot | null>>
  getSettings(): Promise<Result<AppSettings>>
  getSnapshot(): Promise<Result<VaultSnapshot>>
  readNote(path: string): Promise<Result<NoteDocument>>
  saveNote(input: SaveNoteInput): Promise<Result<SaveNoteOutput>>
  createNote(input: CreateNoteInput): Promise<Result<EntryOperationOutput>>
  createDirectory(input: CreateDirectoryInput): Promise<Result<EntryOperationOutput>>
  renameEntry(input: RenameEntryInput): Promise<Result<EntryOperationOutput>>
  moveNote(input: MoveNoteInput): Promise<Result<EntryOperationOutput>>
  trashEntry(path: string): Promise<Result<EntryOperationOutput>>
  setLastNote(path: string | null): Promise<Result<null>>
  openExternal(url: string): Promise<Result<null>>
  confirmClose(allow: boolean): void
  onVaultChanged(callback: (event: VaultChangeEvent) => void): () => void
  onRequestClose(callback: () => void): () => void
}
