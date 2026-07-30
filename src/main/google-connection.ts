import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
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
  authorize(clientId: string): Promise<GoogleOAuthLoopbackResult>
  fetchImpl: FetchLike
}

export interface GoogleConnectionStatus {
  configured: boolean
  connected: boolean
  account: GoogleProfile | null
}

interface CachedAccessToken {
  value: string
  expiresAt: number
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
        account: null
      }
    }
    const refreshToken = await this.dependencies.tokenStore.read()
    const account = await readJson<GoogleProfile>(this.accountPath)
    return {
      configured: true,
      connected: Boolean(refreshToken),
      account
    }
  }

  async connect(): Promise<GoogleConnectionStatus> {
    const config = await this.requireConfig()
    const authorization = await this.dependencies.authorize(config.clientId)
    const token = await exchangeGoogleAuthorizationCode(
      {
        ...config,
        code: authorization.code,
        codeVerifier: authorization.codeVerifier,
        redirectUri: authorization.redirectUri
      },
      this.dependencies.fetchImpl
    )
    if (!token.refreshToken) {
      throw new Error(
        'Googleから更新用トークンを取得できませんでした。権限を取り消して再接続してください。'
      )
    }

    const account = await fetchGoogleProfile(
      token.accessToken,
      this.dependencies.fetchImpl
    )
    try {
      await this.dependencies.tokenStore.write(token.refreshToken)
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
      account
    }
  }

  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.accessToken.expiresAt > Date.now() + 60_000
    ) {
      return this.accessToken.value
    }

    const config = await this.requireConfig()
    const refreshToken = await this.dependencies.tokenStore.read()
    if (!refreshToken) {
      throw new Error('Googleアカウントに接続してください。')
    }
    const token = await refreshGoogleAccessToken(
      {
        ...config,
        refreshToken
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
    if (
      !config ||
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
