import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  buildGoogleAuthorizationUrl,
  createPkcePair,
  validateOAuthCallback
} from './google-auth'

export interface GoogleOAuthLoopbackInput {
  clientId: string
  openExternal(url: string): Promise<void>
  timeoutMs?: number
}

export interface GoogleOAuthLoopbackResult {
  code: string
  codeVerifier: string
  redirectUri: string
}

export interface GoogleToken {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

export interface GoogleProfile {
  sub: string
  name: string
  email: string
  picture: string | null
}

export interface GoogleClientCredentials {
  clientId: string
  clientSecret: string | null
}

export interface AuthorizationCodeExchangeInput extends GoogleClientCredentials {
  code: string
  codeVerifier: string
  redirectUri: string
}

export interface RefreshTokenInput extends GoogleClientCredentials {
  refreshToken: string
}

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

function listen(server: Server): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Google認証のローカル受信口を開けませんでした。'))
        return
      }
      resolve(address)
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

export async function runGoogleOAuthLoopback(
  input: GoogleOAuthLoopbackInput
): Promise<GoogleOAuthLoopbackResult> {
  const state = randomBytes(32).toString('base64url')
  const pkce = await createPkcePair()
  let finish:
    | ((result: GoogleOAuthLoopbackResult) => void)
    | null = null
  let fail: ((error: Error) => void) | null = null

  const callbackResult = new Promise<GoogleOAuthLoopbackResult>(
    (resolve, reject) => {
      finish = resolve
      fail = reject
    }
  )

  let redirectUri = ''
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', redirectUri)
      if (url.pathname !== '/oauth2/callback') {
        response.writeHead(404).end()
        return
      }
      const code = validateOAuthCallback(url, state)
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
      })
      response.end(
        '<!doctype html><meta charset="utf-8"><title>TSUZUNE</title><style>body{font-family:sans-serif;padding:3rem;line-height:1.7}</style><h1>TSUZUNEに接続しました</h1><p>このタブを閉じてアプリへ戻ってください。</p>'
      )
      finish?.({
        code,
        codeVerifier: pkce.verifier,
        redirectUri
      })
    } catch (error) {
      response.writeHead(400, {
        'content-type': 'text/plain; charset=utf-8'
      })
      response.end('Google認証を完了できませんでした。')
      fail?.(error instanceof Error ? error : new Error('Google認証に失敗しました。'))
    }
  })

  const address = await listen(server)
  redirectUri = `http://127.0.0.1:${address.port}/oauth2/callback`
  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: input.clientId,
    redirectUri,
    state,
    codeChallenge: pkce.challenge
  })

  const timeout = setTimeout(() => {
    fail?.(new Error('Google認証がタイムアウトしました。'))
  }, input.timeoutMs ?? 180_000)

  try {
    await input.openExternal(authorizationUrl)
    return await callbackResult
  } finally {
    clearTimeout(timeout)
    await close(server)
  }
}

async function readJsonResponse(
  response: Response
): Promise<Record<string, unknown>> {
  let payload: Record<string, unknown>
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch {
    throw new Error(`Google APIが不正な応答を返しました (${response.status})。`)
  }
  if (!response.ok) {
    const description =
      typeof payload.error_description === 'string'
        ? payload.error_description
        : typeof payload.error === 'string'
          ? payload.error
          : `HTTP ${response.status}`
    throw new Error(`Google API: ${description}`)
  }
  return payload
}

function tokenFromPayload(
  payload: Record<string, unknown>,
  refreshToken: string | null
): GoogleToken {
  if (
    typeof payload.access_token !== 'string' ||
    typeof payload.expires_in !== 'number'
  ) {
    throw new Error('Google APIからアクセストークンを取得できませんでした。')
  }
  return {
    accessToken: payload.access_token,
    refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1_000
  }
}

export async function exchangeGoogleAuthorizationCode(
  input: AuthorizationCodeExchangeInput,
  fetchImpl: FetchLike = fetch
): Promise<GoogleToken> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri
  })
  if (input.clientSecret) {
    body.set('client_secret', input.clientSecret)
  }
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const payload = await readJsonResponse(response)
  return tokenFromPayload(
    payload,
    typeof payload.refresh_token === 'string' ? payload.refresh_token : null
  )
}

export async function refreshGoogleAccessToken(
  input: RefreshTokenInput,
  fetchImpl: FetchLike = fetch
): Promise<GoogleToken> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token'
  })
  if (input.clientSecret) {
    body.set('client_secret', input.clientSecret)
  }
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const payload = await readJsonResponse(response)
  return tokenFromPayload(payload, null)
}

export async function fetchGoogleProfile(
  accessToken: string,
  fetchImpl: FetchLike = fetch
): Promise<GoogleProfile> {
  const response = await fetchImpl(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  )
  const payload = await readJsonResponse(response)
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    throw new Error('Googleアカウント情報を確認できませんでした。')
  }
  return {
    sub: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: typeof payload.picture === 'string' ? payload.picture : null
  }
}
