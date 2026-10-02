import type { WorkspaceScope } from './workspace-state'

export const MAX_PASTED_IMAGE_BYTES = 20 * 1024 * 1024

export interface PasteImageInput {
  scope: WorkspaceScope
  notePath: string
  bytes: Uint8Array
}
