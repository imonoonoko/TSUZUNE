import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GoogleConnectionService,
  type RefreshTokenStore
} from '../src/main/google-connection'

const directories: string[] = []

async function stateDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'tsuzune-google-state-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

function memoryTokenStore(initial: string | null = null): RefreshTokenStore & {
  value: string | null
} {
  return {
    value: initial,
    async read() {
      return this.value
    },
    async write(value) {
      this.value = value
    },
    async clear() {
      this.value = null
    }
  }
}

const oauthJson = JSON.stringify({
  installed: {
    client_id: 'desktop.apps.googleusercontent.com',
    client_secret: 'desktop-secret'
  }
})

describe('GoogleConnectionService', () => {
  it('uses the bundled OAuth client without requiring a user-selected JSON file', async () => {
    const authorize = vi.fn(async () => ({
      code: 'authorization-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://127.0.0.1:54321/oauth2/callback'
    }))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (input.toString().includes('/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          sub: 'google-sub',
          name: 'Humin',
          email: 'humin@example.com'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    const service = new GoogleConnectionService({
      stateDirectory: await stateDirectory(),
      tokenStore: memoryTokenStore(),
      bundledClientId: 'bundled.apps.googleusercontent.com',
      authorize,
      fetchImpl
    })

    expect(await service.getStatus()).toMatchObject({
      configured: true,
      connected: false
    })

    await service.connect()

    expect(authorize).toHaveBeenCalledWith(
      'bundled.apps.googleusercontent.com'
    )
  })

  it('prefers a user-selected OAuth client over the bundled client', async () => {
    const authorize = vi.fn(async () => ({
      code: 'authorization-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://127.0.0.1:54321/oauth2/callback'
    }))
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (input.toString().includes('/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          sub: 'google-sub',
          name: 'Humin',
          email: 'humin@example.com'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    const service = new GoogleConnectionService({
      stateDirectory: await stateDirectory(),
      tokenStore: memoryTokenStore(),
      bundledClientId: 'bundled.apps.googleusercontent.com',
      authorize,
      fetchImpl
    })
    await service.configure(oauthJson)

    await service.connect()

    expect(authorize).toHaveBeenCalledWith(
      'desktop.apps.googleusercontent.com'
    )
  })

  it('keeps OAuth configuration separate from connection state', async () => {
    const service = new GoogleConnectionService({
      stateDirectory: await stateDirectory(),
      tokenStore: memoryTokenStore(),
      authorize: vi.fn(),
      fetchImpl: vi.fn()
    })

    expect(await service.getStatus()).toMatchObject({
      configured: false,
      connected: false,
      account: null
    })
    await service.configure(oauthJson)
    expect(await service.getStatus()).toMatchObject({
      configured: true,
      connected: false,
      account: null
    })
  })

  it('connects, stores only the refresh token durably, and exposes the account', async () => {
    const tokenStore = memoryTokenStore()
    const fetchImpl = vi.fn(async (input: string | URL) => {
      if (input.toString().includes('/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          sub: 'google-sub',
          name: 'Humin',
          email: 'humin@example.com'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    const service = new GoogleConnectionService({
      stateDirectory: await stateDirectory(),
      tokenStore,
      authorize: vi.fn(async () => ({
        code: 'authorization-code',
        codeVerifier: 'verifier',
        redirectUri: 'http://127.0.0.1:54321/oauth2/callback'
      })),
      fetchImpl
    })
    await service.configure(oauthJson)

    const status = await service.connect()

    expect(tokenStore.value).toBe('refresh-token')
    expect(status).toMatchObject({
      configured: true,
      connected: true,
      account: {
        sub: 'google-sub',
        name: 'Humin',
        email: 'humin@example.com'
      }
    })
    expect(await service.getAccessToken()).toBe('access-token')
  })

  it('refreshes an access token after restart and disconnects without removing config', async () => {
    const directory = await stateDirectory()
    const tokenStore = memoryTokenStore()
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: 'refreshed-access-token',
          expires_in: 1800
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const first = new GoogleConnectionService({
      stateDirectory: directory,
      tokenStore,
      authorize: vi.fn(),
      fetchImpl
    })
    await first.configure(oauthJson)
    tokenStore.value = 'refresh-token'
    const restarted = new GoogleConnectionService({
      stateDirectory: directory,
      tokenStore,
      authorize: vi.fn(),
      fetchImpl
    })

    expect(await restarted.getAccessToken()).toBe('refreshed-access-token')
    await restarted.disconnect()

    expect(tokenStore.value).toBeNull()
    expect(await restarted.getStatus()).toMatchObject({
      configured: true,
      connected: false
    })
  })

  it('does not start authentication before a Desktop OAuth config is supplied', async () => {
    const authorize = vi.fn()
    const service = new GoogleConnectionService({
      stateDirectory: await stateDirectory(),
      tokenStore: memoryTokenStore(),
      authorize,
      fetchImpl: vi.fn()
    })

    await expect(service.connect()).rejects.toThrow(/OAuth設定/)
    expect(authorize).not.toHaveBeenCalled()
  })
})
