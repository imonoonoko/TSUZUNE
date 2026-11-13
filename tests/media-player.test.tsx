// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MediaPlayer from '../src/renderer/components/MediaPlayer'

const attachments = ['assets/音声 One.wav', 'assets/movie.webm'].map(path => ({ path, name: path, size: 10, createdAt: 1, modifiedAt: 1 }))
const getVaultMediaUrl = vi.fn(async (path: string, _expectedVaultPath?: string) => ({ ok: true, value: `tsuzune-media://vault/mock?${encodeURIComponent(path)}` }))
const openVaultFile = vi.fn(async () => ({ ok: true, value: null }))
beforeEach(() => {
  vi.stubGlobal('tsuzune', { getVaultMediaUrl, openVaultFile })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })


it('uses the caller navigation guard for failures and keeps it disabled during another edit', async () => {
  const guardedOpen = vi.fn()
  const { container, rerender } = render(<MediaPlayer path="assets/音声 One.wav" label="Audio" onOpenExternally={guardedOpen} openDisabled />)
  await waitFor(() => expect(container.querySelector('audio[src]')).toBeTruthy())
  fireEvent.error(container.querySelector('audio')!)
  const button = screen.getByRole('button', { name: '既定のアプリで開く' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button); expect(guardedOpen).not.toHaveBeenCalled(); expect(openVaultFile).not.toHaveBeenCalled()
  rerender(<MediaPlayer path="assets/音声 One.wav" label="Audio" onOpenExternally={guardedOpen} />)
  fireEvent.click(button); expect(guardedOpen).toHaveBeenCalledOnce(); expect(openVaultFile).not.toHaveBeenCalled()
})

it('reports URL failures and ignores a URL that resolves after the player is released', async () => {
  getVaultMediaUrl.mockRejectedValueOnce(new Error('unavailable'))
  const failed = render(<MediaPlayer path="assets/音声 One.wav" label="Audio" />)
  await screen.findByText('ファイルを読み込めません。')
  failed.unmount()
  let resolve!: (value: { ok: boolean; value: string }) => void
  getVaultMediaUrl.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const view = render(<MediaPlayer path="assets/音声 One.wav" label="Audio" />)
  const player = view.container.querySelector('audio')!
  view.unmount()
  await act(async () => { resolve({ ok: true, value: 'tsuzune-media://vault/late' }) })
  expect(player.getAttribute('src')).toBeNull()
})
it('releases the old player and requests scoped media when the Vault changes', async () => {
  const path = 'assets/movie.webm'
  const { container, rerender } = render(<MediaPlayer path={path} label="Video" expectedVaultPath="C:/Vault A" />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  const first = container.querySelector('video')!
  expect(getVaultMediaUrl).toHaveBeenCalledWith(path, 'C:/Vault A')

  rerender(<MediaPlayer path={path} label="Video" expectedVaultPath="C:/Vault B" />)
  await waitFor(() => expect(getVaultMediaUrl).toHaveBeenCalledWith(path, 'C:/Vault B'))
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce()
  expect(first.getAttribute('src')).toBeNull()
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  expect(container.querySelector('video')).not.toBe(first)
})

it('keeps the external fallback scoped to the displayed Vault', async () => {
  const path = 'assets/movie.webm'
  const scope = 'C:/Vault'
  const { container } = render(<MediaPlayer path={path} label="Video" expectedVaultPath={scope} />)
  await waitFor(() => expect(container.querySelector('video[src]')).toBeTruthy())
  fireEvent.error(container.querySelector('video')!)
  expect(openVaultFile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '既定のアプリで開く' }))
  expect(openVaultFile).toHaveBeenCalledExactlyOnceWith(path, scope)
})
