import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
// @ts-expect-error jsdom is a Vitest runtime dependency without bundled declarations.
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'

const popupSource = readFileSync(join(process.cwd(), 'browser-extension', 'popup.js'), 'utf8')

describe('browser extension popup', () => {
  it('waits for an explicit save click after pairing and saves exactly once', async () => {
    const dom = new JSDOM(`
      <div id="pair"></div>
      <input id="code">
      <button id="pairButton">ペアリング</button>
      <button id="clip">このページを受信箱へ保存</button>
      <div id="status"></div>
    `)
    const executeScript = vi.fn(async () => [
      {
        result: {
          requestId: 'popup-capture-0001',
          url: 'https://example.com/article',
          title: 'Example article'
        }
      }
    ])
    let finishCapture!: () => void
    const captureGate = new Promise<void>((resolve) => {
      finishCapture = resolve
    })
    const fetchCapture = vi.fn(async () => {
      await captureGate
      return new Response(
        JSON.stringify({ path: '01_受信箱/Example article.md' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    vm.runInNewContext(popupSource, {
      document: dom.window.document,
      fetch: fetchCapture,
      chrome: {
        tabs: {
          query: vi.fn(async () => [{ id: 7, url: 'https://example.com/article' }])
        },
        scripting: { executeScript },
        storage: {
          local: {
            get: vi.fn(async () => ({ token: 'paired-token' })),
            set: vi.fn(async () => undefined)
          }
        }
      }
    })

    await vi.waitFor(() => {
      expect((dom.window.document.getElementById('pair') as HTMLElement).hidden).toBe(true)
    })
    expect(executeScript).not.toHaveBeenCalled()
    expect(fetchCapture).not.toHaveBeenCalled()

    const clip = dom.window.document.getElementById('clip') as HTMLButtonElement
    clip.click()
    clip.click()

    await vi.waitFor(() => expect(fetchCapture).toHaveBeenCalledOnce())
    expect(executeScript).toHaveBeenCalledOnce()
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['vendor/Readability.js', 'capture.js']
    })
    expect(clip.disabled).toBe(true)
    finishCapture()
    await vi.waitFor(() => expect(clip.disabled).toBe(false))
    expect(dom.window.document.getElementById('status')?.textContent).toContain(
      '受信箱に保存しました'
    )
  })

  it('keeps capture disabled until one-time pairing succeeds without auto-saving', async () => {
    const dom = new JSDOM(`
      <div id="pair"></div>
      <input id="code" value="123456">
      <button id="pairButton">ペアリング</button>
      <button id="clip" disabled>このページを受信箱へ保存</button>
      <div id="status"></div>
    `)
    const executeScript = vi.fn()
    const storageSet = vi.fn(async () => undefined)
    const fetchPair = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'new-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    vm.runInNewContext(popupSource, {
      document: dom.window.document,
      fetch: fetchPair,
      chrome: {
        tabs: { query: vi.fn() },
        scripting: { executeScript },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
            set: storageSet
          }
        }
      }
    })

    const pair = dom.window.document.getElementById('pair') as HTMLElement
    const clip = dom.window.document.getElementById('clip') as HTMLButtonElement
    await vi.waitFor(() => expect(clip.disabled).toBe(true))
    expect(pair.hidden).toBe(false)

    ;(dom.window.document.getElementById('pairButton') as HTMLButtonElement).click()

    await vi.waitFor(() => expect(storageSet).toHaveBeenCalledWith({ token: 'new-token' }))
    expect(pair.hidden).toBe(true)
    expect(clip.disabled).toBe(false)
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('returns to the visible pairing state when the saved token is rejected', async () => {
    const dom = new JSDOM(`
      <div id="pair"></div>
      <input id="code">
      <button id="pairButton">ペアリング</button>
      <button id="clip" disabled>このページを受信箱へ保存</button>
      <div id="status"></div>
    `)
    const storageRemove = vi.fn(async () => undefined)

    vm.runInNewContext(popupSource, {
      document: dom.window.document,
      fetch: vi.fn(async () => new Response(null, { status: 401 })),
      chrome: {
        tabs: {
          query: vi.fn(async () => [{ id: 7, url: 'https://example.com/article' }])
        },
        scripting: {
          executeScript: vi.fn(async () => [
            {
              result: {
                requestId: 'popup-capture-0002',
                url: 'https://example.com/article',
                title: 'Example article'
              }
            }
          ])
        },
        storage: {
          local: {
            get: vi.fn(async () => ({ token: 'expired-token' })),
            set: vi.fn(async () => undefined),
            remove: storageRemove
          }
        }
      }
    })

    const pair = dom.window.document.getElementById('pair') as HTMLElement
    const clip = dom.window.document.getElementById('clip') as HTMLButtonElement
    await vi.waitFor(() => expect(pair.hidden).toBe(true))
    clip.click()

    await vi.waitFor(() => expect(storageRemove).toHaveBeenCalledWith('token'))
    expect(pair.hidden).toBe(false)
    expect(clip.disabled).toBe(true)
  })

  it('rejects browser-internal pages without sending a capture request', async () => {
    const dom = new JSDOM(`
      <div id="pair"></div>
      <input id="code">
      <button id="pairButton">ペアリング</button>
      <button id="clip" disabled>このページを受信箱へ保存</button>
      <div id="status"></div>
    `)
    const executeScript = vi.fn()
    const fetchCapture = vi.fn()

    vm.runInNewContext(popupSource, {
      document: dom.window.document,
      fetch: fetchCapture,
      chrome: {
        tabs: {
          query: vi.fn(async () => [{ id: 7, url: 'chrome://extensions' }])
        },
        scripting: { executeScript },
        storage: {
          local: {
            get: vi.fn(async () => ({ token: 'paired-token' })),
            set: vi.fn(async () => undefined)
          }
        }
      }
    })

    const clip = dom.window.document.getElementById('clip') as HTMLButtonElement
    await vi.waitFor(() => expect(clip.disabled).toBe(false))
    clip.click()

    await vi.waitFor(() => expect(clip.disabled).toBe(false))
    expect(executeScript).not.toHaveBeenCalled()
    expect(fetchCapture).not.toHaveBeenCalled()
    expect(dom.window.document.getElementById('status')?.textContent).toContain(
      'このページは対応していません'
    )
  })

  it.each([
    ['captured', '受信箱に保存しました（字幕あり）'],
    ['truncated', '受信箱に保存しました（字幕は一部）'],
    ['unavailable', '受信箱に保存しました（字幕を確認できず）'],
    ['failed', '受信箱に保存しました（表示中の情報のみ）']
  ])('shows the YouTube transcript outcome after saving: %s', async (transcriptStatus, expected) => {
    const dom = new JSDOM(`
      <div id="pair"></div>
      <input id="code">
      <button id="pairButton">ペアリング</button>
      <button id="clip">このページを受信箱へ保存</button>
      <div id="status"></div>
    `)

    vm.runInNewContext(popupSource, {
      document: dom.window.document,
      fetch: vi.fn(async () => new Response(
        JSON.stringify({
          path: '01_受信箱/Video.md',
          youtubeTranscriptStatus: transcriptStatus
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )),
      chrome: {
        tabs: { query: vi.fn(async () => [{ id: 8, url: 'https://www.youtube.com/watch?v=video1234' }]) },
        scripting: {
          executeScript: vi.fn(async () => [{
            result: {
              requestId: 'popup-capture-youtube',
              url: 'https://www.youtube.com/watch?v=video1234',
              title: 'Video',
              youtube: { videoId: 'video1234', transcriptStatus: 'failed' }
            }
          }])
        },
        storage: {
          local: {
            get: vi.fn(async () => ({ token: 'paired-token' })),
            set: vi.fn(async () => undefined)
          }
        }
      }
    })

    const clip = dom.window.document.getElementById('clip') as HTMLButtonElement
    await vi.waitFor(() => expect(clip.disabled).toBe(false))
    clip.click()

    await vi.waitFor(() => {
      expect(dom.window.document.getElementById('status')?.textContent).toBe(expected)
    })
  })
})
