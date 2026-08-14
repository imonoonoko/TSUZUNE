import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { DriveSyncApplyResult, DriveSyncPreview } from '../shared/types'
import { defaultSettingsPath } from './vault-source'

interface BridgeState {
  version: 1
  origin: string
  token: string
}

export function defaultDriveSyncStatePath(settingsPath?: string): string {
  return join(dirname(settingsPath || defaultSettingsPath()), 'mcp-drive-sync.json')
}

export class DriveSyncMcpClient {
  constructor(private readonly statePath: string) {}

  preview(): Promise<DriveSyncPreview> {
    return this.request('/preview')
  }

  apply(planId: string): Promise<DriveSyncApplyResult> {
    return this.request('/apply', { planId })
  }

  private async request<T>(path: string, body?: object): Promise<T> {
    let state: Partial<BridgeState>
    try {
      state = JSON.parse(await readFile(this.statePath, 'utf8')) as Partial<BridgeState>
    } catch {
      throw new Error('Drive同期にはTSUZUNE本体を起動してください。')
    }
    let url: URL
    try {
      url = new URL(state.origin ?? '')
    } catch {
      throw new Error('Drive同期MCPの接続情報が不正です。')
    }
    if (
      state.version !== 1 ||
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      !url.port ||
      typeof state.token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(state.token)
    ) {
      throw new Error('Drive同期MCPの接続情報が不正です。')
    }

    let response: Response
    try {
      response = await fetch(new URL(path, url), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${state.token}`,
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      })
    } catch {
      throw new Error('Drive同期にはTSUZUNE本体を起動してください。')
    }
    const payload = (await response.json()) as T & { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Drive同期に失敗しました。')
    return payload
  }
}
