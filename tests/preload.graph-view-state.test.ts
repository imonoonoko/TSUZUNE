import { describe, expect, it, vi } from 'vitest'
import type { TsuzuneApi } from '../src/shared/types'

const electron = vi.hoisted(() => ({
  api: null as TsuzuneApi | null,
  invoke: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name: string, api: TsuzuneApi) => {
      electron.api = api
    }
  },
  ipcRenderer: {
    invoke: electron.invoke,
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

describe('graph view state preload API', () => {
  it('forwards the scope and state to the trusted IPC channel', async () => {
    electron.invoke.mockResolvedValue({ ok: true, value: null })
    await import('../src/preload/index')
    const state = {
      scale: 0.5,
      query: 'tag:#project',
      settingsOpen: true,
      settingsSections: {
        filters: true,
        groups: false,
        display: false,
        forces: true
      }
    }

    await electron.api!.setGraphViewState('vault', state)

    expect(electron.invoke).toHaveBeenCalledWith(
      'settings:setGraphViewState',
      'vault',
      state
    )
  })

  it('reads a trusted Vault image through its dedicated IPC channel', async () => {
    electron.invoke.mockResolvedValue({
      ok: true,
      value: 'data:image/png;base64,iVBORw0KGgo='
    })
    await import('../src/preload/index')

    await electron.api!.readVaultImage('attachments/diagram.png')

    expect(electron.invoke).toHaveBeenCalledWith(
      'vault:readImage',
      'attachments/diagram.png'
    )
  })

  it('requests an internal Vault attachment window through trusted IPC', async () => {
    electron.invoke.mockResolvedValue({ ok: true, value: null })
    await import('../src/preload/index')

    await electron.api!.openVaultFileWindow('attachments/diagram.png')

    expect(electron.invoke).toHaveBeenCalledWith(
      'system:openVaultFileWindow',
      'attachments/diagram.png'
    )
  })
})
