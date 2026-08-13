import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  GOOGLE_CALENDAR_READ_SCOPE,
  GOOGLE_OAUTH_SCOPES,
  parseGoogleOAuthClient,
  type GoogleOAuthClient
} from './google-auth'
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  refreshGoogleAccessToken,
  type GoogleOAuthLoopbackResult,
  type GoogleProfile,
  type GoogleToken
} from './google-oauth-flow'

export interface RefreshTokenStore {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  clear(): Promise<void>
}

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

export interface GoogleConnectionDependencies {
  stateDirectory: string
  tokenStore: RefreshTokenStore
  bundledClientId?: string | null
  bundledClientSecret?: string | null
  authorize(input: {
    clientId: string
    scopes: readonly string[]
    loginHint?: string
  }): Promise<GoogleOAuthLoopbackResult>
  fetchImpl: FetchLike
}

export type GoogleAuthorizedFeature = 'drive_sync' | 'calendar_read'

export interface GoogleConnectionStatus {
  configured: boolean
  connected: boolean
  account: GoogleProfile | null
  authorizedFeatures: GoogleAuthorizedFeature[]
}

interface CachedAccessToken {
  value: string
  expiresAt: number
}

interface GoogleCredentialBundle {
  version: 1
  refreshToken: string
  grantedScopes: string[]
  accountSub: string
}

function parseCredential(
  storedValue: string,
  accountSub: string | null
): GoogleCredentialBundle {
  try {
    const parsed = JSON.parse(storedValue) as Partial<GoogleCredentialBundle>
    if (
      parsed.version === 1 &&
      typeof parsed.refreshToken === 'string' &&
      Array.isArray(parsed.grantedScopes) &&
      parsed.grantedScopes.every((scope) => typeof scope === 'string') &&
      typeof parsed.accountSub === 'string'
    ) {
      return {
        version: 1,
        refreshToken: parsed.refreshToken,
        grantedScopes: parsed.grantedScopes,
        accountSub: parsed.accountSub
      }
    }
  } catch {
    // Previous TSUZUNE versions stored the refresh token as a plain string.
  }

  return {
    version: 1,
    refreshToken: storedValue,
    grantedScopes: [...GOOGLE_OAUTH_SCOPES],
    accountSub: accountSub ?? ''
  }
}

function authorizedFeatures(
  grantedScopes: readonly string[]
): GoogleAuthorizedFeature[] {
  const features: GoogleAuthorizedFeature[] = []
  if (grantedScopes.includes('https://www.googleapis.com/auth/drive.file')) {
    features.push('drive_sync')
  }
  if (grantedScopes.includes(GOOGLE_CALENDAR_READ_SCOPE)) {
    features.push('calendar_read')
  }
  return features
}

