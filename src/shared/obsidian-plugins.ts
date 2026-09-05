export type ObsidianPluginCandidateStatus = 'detected' | 'incomplete' | 'invalid'

export interface ObsidianPluginCandidate {
  id: string
  name: string
  version: string
  description: string
  author: string
  minAppVersion: string
  isDesktopOnly: boolean
  hasMain: boolean
  hasStyles: boolean
  status: ObsidianPluginCandidateStatus
  reason: string | null
}
