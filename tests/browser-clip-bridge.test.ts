import { describe, expect, it, vi } from 'vitest'
import {
  startBrowserClipBridge,
  type BrowserClipTokenStore
} from '../src/main/browser-clip-bridge'
import type { BrowserClipCaptureResult, BrowserClipPayload } from '../src/main/browser-clip'

const allowedOrigin = 'chrome-extension://jlmegmmpabknbfhfcbnakpkmhfoeablh'

class MemoryTokenStore implements BrowserClipTokenStore {
  value: string | null = null

  async read(): Promise<string | null> {
    return this.value
  }

  async write(value: string): Promise<void> {
    this.value = value
  }
}

const payload: BrowserClipPayload = {
  requestId: 'capture-request-bridge-0001',
  url: 'https://example.com/article',
  title: 'Example article',
  description: 'Description',
  selection: '',
  content: 'Body',
  siteName: 'Example',
  author: '',
  language: 'en'
}

function request(
  origin: string,
  path: string,
  body: object,
  token?: string
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  }
}

describe('browser clip bridge', () => {
  it('requires explicit pairing, persists the capability, and accepts Inbox-only capture data', async () => {
    const tokenStore = new MemoryTokenStore()
    const captureResult: BrowserClipCaptureResult = {
      path: '01_受信箱/Example.md',
      capturedAt: '2026-09-01T03:04:05.000Z',
      sourceType: 'web'
    }
    const capture = vi.fn(async () => captureResult)
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture
    })

    try {
      expect(
        await fetch(`${bridge.origin}/capture`, request(allowedOrigin, '/capture', payload))
          .then((response) => response.status)
      ).toBe(401)

      const pairing = bridge.openPairingWindow()
      expect(pairing.code).toMatch(/^\d{6}$/)
      const paired = await fetch(
        `${bridge.origin}/pair`,
        request(allowedOrigin, '/pair', { code: pairing.code })
      )
      expect(paired.status).toBe(200)
      expect(paired.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
      const { token } = (await paired.json()) as { token: string }
      expect(token).toMatch(/^[a-f0-9]{64}$/)
      expect(tokenStore.value).toBe(token)

      const response = await fetch(
        `${bridge.origin}/capture`,
        request(allowedOrigin, '/capture', payload, token)
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(captureResult)
      expect(capture).toHaveBeenCalledWith(payload)
    } finally {
      await bridge.close()
    }
  })

  it('rejects foreign origins, arbitrary path fields, and oversized input', async () => {
    const tokenStore = new MemoryTokenStore()
    tokenStore.value = 'a'.repeat(64)
    const capture = vi.fn(async (): Promise<BrowserClipCaptureResult> => ({
      path: '01_受信箱/never.md',
      capturedAt: '2026-09-01T03:04:05.000Z',
      sourceType: 'web'
    }))
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture
    })

    try {
      expect(
        await fetch(
          `${bridge.origin}/capture`,
          request('https://malicious.example', '/capture', payload, tokenStore.value)
        ).then((response) => response.status)
      ).toBe(403)

      expect(
        await fetch(
          `${bridge.origin}/capture`,
          request(
            allowedOrigin,
            '/capture',
            { ...payload, path: '50_履歴/overwrite.md' },
            tokenStore.value
          )
        ).then((response) => response.status)
      ).toBe(400)

      expect(
        await fetch(
          `${bridge.origin}/capture`,
          request(
            allowedOrigin,
            '/capture',
            { ...payload, content: 'x'.repeat(8 * 1024 * 1024) },
            tokenStore.value
          )
        ).then((response) => response.status)
      ).toBe(413)
      expect(capture).not.toHaveBeenCalled()
    } finally {
      await bridge.close()
    }
  })

  it('makes one request id idempotent during the running app session', async () => {
    const tokenStore = new MemoryTokenStore()
    tokenStore.value = 'b'.repeat(64)
    const result: BrowserClipCaptureResult = {
      path: '01_受信箱/one.md',
      capturedAt: '2026-09-01T03:04:05.000Z',
      sourceType: 'web'
    }
    const capture = vi.fn(async () => result)
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture
    })

    try {
      const first = await fetch(
        `${bridge.origin}/capture`,
        request(allowedOrigin, '/capture', payload, tokenStore.value)
      )
      const second = await fetch(
        `${bridge.origin}/capture`,
        request(allowedOrigin, '/capture', payload, tokenStore.value)
      )
      expect(await first.json()).toEqual(result)
      expect(await second.json()).toEqual(result)
      expect(capture).toHaveBeenCalledOnce()
    } finally {
      await bridge.close()
    }
  })

  it('joins concurrent requests with the same request id instead of saving twice', async () => {
    const tokenStore = new MemoryTokenStore()
    tokenStore.value = 'c'.repeat(64)
    const result: BrowserClipCaptureResult = {
      path: '01_受信箱/concurrent.md',
      capturedAt: '2026-09-01T03:04:05.000Z',
      sourceType: 'web'
    }
    let releaseCapture!: () => void
    const captureGate = new Promise<void>((resolve) => {
      releaseCapture = resolve
    })
    const capture = vi.fn(async () => {
      await captureGate
      return result
    })
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture
    })

    try {
      const first = fetch(
        `${bridge.origin}/capture`,
        request(allowedOrigin, '/capture', payload, tokenStore.value)
      )
      await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce())
      const second = fetch(
        `${bridge.origin}/capture`,
        request(allowedOrigin, '/capture', payload, tokenStore.value)
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(capture).toHaveBeenCalledOnce()
      releaseCapture()
      expect(await (await first).json()).toEqual(result)
      expect(await (await second).json()).toEqual(result)
    } finally {
      releaseCapture()
      await bridge.close()
    }
  })

  it('invalidates a pairing window after five wrong codes', async () => {
    const tokenStore = new MemoryTokenStore()
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture: async () => {
        throw new Error('not used')
      }
    })

    try {
      const pairing = bridge.openPairingWindow()
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(
          `${bridge.origin}/pair`,
          request(allowedOrigin, '/pair', { code: pairing.code === '000000' ? '000001' : '000000' })
        )
        expect(response.status).toBe(401)
      }
      const afterLimit = await fetch(
        `${bridge.origin}/pair`,
        request(allowedOrigin, '/pair', { code: pairing.code })
      )
      expect(afterLimit.status).toBe(401)
      expect(tokenStore.value).toBeNull()
    } finally {
      await bridge.close()
    }
  })

  it('stops accepting requests after the app bridge closes', async () => {
    const tokenStore = new MemoryTokenStore()
    const bridge = await startBrowserClipBridge({
      port: 0,
      allowedOrigin,
      tokenStore,
      capture: async () => {
        throw new Error('not used')
      }
    })
    const origin = bridge.origin
    await bridge.close()

    await expect(
      fetch(`${origin}/capture`, request(allowedOrigin, '/capture', payload))
    ).rejects.toThrow()
  })
})
