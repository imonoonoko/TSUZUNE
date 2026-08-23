import { describe, expect, it, vi } from 'vitest'
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  refreshGoogleAccessToken,
  runGoogleOAuthLoopback
} from '../src/main/google-oauth-flow'
import {
  GOOGLE_CALENDAR_READ_SCOPE,
  GOOGLE_OAUTH_SCOPES
} from '../src/main/google-auth'

describe('Google OAuth loopback flow', () => {
  it('opens the system-browser URL and accepts one callback on 127.0.0.1', async () => {
    const opened: string[] = []

    const result = await runGoogleOAuthLoopback({
      clientId: 'desktop.apps.googleusercontent.com',
      timeoutMs: 2_000,
      openExternal: async (authorizationUrl) => {
        opened.push(authorizationUrl)
        const url = new URL(authorizationUrl)
        const callback = new URL(url.searchParams.get('redirect_uri') ?? '')
        callback.searchParams.set('code', 'authorization-code')
        callback.searchParams.set('state', url.searchParams.get('state') ?? '')
        await fetch(callback)
      }
    })

    const authorizationUrl = new URL(opened[0])
    expect(authorizationUrl.hostname).toBe('accounts.google.com')
    expect(new URL(result.redirectUri).hostname).toBe('127.0.0.1')
    expect(result.code).toBe('authorization-code')
    expect(result.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
  })

  it('passes an expanded installed-app scope set to the system browser', async () => {
    let openedUrl = ''
    const scopes = [...GOOGLE_OAUTH_SCOPES, GOOGLE_CALENDAR_READ_SCOPE]

    await runGoogleOAuthLoopback({
      clientId: 'desktop.apps.googleusercontent.com',
      scopes,
      timeoutMs: 2_000,
      openExternal: async (authorizationUrl) => {
        openedUrl = authorizationUrl
        const url = new URL(authorizationUrl)
        const callback = new URL(url.searchParams.get('redirect_uri') ?? '')
        callback.searchParams.set('code', 'authorization-code')
        callback.searchParams.set('state', url.searchParams.get('state') ?? '')
        await fetch(callback)
      }
    })

    expect(new URL(openedUrl).searchParams.get('scope')?.split(' ')).toEqual(
      scopes
    )
  })
})

describe('Google OAuth HTTP exchange', () => {
  it('exchanges a code using its PKCE verifier and reads the account profile', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fakeFetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      requests.push({ url: input.toString(), init })
      if (input.toString().includes('/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'openid email profile https://www.googleapis.com/auth/drive.file'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          sub: 'google-account-id',
          name: 'TSUZUNE User',
          email: 'user@example.com',
          picture: 'https://example.com/avatar.png'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const token = await exchangeGoogleAuthorizationCode(
      {
        clientId: 'desktop.apps.googleusercontent.com',
        clientSecret: null,
        code: 'authorization-code',
        codeVerifier: 'pkce-verifier',
        redirectUri: 'http://127.0.0.1:54321/oauth2/callback'
      },
      fakeFetch
    )
    const profile = await fetchGoogleProfile(token.accessToken, fakeFetch)

    const tokenBody = new URLSearchParams(
      requests[0].init?.body as string
    )
    expect(tokenBody.get('code_verifier')).toBe('pkce-verifier')
    expect(tokenBody.get('client_secret')).toBeNull()
    expect(requests[1].init?.headers).toEqual({
      Authorization: 'Bearer access-token'
    })
    expect(token.refreshToken).toBe('refresh-token')
    expect(profile).toEqual({
      sub: 'google-account-id',
      name: 'TSUZUNE User',
      email: 'user@example.com',
      picture: 'https://example.com/avatar.png'
    })
  })

  it('refreshes without requiring a client secret', async () => {
    let body = ''
    const fakeFetch = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      body = init?.body as string
      return new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          expires_in: 1800,
          token_type: 'Bearer'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    const token = await refreshGoogleAccessToken(
      {
        clientId: 'desktop.apps.googleusercontent.com',
        clientSecret: null,
        refreshToken: 'refresh-token'
      },
      fakeFetch
    )

    expect(new URLSearchParams(body).get('grant_type')).toBe('refresh_token')
    expect(new URLSearchParams(body).get('client_secret')).toBeNull()
    expect(token.accessToken).toBe('new-access-token')
  })
})
