import { createHmac, randomBytes } from 'node:crypto'
import { lstat, open, stat } from 'node:fs/promises'
import { mediaMimeType } from '../shared/attachments'
import { VaultError, type VaultService } from './vault'

export const MEDIA_SCHEME = 'tsuzune-media'
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

function byteRange(value: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2]) || size === 0) return null
  const first = Number(match[1]), last = Number(match[2])
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null
  if (!match[1]) return last > 0 ? [Math.max(0, size - last), size - 1] : null
  const end = match[2] ? Math.min(last, size - 1) : size - 1
  return first <= end ? [first, end] : null
}

/** Process-local capabilities come only from trusted IPC, never from note markup. */
export class VaultMedia {
  private readonly secret = randomBytes(32)
  constructor(private readonly vault: VaultService) {}

  private sign(query: string): string {
    return createHmac('sha256', this.secret).update(query).digest('hex')
  }

  private async checkRoot(): Promise<void> {
    const root = this.vault.getRootPath()
    if (!root || (await lstat(root)).isSymbolicLink()) throw new Error('Vault unavailable')
  }

  async getUrl(path: string, expectedVaultPath?: string): Promise<string> {
    if (typeof path !== 'string' || !mediaMimeType(path)) {
      throw new VaultError({ code: 'INVALID_PATH', message: '対応する音声・動画だけを再生できます。' })
    }
    const root = this.vault.getRootPath()
    if (expectedVaultPath !== undefined && (!root || root !== expectedVaultPath)) {
      throw new VaultError({ code: 'FILE_CHANGED', message: '別のVaultが開かれています。' })
    }
    const generation = this.vault.getRootRevision()
    await this.checkRoot()
    const absolute = await this.vault.resolveFileForOpen(path)
    const info = await stat(absolute)
    if (!info.isFile() || generation !== this.vault.getRootRevision()) {
      throw new VaultError({ code: 'FILE_CHANGED', message: 'Vaultが切り替わったため、再生を中止しました。' })
    }
    const query = new URLSearchParams({ path, generation: String(generation), size: String(info.size), modified: String(info.mtimeMs) }).toString()
    return `${MEDIA_SCHEME}://vault/${this.sign(query)}?${query}`
  }

  async handle(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
    try {
      const url = new URL(request.url)
      const path = url.searchParams.get('path') ?? ''
      const mime = mediaMimeType(path)
      const generation = url.searchParams.get('generation')
      const size = Number(url.searchParams.get('size'))
      const modified = Number(url.searchParams.get('modified'))
      const current = (): boolean => generation === String(this.vault.getRootRevision()) && this.vault.getRootPath() !== null
      if (url.protocol !== `${MEDIA_SCHEME}:` || url.host !== 'vault' || url.username || url.password || url.hash ||
          url.pathname !== `/${this.sign(url.search.slice(1))}` || !mime || !current() || !Number.isSafeInteger(size) || size < 0) {
        return new Response(null, { status: 404, headers })
      }
      await this.checkRoot()
      const absolute = await this.vault.resolveFileForOpen(path)
      const file = await open(absolute, 'r')
      let closed = false
      let abort: (() => void) | undefined
      const close = async (): Promise<void> => {
        if (abort) request.signal.removeEventListener('abort', abort)
        if (!closed) { closed = true; await file.close() }
      }
      try {
        const info = await file.stat()
        if (!current() || !info.isFile() || info.size !== size || info.mtimeMs !== modified) throw new Error('Media changed')
        const rangeHeader = request.method === 'GET' ? request.headers.get('Range') : null
        const range = rangeHeader === null ? [0, size - 1] : byteRange(rangeHeader, size)
        if (!range) {
          await close()
          return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
        }
        const [start, end] = range
        const responseHeaders: Record<string, string> = { ...headers, 'Content-Type': mime, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' }
        if (rangeHeader !== null) responseHeaders['Content-Range'] = `bytes ${start}-${end}/${size}`
        if (request.method === 'HEAD') { await close(); return new Response(null, { headers: responseHeaders }) }
        let position = start
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            abort = () => { void close(); controller.error(new Error('Media request aborted')) }
            request.signal.addEventListener('abort', abort, { once: true })
            if (request.signal.aborted) abort()
          },
          async pull(controller) {
            try {
              if (!current() || request.signal.aborted) throw new Error('Vault changed')
              const latest = await file.stat()
              if (latest.size !== size || latest.mtimeMs !== modified) throw new Error('Media changed')
              if (position > end) { await close(); controller.close(); return }
              const chunk = new Uint8Array(Math.min(64 * 1024, end - position + 1))
              const { bytesRead } = await file.read(chunk, 0, chunk.length, position)
              const afterRead = await file.stat()
              if (!bytesRead || !current() || request.signal.aborted || afterRead.size !== size || afterRead.mtimeMs !== modified) throw new Error('Media changed')
              position += bytesRead
              controller.enqueue(chunk.subarray(0, bytesRead))
            } catch (error) { await close(); controller.error(error) }
          },
          cancel: close
        })
        return new Response(body, { status: rangeHeader === null ? 200 : 206, headers: responseHeaders })
      } catch (error) { await close(); throw error }
    } catch { return new Response(null, { status: 404, headers }) }
  }
}
