import { describe, expect, it } from 'vitest'
import {
  GOOGLE_OAUTH_SCOPES,
  buildGoogleAuthorizationUrl,
  createPkcePair,
  parseGoogleOAuthClient,
  validateOAuthCallback
} from '../src/main/google-auth'

describe('Google OAuth configuration', () => {
  it('accepts a Desktop client export and keeps only the installed-app fields', () => {
    expect(
      parseGoogleOAuthClient(
        JSON.stringify({
          installed: {
            client_id: 'desktop.apps.googleusercontent.com',
            project_id: 'tsuzune',
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            client_secret: 'not-a-confidential-secret',
            redirect_uris: ['http://localhost']
          }
        })
      )
    ).toEqual({
      clientId: 'desktop.apps.googleusercontent.com',
      clientSecret: 'not-a-confidential-secret'
    })
  })

  it('rejects web clients and malformed exports', () => {
    expect(() =>
      parseGoogleOAuthClient(
        JSON.stringify({
          web: {
            client_id: 'web.apps.googleusercontent.com'
          }
        })
      )
    ).toThrow(/Desktop/)
    expect(() => parseGoogleOAuthClient('{not json')).toThrow(/JSON/)
  })
})

describe('Google OAuth request', () => {
  it('creates an S256 PKCE pair without exposing the verifier in the challenge', async () => {
    const pair = await createPkcePair()

    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.challenge).not.toBe(pair.verifier)
  })

  it('uses the system-browser flow with the minimal agreed scopes', () => {
    const url = new URL(
      buildGoogleAuthorizationUrl({
        clientId: 'desktop.apps.googleusercontent.com',
        redirectUri: 'http://127.0.0.1:54321/oauth2/callback',
        state: 'expected-state',
        codeChallenge: 'challenge'
      })
    )

    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://127.0.0.1:54321/oauth2/callback'
    )
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('expected-state')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(
      GOOGLE_OAUTH_SCOPES
    )
    expect(GOOGLE_OAUTH_SCOPES).toEqual([
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file'
    ])
  })
})

describe('OAuth callback validation', () => {
  it('returns the authorization code only for the expected state', () => {
    expect(
      validateOAuthCallback(
        new URL(
          'http://127.0.0.1:54321/oauth2/callback?code=auth-code&state=expected'
        ),
        'expected'
      )
    ).toBe('auth-code')
  })

  it('rejects state mismatches, provider errors, and missing codes', () => {
    expect(() =>
      validateOAuthCallback(
        new URL('http://127.0.0.1:54321/oauth2/callback?code=x&state=wrong'),
        'expected'
      )
    ).toThrow(/state/)
    expect(() =>
      validateOAuthCallback(
        new URL(
          'http://127.0.0.1:54321/oauth2/callback?error=access_denied&state=expected'
        ),
        'expected'
      )
    ).toThrow(/access_denied/)
    expect(() =>
      validateOAuthCallback(
        new URL('http://127.0.0.1:54321/oauth2/callback?state=expected'),
        'expected'
      )
    ).toThrow(/認可コード/)
  })
})
