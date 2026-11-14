import type { PropertyChangeScope } from './property-changes'
import type { VaultSnapshot } from './types'
import { validateEntryName } from '../core/paths'

export type ImportFormat = 'markdown' | 'chatgpt' | 'notion' | 'enex'
export interface ImportFile { path: string; bytes: Uint8Array }
export interface ImportReadRequest { scope: PropertyChangeScope; format: ImportFormat; kind: 'folder' | 'file' }
export interface ImportSource { token: string; format: ImportFormat; sourceName: string; files: ImportFile[]; warnings: string[] }
export interface ImportDraft { files: ImportFile[]; warnings: string[] }
export interface ImportPreviewInput { scope: PropertyChangeScope; sourceToken: string; destinationName: string; files: ImportFile[]; warnings: string[] }
export interface ImportPreview { planId: string; folder: string; format: ImportFormat; sourceName: string; fileCount: number; noteCount: number; totalBytes: number; paths: string[]; warnings: string[]; duplicateFolder: string | null; conflicts: string[] }
export interface ImportApplyResult { folder: string; fileCount: number; noteCount: number; snapshot: VaultSnapshot }
export interface ImportSelectedFile { path: string; relativePath: string }
export const IMPORT_MAX_FILES = 5000
export const IMPORT_MAX_FILE_BYTES = 128 * 1024 * 1024
export const IMPORT_MAX_TOTAL_BYTES = 256 * 1024 * 1024

export function safeImportPath(path: string): boolean {
  return typeof path === 'string' && path.length > 0 && path.length <= 240 && !path.includes('\\') &&
    path.split('/').every(part => validateEntryName(part).valid && !/^(com|lpt)[¹²³](?:\.|$)/i.test(part))
}

export function hasImportCaseCollision(paths: readonly string[]): boolean {
  const spellings = new Map<string, string>()
  for (const path of paths) {
    const parts = path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/'), key = prefix.toLowerCase()
      if (spellings.has(key) && spellings.get(key) !== prefix) return true
      spellings.set(key, prefix)
    }
  }
  return false
}
