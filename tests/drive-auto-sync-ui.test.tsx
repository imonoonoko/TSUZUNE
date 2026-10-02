// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DriveAutoSyncSettings from '../src/renderer/components/DriveAutoSyncSettings'
import type { DriveAutoSyncStatus } from '../src/shared/drive-auto-sync'

afterEach(() => cleanup())
function setup() {
  const status: DriveAutoSyncStatus = { rootPath: 'C:/Vault', enabled: false, state: 'off', lastCheckedAt: null,
    lastSyncAt: null, message: '自動同期はオフです。', conflictPaths: [] }
  let listener!: (status: DriveAutoSyncStatus) => void
  const unsubscribe = vi.fn()
  const api = { getDriveAutoSyncStatus: vi.fn().mockResolvedValue({ ok: true, value: status }),
    setDriveAutoSyncEnabled: vi.fn().mockResolvedValue({ ok: true, value: { ...status, enabled: true, state: 'waiting' } }),
    onDriveAutoSyncStatus: (callback: typeof listener) => { listener = callback; return unsubscribe } }
  Object.defineProperty(window, 'tsuzune', { configurable: true, value: api })
  return { api, status, unsubscribe, emit: (value: DriveAutoSyncStatus) => listener(value) }
}

describe('automatic sync settings', () => {
  it('flushes editing before opting in and reflects background conflicts for only this Vault', async () => {
    const { api, status, emit, unsubscribe } = setup()
    const beforeEnable = vi.fn().mockResolvedValue(true)
    const view = render(<DriveAutoSyncSettings rootPath="C:/Vault" disabled={false} beforeEnable={beforeEnable} />)
    const checkbox = screen.getByRole('checkbox', { name: 'このVaultを自動同期する' }) as HTMLInputElement
    await waitFor(() => expect(checkbox.disabled).toBe(false))
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    await waitFor(() => expect(api.setDriveAutoSyncEnabled).toHaveBeenCalledWith(true))
    expect(beforeEnable).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(checkbox.checked).toBe(true))
    act(() => emit({ ...status, rootPath: 'C:/Other', message: '別Vaultの状態' }))
    expect(screen.queryByText('別Vaultの状態')).toBeNull()
    act(() => emit({ ...status, enabled: true, state: 'conflict', message: '競合を解決してください。', conflictPaths: ['A.md'] }))
    expect(screen.getByRole('status').textContent).toContain('競合')
    expect(screen.getByText('A.md')).toBeTruthy()
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not enable synchronization if saving fails', async () => {
    const { api } = setup()
    render(<DriveAutoSyncSettings rootPath="C:/Vault" disabled={false} beforeEnable={async () => false} />)
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    await waitFor(() => expect(checkbox.disabled).toBe(false))
    fireEvent.click(checkbox)
    await screen.findByRole('alert')
    expect(api.setDriveAutoSyncEnabled).not.toHaveBeenCalled()
    expect(checkbox.checked).toBe(false)
  })
})
