import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BrowserClipService } from '../src/main/browser-clip'
import {
  startBrowserClipBridge,
  type BrowserClipTokenStore
} from '../src/main/browser-clip-bridge'
import { VaultService } from '../src/main/vault'

class FixedTokenStore implements BrowserClipTokenStore {
  constructor(private value: string | null) {}

  async read(): Promise<string | null> {
    return this.value
  }

  async write(value: string): Promise<void> {
    this.value = value
  }
}

describe('browser clipper integration', () => {
  it('accepts one authorized HTTP capture and creates one provenance note in the Inbox', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-browser-clip-integration-'))
    await mkdir(join(root, '01_受信箱'))
    const vault = new VaultService()
    await vault.setRootPath(root)
    const service = new BrowserClipService({
      vault,
      now: () => new Date('2026-09-01T03:04:05.000Z')
    })
    const token = 'd'.repeat(64)
    const bridge = await startBrowserClipBridge({
      port: 0,
      tokenStore: new FixedTokenStore(token),
      capture: (payload) => service.capture(payload)
    })

    try {
      const response = await fetch(`${bridge.origin}/capture`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          origin: 'chrome-extension://jlmegmmpabknbfhfcbnakpkmhfoeablh'
        },
        body: JSON.stringify({
          requestId: 'integration-capture-0001',
          url: 'https://example.com/context-engine',
          title: 'Context Engine',
          description: 'Source description',
          selection: 'Selected source text',
          content: 'Captured source body',
          siteName: 'example.com',
          author: '',
          language: 'en'
        })
      })

      expect(response.status).toBe(200)
      const result = (await response.json()) as { path: string }
      expect(result.path).toMatch(/^01_受信箱\//)
      const markdown = await readFile(join(root, result.path), 'utf8')
      expect(markdown).toContain('source_url: "https://example.com/context-engine"')
      expect(markdown).toContain('Captured source body')
      expect(markdown).not.toContain('50_履歴')
    } finally {
      await bridge.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
