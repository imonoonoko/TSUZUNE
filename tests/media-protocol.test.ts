import { mkdtemp, writeFile, rm, open, mkdir, rename, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VaultService } from '../src/main/vault'
import { VaultMedia } from '../src/main/media-protocol'
import { mediaMimeType } from '../src/shared/attachments'

let root: string, vault: VaultService, media: VaultMedia
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-media-test-'))
  vault = new VaultService()
  await vault.setRootPath(root)
  media = new VaultMedia(vault)
})
afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })

describe('Vault media delivery', () => {
  it('serves a local audio file through a scoped URL with the exact bytes', async () => {
    await writeFile(join(root, '音声 One.wav'), 'RIFF0123456789')
    const url = await media.getUrl('音声 One.wav')
    expect(url).toMatch(/^tsuzune-media:\/\/vault\//)
    expect(url).not.toContain(root)
    const response = await media.handle(new Request(url))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(await response.text()).toBe('RIFF0123456789')
  })

  it.each([
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-99', '89', 'bytes 8-9/10']
  ])('serves a seek request %s', async (range, body, contentRange) => {
    await writeFile(join(root, 'clip.mp4'), '0123456789')
    const response = await media.handle(new Request(await media.getUrl('clip.mp4'), { headers: { Range: range } }))
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe(contentRange)
    expect(response.headers.get('Content-Length')).toBe(String(body.length))
    expect(await response.text()).toBe(body)
  })

  it.each(['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=x-y', 'items=0-1'])('rejects an invalid range %s', async (range) => {
    await writeFile(join(root, 'clip.webm'), '0123456789')
    const response = await media.handle(new Request(await media.getUrl('clip.webm'), { headers: { Range: range } }))
    expect(response.status).toBe(416)
    expect(response.headers.get('Content-Range')).toBe('bytes */10')
    expect(await response.text()).toBe('')
  })

  it('answers HEAD without opening a stream and rejects writes', async () => {
    await writeFile(join(root, 'audio.wav'), '12345')
    const url = await media.getUrl('audio.wav')
    const response = await media.handle(new Request(url, { method: 'HEAD' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Length')).toBe('5')
    expect(await response.text()).toBe('')
    expect((await media.handle(new Request(url, { method: 'POST' }))).status).toBe(405)
  })

  it('rejects forged, modified and previous-Vault URLs', async () => {
    await writeFile(join(root, 'audio.wav'), '12345')
    const url = await media.getUrl('audio.wav')
    expect((await media.handle(new Request(url.replace('audio.wav', 'other.wav')))).status).toBe(404)
    await writeFile(join(root, 'audio.wav'), 'changed')
    expect((await media.handle(new Request(url))).status).toBe(404)
    const newUrl = await media.getUrl('audio.wav')
    vault.clearRootPath()
    expect((await media.handle(new Request(newUrl))).status).toBe(404)
  })

  it('does not issue URLs for non-media or paths outside the Vault', async () => {
    for (const path of ['../outside.wav', 'C:/outside.wav', 'https://example.com/a.mp4', 'note.md', 'mp3', 'toString']) {
      await expect(media.getUrl(path)).rejects.toThrow()
    }
    expect(mediaMimeType('mp3')).toBeNull()
    expect(mediaMimeType('a.toString')).toBeNull()
    expect(mediaMimeType('A.MP3')).toBe('audio/mpeg')
  })

  it('reads a small range from a large file and closes a cancelled stream', async () => {
    const file = await open(join(root, 'large.mp4'), 'w')
    await file.truncate(512 * 1024 * 1024)
    await file.write('END', 512 * 1024 * 1024 - 3)
    await file.close()
    const url = await media.getUrl('large.mp4')
    const response = await media.handle(new Request(url, { headers: { Range: 'bytes=-3' } }))
    expect(response.status).toBe(206)
    expect(await response.text()).toBe('END')
    const full = await media.handle(new Request(url))
    const reader = full.body!.getReader()
    expect((await reader.read()).value!.length).toBeLessThanOrEqual(64 * 1024)
    await reader.cancel()
    await rm(join(root, 'large.mp4'))
  })

  it('rejects child junctions and a Vault root replaced by a junction', async () => {
    await mkdir(join(root, 'vault')); await mkdir(join(root, 'outside'))
    await writeFile(join(root, 'vault', 'a.wav'), 'local')
    await writeFile(join(root, 'outside', 'a.wav'), 'other')
    await vault.setRootPath(join(root, 'vault'))
    const url = await media.getUrl('a.wav')
    await symlink(join(root, 'outside'), join(root, 'vault', 'alias'), 'junction')
    await expect(media.getUrl('alias/a.wav')).rejects.toThrow()
    await rename(join(root, 'vault'), join(root, 'before'))
    await symlink(join(root, 'outside'), join(root, 'vault'), 'junction')
    await expect(media.getUrl('a.wav')).rejects.toThrow()
    expect((await media.handle(new Request(url))).status).toBe(404)
  })

  it('rejects issuance when the Vault changes during path resolution', async () => {
    await writeFile(join(root, 'a.wav'), 'audio')
    const resolveFile = vault.resolveFileForOpen.bind(vault)
    vi.spyOn(vault, 'resolveFileForOpen').mockImplementation(async path => {
      const file = await resolveFile(path)
      vault.clearRootPath()
      return file
    })
    await expect(media.getUrl('a.wav')).rejects.toThrow()
  })

  it.each(['abort', 'vault', 'file'])('stops an in-progress stream after %s changes', async change => {
    await writeFile(join(root, 'a.wav'), Buffer.alloc(1024 * 1024))
    const abort = new AbortController()
    const response = await media.handle(new Request(await media.getUrl('a.wav'), { signal: abort.signal }))
    const reader = response.body!.getReader()
    await reader.read()
    if (change === 'abort') abort.abort()
    else if (change === 'vault') vault.clearRootPath()
    else await writeFile(join(root, 'a.wav'), 'replaced')
    await expect((async () => { while (!(await reader.read()).done) { /* drain to the invalidated read */ } })()).rejects.toThrow()
    await reader.cancel().catch(() => {})
  })
})

it('rejects a stale pane requesting the same relative media path in a different Vault', async () => {
  const nextVault = join(root, 'next')
  await mkdir(nextVault)
  await writeFile(join(nextVault, 'same.wav'), 'other Vault')
  await vault.setRootPath(nextVault)
  await expect(media.getUrl('same.wav', root)).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
  const response = await media.handle(new Request(await media.getUrl('same.wav', nextVault)))
  expect(await response.text()).toBe('other Vault')
})
