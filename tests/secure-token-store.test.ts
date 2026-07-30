import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SecureTokenStore,
  type StringEncryptor
} from '../src/main/secure-token-store'

const temporaryDirectories: string[] = []

async function temporaryFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'tsuzune-token-store-'))
  temporaryDirectories.push(directory)
  return join(directory, 'google-token.json')
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

function fakeEncryptor(available = true): StringEncryptor {
  return {
    isAvailable: async () => available,
    encrypt: async (plainText) =>
      Buffer.from(`cipher:${Buffer.from(plainText).toString('base64')}`, 'utf8'),
    decrypt: async (encrypted) => {
      const encoded = encrypted.toString('utf8').replace(/^cipher:/, '')
      return Buffer.from(encoded, 'base64').toString('utf8')
    }
  }
}

describe('SecureTokenStore', () => {
  it('stores and restores a refresh token without leaving it in plaintext', async () => {
    const filePath = await temporaryFile()
    const store = new SecureTokenStore(filePath, fakeEncryptor())

    await store.write('refresh-token-that-must-stay-private')

    const stored = await readFile(filePath, 'utf8')
    expect(stored).not.toContain('refresh-token-that-must-stay-private')
    expect(await store.read()).toBe('refresh-token-that-must-stay-private')
  })

  it('fails closed when OS encryption is unavailable', async () => {
    const store = new SecureTokenStore(
      await temporaryFile(),
      fakeEncryptor(false)
    )

    await expect(store.write('plaintext-fallback-is-forbidden')).rejects.toThrow(
      /暗号化/
    )
  })

  it('returns null for a missing token and removes a stored token', async () => {
    const store = new SecureTokenStore(await temporaryFile(), fakeEncryptor())

    expect(await store.read()).toBeNull()
    await store.write('refresh-token')
    await store.clear()
    expect(await store.read()).toBeNull()
  })
})