function requireGrantedScopes(
  token: GoogleToken,
  requestedScopes: readonly string[]
): void {
  const normalizeScope = (scope: string): string =>
    scope === 'https://www.googleapis.com/auth/userinfo.email'
      ? 'email'
      : scope === 'https://www.googleapis.com/auth/userinfo.profile'
        ? 'profile'
        : scope
  const grantedScopes = new Set(token.grantedScopes.map(normalizeScope))
  const missing = requestedScopes.filter(
    (scope) => !grantedScopes.has(normalizeScope(scope))
  )
  if (missing.length > 0) {
    throw new Error(
      'Googleで必要な権限がすべて許可されませんでした。既存の接続は変更していません。'
    )
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${randomUUID()}`
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export class GoogleConnectionService {
  private readonly configPath: string
  private readonly accountPath: string
  private accessToken: CachedAccessToken | null = null

  constructor(private readonly dependencies: GoogleConnectionDependencies) {
    this.configPath = join(
      dependencies.stateDirectory,
      'google-oauth-client.json'
    )
    this.accountPath = join(dependencies.stateDirectory, 'google-account.json')
  }

  async configure(raw: string): Promise<GoogleConnectionStatus> {
    const config = parseGoogleOAuthClient(raw)
    await writeJsonAtomic(this.configPath, config)
    await this.dependencies.tokenStore.clear()
    await rm(this.accountPath, { force: true })
    this.accessToken = null
    return this.getStatus()
  }

  async getStatus(): Promise<GoogleConnectionStatus> {
    const config = await this.readConfig()
    if (!config) {
      return {
        configured: false,
        connected: false,
        account: null,
        authorizedFeatures: []
      }
    }
    const storedCredential = await this.dependencies.tokenStore.read()
    const account = await readJson<GoogleProfile>(this.accountPath)
    const credential = storedCredential
      ? parseCredential(storedCredential, account?.sub ?? null)
      : null
    return {
      configured: true,
      connected: Boolean(credential),
      account,
      authorizedFeatures: credential
        ? authorizedFeatures(credential.grantedScopes)
        : []
    }
  }

  async connect(): Promise<GoogleConnectionStatus> {
    const config = await this.requireConfig()
    const requestedScopes = [...GOOGLE_OAUTH_SCOPES]
    const authorization = await this.dependencies.authorize({
      clientId: config.clientId,
      scopes: requestedScopes
    })
    const token = await exchangeGoogleAuthorizationCode(
      {
        ...config,
        code: authorization.code,
        codeVerifier: authorization.codeVerifier,
        redirectUri: authorization.redirectUri,
        requestedScopes
      },
      this.dependencies.fetchImpl
    )
    if (!token.refreshToken) {
      throw new Error(
        'Googleから更新用トークンを取得できませんでした。権限を取り消して再接続してください。'
      )
    }
    requireGrantedScopes(token, requestedScopes)

    const account = await fetchGoogleProfile(
      token.accessToken,
      this.dependencies.fetchImpl
    )
    const credential: GoogleCredentialBundle = {
      version: 1,
      refreshToken: token.refreshToken,
      grantedScopes: token.grantedScopes,
      accountSub: account.sub
    }
    try {
      await this.dependencies.tokenStore.write(JSON.stringify(credential))
      await writeJsonAtomic(this.accountPath, account)
    } catch (error) {
      await this.dependencies.tokenStore.clear().catch(() => undefined)
      await rm(this.accountPath, { force: true }).catch(() => undefined)
      throw error
    }
    this.rememberAccessToken(token)
    return {
      configured: true,
      connected: true,
      account,
      authorizedFeatures: authorizedFeatures(credential.grantedScopes)
    }
  }

  async authorizeCalendarRead(): Promise<GoogleConnectionStatus> {
    const config = await this.requireConfig()
    const account = await readJson<GoogleProfile>(this.accountPath)
    const storedCredential = await this.dependencies.tokenStore.read()
    if (!account || !storedCredential) {
      throw new Error('Googleアカウントに接続してください。')
    }
    const currentCredential = parseCredential(storedCredential, account.sub)
    if (currentCredential.grantedScopes.includes(GOOGLE_CALENDAR_READ_SCOPE)) {
      return this.getStatus()
    }

    const requestedScopes = [
      ...new Set([
        ...currentCredential.grantedScopes,
        GOOGLE_CALENDAR_READ_SCOPE
      ])
    ]
    const authorization = await this.dependencies.authorize({
      clientId: config.clientId,
      scopes: requestedScopes,
      loginHint: account.email
    })
    const token = await exchangeGoogleAuthorizationCode(
      {
        ...config,
        code: authorization.code,
        codeVerifier: authorization.codeVerifier,
        redirectUri: authorization.redirectUri,
        requestedScopes
      },
      this.dependencies.fetchImpl
    )
    if (!token.refreshToken) {
      throw new Error(
        'Googleから更新用トークンを取得できませんでした。既存の接続は変更していません。'
      )
    }
    requireGrantedScopes(token, requestedScopes)

    const nextAccount = await fetchGoogleProfile(
      token.accessToken,
      this.dependencies.fetchImpl
    )
    if (nextAccount.sub !== account.sub) {
      throw new Error(
        '接続中とは別のGoogleアカウントが選択されました。既存の接続は変更していません。'
      )
    }
    const nextCredential: GoogleCredentialBundle = {
      version: 1,
      refreshToken: token.refreshToken,
      grantedScopes: token.grantedScopes,
      accountSub: nextAccount.sub
    }

    await writeJsonAtomic(this.accountPath, nextAccount)
    await this.dependencies.tokenStore.write(JSON.stringify(nextCredential))
    this.rememberAccessToken(token)
    return this.getStatus()
  }

  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.accessToken.expiresAt > Date.now() + 60_000
    ) {
      return this.accessToken.value
    }

    const config = await this.requireConfig()
    const storedCredential = await this.dependencies.tokenStore.read()
    if (!storedCredential) {
      throw new Error('Googleアカウントに接続してください。')
    }
    const account = await readJson<GoogleProfile>(this.accountPath)
    const credential = parseCredential(
      storedCredential,
      account?.sub ?? null
    )
    const token = await refreshGoogleAccessToken(
      {
        ...config,
        refreshToken: credential.refreshToken
      },
      this.dependencies.fetchImpl
    )
    this.rememberAccessToken(token)
    return token.accessToken
  }

  async disconnect(): Promise<GoogleConnectionStatus> {
    this.accessToken = null
    await this.dependencies.tokenStore.clear()
    await rm(this.accountPath, { force: true })
    return this.getStatus()
  }

  private rememberAccessToken(token: GoogleToken): void {
    this.accessToken = {
      value: token.accessToken,
      expiresAt: token.expiresAt
    }
  }

  private async readConfig(): Promise<GoogleOAuthClient | null> {
    const config = await readJson<Partial<GoogleOAuthClient>>(this.configPath)
    if (config) {
      if (
        typeof config.clientId !== 'string' ||
        (config.clientSecret !== null &&
          typeof config.clientSecret !== 'string')
      ) {
        return null
      }
      return {
        clientId: config.clientId,
        clientSecret: config.clientSecret
      }
    }
    const bundledClientId = this.dependencies.bundledClientId?.trim()
    return bundledClientId
      ? {
          clientId: bundledClientId,
          clientSecret:
            this.dependencies.bundledClientSecret?.trim() || null
        }
      : null
  }

  private async requireConfig(): Promise<GoogleOAuthClient> {
    const config = await this.readConfig()
    if (!config) {
      throw new Error(
        'Google CloudのDesktop OAuth設定JSONを先に選択してください。'
      )
    }
    return config
  }
}
