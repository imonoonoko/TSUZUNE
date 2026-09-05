import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import {
  BrowserClipValidationError,
  parseBrowserClipPayload,
  type BrowserClipCaptureResult,
  type BrowserClipPayload
} from './browser-clip'
import { VaultError } from './vault'

export const BROWSER_CLIPPER_PORT = 27_193
export const BROWSER_CLIPPER_EXTENSION_ID = 'jlmegmmpabknbfhfcbnakpkmhfoeablh'
export const BROWSER_CLIPPER_ORIGIN =
  `chrome-extension://${BROWSER_CLIPPER_EXTENSION_ID}` as const
const MAX_REQUEST_BYTES = 8 * 1024 * 1024
const PAIRING_WINDOW_MS = 5 * 60 * 1000
const MAX_PAIRING_ATTEMPTS = 5
const MAX_IDEMPOTENCY_ENTRIES = 100

export interface BrowserClipTokenStore {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export interface BrowserClipBridgeOptions {
  port?: number
  allowedOrigin?: string
  tokenStore: BrowserClipTokenStore
  capture(payload: BrowserClipPayload): Promise<BrowserClipCaptureResult>
  now?: () => number
}

export interface BrowserClipBridge {
  origin: string
  openPairingWindow(): { code: string; expiresAt: string }
  close(): Promise<void>
}

class PayloadTooLargeError extends Error {}

function responseHeaders(allowedOrigin: string): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
    'cache-control': 'no-store'
  }
}

function respond(
  response: ServerResponse,
  status: number,
  body: object,
  allowedOrigin?: string
): void {
  response.writeHead(status, allowedOrigin ? responseHeaders(allowedOrigin) : {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.toLocaleLowerCase().startsWith('application/json')) {
    throw new BrowserClipValidationError('Content-Typeはapplication/jsonを指定してください。')
  }
  const declaredLength = Number(request.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new PayloadTooLargeError('要求が大きすぎます。')
  }
  const chunks: Buffer[] = []
  let size = 0
  let oversized = false
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > MAX_REQUEST_BYTES) {
      oversized = true
      continue
    }
    chunks.push(buffer)
  }
  if (oversized) throw new PayloadTooLargeError('要求が大きすぎます。')
  let raw: string
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  } catch {
    throw new BrowserClipValidationError('要求はUTF-8で指定してください。')
  }
  try {
    return JSON.parse(raw || '{}') as unknown
  } catch {
    throw new BrowserClipValidationError('JSONの形式が不正です。')
  }
}

