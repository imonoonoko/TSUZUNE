import { createHash, randomBytes } from 'node:crypto'

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file'
] as const

export interface GoogleOAuthClient {
  clientId: string
  clientSecret: string | null
}

export interface GoogleAuthorizationInput {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

export interface PkcePair {
  verifier: string
  challenge: string
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseGoogleOAuthClient(raw: string): GoogleOAuthClient {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Google OAuth設定JSONを読み取れません。')
  }

  if (!parsed || typeof parsed !== 'object' || !('installed' in parsed)) {
    throw new Error('Google CloudのDesktop app用OAuth設定を選択してください。')
  }

  const installed = (parsed as { installed?: unknown }).installed
  if (!installed || typeof installed !== 'object') {
    throw new Error('Google CloudのDesktop app用OAuth設定を選択してください。')
  }

  const record = installed as Record<string, unknown>
  const clientId = requiredString(record.client_id)
  if (!clientId) {
    throw new Error('Desktop OAuth設定にclient_idがありません。')
  }

  return {
    clientId,
    clientSecret: requiredString(record.client_secret)
  }
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomBytes(64).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildGoogleAuthorizationUrl(
  input: GoogleAuthorizationInput
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

export function validateOAuthCallback(url: URL, expectedState: string): string {
  if (url.searchParams.get('state') !== expectedState) {
    throw new Error('OAuth stateが一致しません。認証をやり直してください。')
  }

  const providerError = url.searchParams.get('error')
  if (providerError) {
    throw new Error(`Google認証が完了しませんでした: ${providerError}`)
  }

  const code = url.searchParams.get('code')
  if (!code) {
    throw new Error('Googleから認可コードが返されませんでした。')
  }
  return code
}