function tokenMatches(expected: string | null, supplied: string | undefined): boolean {
  if (!expected || !supplied || !/^[a-f0-9]{64}$/.test(supplied)) return false
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(supplied, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

function bearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
}

function errorStatus(error: unknown): number {
  if (error instanceof PayloadTooLargeError) return 413
  if (error instanceof BrowserClipValidationError) return 400
  if (error instanceof VaultError) {
    if (error.appError.code === 'NO_VAULT' || error.appError.code === 'NOT_FOUND') return 503
    if (error.appError.code === 'ALREADY_EXISTS') return 409
    if (error.appError.code === 'ACCESS_DENIED') return 403
    return 400
  }
  return 500
}

export async function startBrowserClipBridge(
  options: BrowserClipBridgeOptions
): Promise<BrowserClipBridge> {
  const allowedOrigin = options.allowedOrigin ?? BROWSER_CLIPPER_ORIGIN
  const now = options.now ?? Date.now
  let pairedToken = await options.tokenStore.read()
  if (pairedToken !== null && !/^[a-f0-9]{64}$/.test(pairedToken)) {
    throw new Error('ブラウザクリップ認証の保存形式が不正です。')
  }
  let pairing: { code: string; expiresAt: number } | null = null
  let failedPairingAttempts = 0
  let boundPort = 0
  let activeCaptures = 0
  const completed = new Map<string, BrowserClipCaptureResult>()
  const inFlight = new Map<string, Promise<BrowserClipCaptureResult>>()

  const server = createServer(async (request, response) => {
    const expectedHost = `127.0.0.1:${boundPort}`
    if (request.headers.host !== expectedHost || request.headers.origin !== allowedOrigin) {
      respond(response, 403, { error: 'このクリップ要求元は許可されていません。' })
      return
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, responseHeaders(allowedOrigin))
      response.end()
      return
    }
    if (request.method !== 'POST') {
      respond(response, 405, { error: 'POSTだけを受け付けます。' }, allowedOrigin)
      return
    }

    try {
      if (request.url === '/pair') {
        const body = await readJson(request)
        const record =
          body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : null
        if (!record || Object.keys(record).some((key) => key !== 'code')) {
          throw new BrowserClipValidationError('接続コード要求の形式が不正です。')
        }
        const currentTime = now()
        const validPairing =
          pairing !== null &&
          pairing.expiresAt >= currentTime &&
          typeof record.code === 'string' &&
          /^\d{6}$/.test(record.code) &&
          record.code === pairing.code
        if (!validPairing) {
          if (pairing && pairing.expiresAt >= currentTime) {
            failedPairingAttempts += 1
            if (failedPairingAttempts >= MAX_PAIRING_ATTEMPTS) pairing = null
          } else {
            pairing = null
          }
          respond(response, 401, { error: '接続コードが無効か期限切れです。' }, allowedOrigin)
          return
        }
        const token = randomBytes(32).toString('hex')
        await options.tokenStore.write(token)
        pairedToken = token
        pairing = null
        failedPairingAttempts = 0
        respond(response, 200, { token }, allowedOrigin)
        return
      }

      if (request.url !== '/capture') {
        respond(response, 404, { error: 'クリップ操作が見つかりません。' }, allowedOrigin)
        return
      }
      if (!tokenMatches(pairedToken, bearerToken(request))) {
        respond(response, 401, { error: 'TSUZUNEとの接続が必要です。' }, allowedOrigin)
        return
      }
      const payload = parseBrowserClipPayload(await readJson(request))
      const previous = completed.get(payload.requestId)
      if (previous) {
        respond(response, 200, previous, allowedOrigin)
        return
      }
      let capturePromise = inFlight.get(payload.requestId)
      if (!capturePromise) {
        if (activeCaptures >= 2) {
          respond(response, 429, { error: '別のクリップ処理が完了してから再試行してください。' }, allowedOrigin)
          return
        }
        activeCaptures += 1
        capturePromise = Promise.resolve()
          .then(() => options.capture(payload))
          .then((result) => {
            completed.set(payload.requestId, result)
            if (completed.size > MAX_IDEMPOTENCY_ENTRIES) {
              const oldest = completed.keys().next().value as string | undefined
              if (oldest) completed.delete(oldest)
            }
            return result
          })
          .finally(() => {
            activeCaptures -= 1
            inFlight.delete(payload.requestId)
          })
        inFlight.set(payload.requestId, capturePromise)
      }
      respond(response, 200, await capturePromise, allowedOrigin)
    } catch (error) {
      respond(
        response,
        errorStatus(error),
        { error: error instanceof Error ? error.message : 'クリップを保存できませんでした。' },
        allowedOrigin
      )
    }
  })
  server.requestTimeout = 10_000
  server.headersTimeout = 10_000

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? BROWSER_CLIPPER_PORT, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('ブラウザクリップの待受を開始できませんでした。')
  }
  boundPort = address.port

  return {
    origin: `http://127.0.0.1:${boundPort}`,
    openPairingWindow(): { code: string; expiresAt: string } {
      pairing = {
        code: String(randomInt(100_000, 1_000_000)),
        expiresAt: now() + PAIRING_WINDOW_MS
      }
      failedPairingAttempts = 0
      return { code: pairing.code, expiresAt: new Date(pairing.expiresAt).toISOString() }
    },
    async close(): Promise<void> {
      pairing = null
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
}
