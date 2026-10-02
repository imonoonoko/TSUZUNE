import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
// @ts-expect-error jsdom is a Vitest runtime dependency without bundled declarations.
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const captureSource = readFileSync(
  join(process.cwd(), 'browser-extension', 'capture.js'),
  'utf8'
)

type ReadabilityResult = {
  title?: string
  byline?: string
  excerpt?: string
  siteName?: string
  textContent?: string
  lang?: string
} | null

async function capturePage(
  html: string,
  url: string,
  readabilityResult: ReadabilityResult,
  configure?: (window: Window & typeof globalThis) => void
): Promise<Record<string, unknown>> {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url
  })
  Object.defineProperty(dom.window, 'Readability', {
    configurable: true,
    value: class {
      parse(): ReadabilityResult {
        return readabilityResult
      }
    }
  })
  configure?.(dom.window as unknown as Window & typeof globalThis)

  return await vm.runInContext(captureSource, dom.getInternalVMContext())
}

describe('browser extension page capture', () => {
  it('uses Readability metadata and article text instead of page chrome', async () => {
    const articleText = [
      '第一段落。これは抽出対象となる記事本文です。'.repeat(8),
      '第二段落。ナビゲーションやコメントではありません。'.repeat(8)
    ].join('\n\n')
    const result = await capturePage(
      `<!doctype html>
      <html lang="ja">
        <head><title>サイト名 | 元のタイトル</title></head>
        <body>
          <main>
            <div class="sidebar">サイドバーのおすすめ一覧</div>
            <article><p>${articleText}</p></article>
            <section class="comments">コメント欄の雑音</section>
          </main>
        </body>
      </html>`,
      'https://example.com/articles/readable',
      {
        title: '読みやすい記事タイトル',
        byline: '記事の著者',
        excerpt: '記事の短い説明',
        siteName: 'Example Journal',
        textContent: articleText,
        lang: 'ja'
      }
    )

    expect(result).toMatchObject({
      title: '読みやすい記事タイトル',
      author: '記事の著者',
      description: '記事の短い説明',
      siteName: 'Example Journal',
      language: 'ja'
    })
    expect(result.content).toBe(articleText)
    expect(result.content).not.toContain('サイドバー')
    expect(result.content).not.toContain('コメント欄')
  })

  it('keeps the existing visible-DOM fallback when Readability returns nothing', async () => {
    const result = await capturePage(
      `<!doctype html><html><body>
        <nav>捨てるナビ</nav>
        <main><h1>短い告知</h1><p>短い本文でも保存します。</p></main>
      </body></html>`,
      'https://example.com/notice',
      null
    )

    expect(result.content).toContain('短い告知')
    expect(result.content).toContain('短い本文でも保存します。')
    expect(result.content).not.toContain('捨てるナビ')
  })

  it('captures transcript segments already visible on YouTube', async () => {
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>動画</title></head><body>
        <ytd-channel-name>テストチャンネル</ytd-channel-name>
        <ytd-transcript-segment-renderer>0:03 最初の発言</ytd-transcript-segment-renderer>
        <ytd-transcript-segment-renderer>0:08 次の発言</ytd-transcript-segment-renderer>
      </body></html>`,
      'https://www.youtube.com/watch?v=video1234',
      null
    )

    expect(result.youtube).toMatchObject({
      videoId: 'video1234',
      channel: '',
      transcript: '0:03 最初の発言\n0:08 次の発言',
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('captures each YouTube transcript cue once from the stamped transcript DOM', async () => {
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>動画</title></head><body>
        <ytd-transcript-segment-renderer>
          <div class="segment style-scope ytd-transcript-segment-renderer">
            <div class="segment-timestamp style-scope ytd-transcript-segment-renderer">0:03</div>
            <yt-formatted-string class="segment-text style-scope ytd-transcript-segment-renderer">最初の発言</yt-formatted-string>
          </div>
        </ytd-transcript-segment-renderer>
        <ytd-transcript-segment-renderer>0:03 最初の発言</ytd-transcript-segment-renderer>
        <ytd-transcript-segment-renderer>0:03 同じ時刻の別の発言</ytd-transcript-segment-renderer>
      </body></html>`,
      'https://www.youtube.com/watch?v=video1234',
      null
    )

    expect(result.youtube).toMatchObject({
      transcript: '0:03 最初の発言\n0:03 同じ時刻の別の発言',
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('keeps a complete visible YouTube transcript beyond the old 8,000-character limit', async () => {
    const lines = Array.from(
      { length: 100 },
      (_, index) => `${Math.floor(index / 2)}:${String((index % 2) * 30).padStart(2, '0')} ${`字幕${index}`.padEnd(90, '字')}`
    )
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>長い動画</title></head><body>
        ${lines.map((line) => `<ytd-transcript-segment-renderer>${line}</ytd-transcript-segment-renderer>`).join('')}
      </body></html>`,
      'https://www.youtube.com/watch?v=longvideo1',
      null
    )

    expect(result.youtube).toMatchObject({
      transcript: lines.join('\n'),
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('keeps a visible YouTube transcript beyond the former 16,000-character boundary', async () => {
    const lines = Array.from(
      { length: 200 },
      (_, index) => `${index}:00 ${`字幕${index}`.padEnd(90, '字')}`
    )
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>さらに長い動画</title></head><body>
        ${lines.map((line) => `<ytd-transcript-segment-renderer>${line}</ytd-transcript-segment-renderer>`).join('')}
      </body></html>`,
      'https://www.youtube.com/watch?v=longvideo2',
      null
    )
    expect(result.youtube).toMatchObject({
      transcript: lines.join('\n'),
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('keeps one large YouTube transcript cue intact', async () => {
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>巨大字幕</title></head><body>
        <ytd-transcript-segment-renderer>0:00 ${'字'.repeat(16_001)}</ytd-transcript-segment-renderer>
      </body></html>`,
      'https://www.youtube.com/watch?v=hugecue001',
      null
    )
    const transcript = (result.youtube as Record<string, unknown>).transcript as string

    expect(result.youtube).toMatchObject({
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
    expect(transcript).toMatch(/^0:00 字+/)
    expect(transcript).toHaveLength(16_006)
  })

  it('uses YouTube metadata without notification or subscriber-count chrome', async () => {
    const playerResponse = {
      videoDetails: {
        videoId: 'video1234',
        title: '正しい動画名',
        author: '正しいチャンネル名',
        shortDescription: '現動画の説明'
      }
    }
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head>
        <title>(2) 古い動画名 - YouTube</title>
        <meta name="title" content="古い動画名">
      </head><body>
        <div id="owner">
          <ytd-channel-name><a href="/@channel">古いチャンネル名</a></ytd-channel-name>
          <span>チャンネル登録者数 140万人</span>
        </div>
        <div id="description">古い動画の説明</div>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
      </body></html>`,
      'https://www.youtube.com/watch?v=video1234',
      null
    )

    expect(result.title).toBe('正しい動画名')
    expect(result.description).toBe('現動画の説明')
    expect(result.youtube).toMatchObject({
      channel: '正しいチャンネル名'
    })
  })

  it('uses exact-video YouTube oEmbed when current player metadata is absent', async () => {
    const fetchCalls: Array<{ url: string, options: RequestInit }> = []
    const result = await capturePage(
      `<!doctype html><html><head><title>前の動画</title>
        <meta name="title" content="前の動画">
        <meta name="description" content="前の動画の説明">
      </head><body><ytd-channel-name>前のチャンネル</ytd-channel-name></body></html>`,
      'https://www.youtube.com/watch?v=current1234',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string, options: RequestInit) => {
            fetchCalls.push({ url: String(input), options })
            return {
              ok: true,
              headers: { get: () => null },
              text: async () => JSON.stringify({
                provider_name: 'YouTube',
                type: 'video',
                title: '現動画',
                author_name: '現チャンネル'
              })
            }
          }
        })
      }
    )

    expect(fetchCalls).toHaveLength(1)
    const requestUrl = new URL(fetchCalls[0].url)
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://www.youtube.com/oembed')
    expect(requestUrl.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=current1234')
    expect(requestUrl.searchParams.get('format')).toBe('json')
    expect(fetchCalls[0].options).toMatchObject({ method: 'GET', credentials: 'omit' })
    expect(result).toMatchObject({ title: '現動画', description: '' })
    expect(result.youtube).toMatchObject({ channel: '現チャンネル' })
  })

  it('fills only missing player metadata from oEmbed and rejects oversized responses', async () => {
    const playerResponse = {
      videoDetails: { videoId: 'current1234', title: 'player の題名', shortDescription: 'player の説明' }
    }
    const html = `<!doctype html><html><head><meta name="title" content="古い題名"></head><body>
      <ytd-channel-name>古いチャンネル</ytd-channel-name>
      <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
    </body></html>`
    const oembedBody = JSON.stringify({
      provider_name: 'YouTube', type: 'video', title: 'oEmbed の題名', author_name: 'oEmbed のチャンネル'
    })
    const withOEmbed = await capturePage(html, 'https://www.youtube.com/watch?v=current1234', null, (window) => {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: async () => ({ ok: true, headers: { get: () => null }, text: async () => oembedBody })
      })
    })
    expect(withOEmbed).toMatchObject({ title: 'player の題名', description: 'player の説明' })
    expect(withOEmbed.youtube).toMatchObject({ channel: 'oEmbed のチャンネル' })

    let bodyRead = false
    const oversized = await capturePage(html, 'https://www.youtube.com/watch?v=current1234', null, (window) => {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: async () => ({
          ok: true,
          headers: { get: () => '40000' },
          text: async () => { bodyRead = true; return oembedBody }
        })
      })
    })
    expect(bodyRead).toBe(false)
    expect(oversized).toMatchObject({ title: 'player の題名', description: 'player の説明' })
    expect(oversized.youtube).toMatchObject({ channel: '' })
  })

  it('leaves unverified YouTube metadata empty except for the video ID', async () => {
    const result = await capturePage(
      `<!doctype html><html><head><title>前の動画</title>
        <meta name="title" content="前の動画">
        <meta name="description" content="前の動画の説明">
      </head><body><ytd-channel-name>前のチャンネル</ytd-channel-name></body></html>`,
      'https://www.youtube.com/watch?v=current1234',
      null
    )

    expect(result).toMatchObject({ title: 'current1234', description: '' })
    expect(result.youtube).toMatchObject({ videoId: 'current1234', channel: '' })
  })

  it('rejects capture if SPA navigation changes the YouTube video while fetching metadata', async () => {
    await expect(capturePage(
      '<!doctype html><html><head><title>前の動画</title></head><body></body></html>',
      'https://www.youtube.com/watch?v=first1234',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async () => {
            window.history.pushState({}, '', '/watch?v=second1234')
            return { ok: false }
          }
        })
      }
    )).rejects.toThrow(/video changed/i)
  })

  it.each(['shorts', 'embed', 'live'])('binds /%s metadata to the path video even with a conflicting v query', async (route) => {
    const response = { videoDetails: { videoId: 'actual12345', title: '現在の動画', author: '現在の著者' } }
    const result = await capturePage(
      `<script>var ytInitialPlayerResponse = ${JSON.stringify(response)};</script>`,
      `https://www.youtube.com/${route}/actual12345?v=second12345`,
      null
    )
    expect(result.title).toBe('現在の動画')
    expect(result.youtube).toMatchObject({ videoId: 'actual12345', channel: '現在の著者' })
  })

  it('detects path-video navigation when an unrelated v query stays unchanged', async () => {
    await expect(capturePage(
      '<html><body></body></html>',
      'https://www.youtube.com/shorts/actual12345?v=second12345',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async () => {
            window.history.pushState({}, '', '/shorts/third12345?v=second12345')
            return { ok: false }
          }
        })
      }
    )).rejects.toThrow(/video changed/i)
  })

  it('opens the YouTube transcript panel and waits briefly for its segments', async () => {
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>動画</title></head><body>
        <button id="show-transcript">文字起こしを表示</button>
        <div id="transcript"></div>
      </body></html>`,
      'https://www.youtube.com/watch?v=video5678',
      null,
      (window) => {
        window.document.querySelector('#show-transcript')?.addEventListener('click', () => {
          const segment = window.document.createElement('ytd-transcript-segment-renderer')
          segment.textContent = '0:10 後から読み込まれた字幕'
          window.document.querySelector('#transcript')?.append(segment)
        })
      }
    )

    expect(result.youtube).toMatchObject({
      videoId: 'video5678',
      transcript: '0:10 後から読み込まれた字幕',
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('uses a validated same-site YouTube caption track when the panel has no segments', async () => {
    const playerResponse = {
      videoDetails: { videoId: 'video9012' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=video9012&lang=ja',
              languageCode: 'ja',
              name: { simpleText: '日本語' }
            }
          ]
        }
      }
    }
    const fetchCalls: string[] = []
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>動画</title></head><body>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
      </body></html>`,
      'https://www.youtube.com/watch?v=video9012',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string | URL) => {
            fetchCalls.push(String(input))
            if (String(input).includes('/oembed?')) return { ok: false }
            return {
              ok: true,
              text: async () => '<transcript><text start="1.2">最初 &amp; 次</text><text start="4">字幕です</text></transcript>'
            }
          }
        })
      }
    )

    const captionCalls = fetchCalls.filter((url) => url.includes('/api/timedtext'))
    expect(captionCalls).toHaveLength(1)
    expect(captionCalls[0]).toMatch(/^https:\/\/www\.youtube\.com\/api\/timedtext/)
    expect(result.youtube).toMatchObject({
      videoId: 'video9012',
      transcript: '0:01 最初 & 次\n0:04 字幕です',
      transcriptStatus: 'captured',
      transcriptLanguage: 'ja',
      transcriptSource: 'caption-track'
    })
  })

  it('keeps a complete caption-track transcript beyond the old 8,000-character limit', async () => {
    const playerResponse = {
      videoDetails: { videoId: 'longtrack1' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{
            baseUrl: 'https://www.youtube.com/api/timedtext?v=longtrack1&lang=ja',
            languageCode: 'ja'
          }]
        }
      }
    }
    const cues = Array.from(
      { length: 100 },
      (_, index) => `<text start="${index}">${`字幕${index}`.padEnd(90, '字')}</text>`
    )
    const expected = Array.from(
      { length: 100 },
      (_, index) => `${Math.floor(index / 60)}:${String(index % 60).padStart(2, '0')} ${`字幕${index}`.padEnd(90, '字')}`
    ).join('\n')
    const result = await capturePage(
      `<script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>`,
      'https://www.youtube.com/watch?v=longtrack1',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string) => String(input).includes('/oembed?') ? { ok: false } : ({
            ok: true,
            headers: { get: () => null },
            text: async () => `<transcript>${cues.join('')}</transcript>`
          })
        })
      }
    )

    expect(result.youtube).toMatchObject({
      transcript: expected,
      transcriptStatus: 'captured',
      transcriptLanguage: 'ja',
      transcriptSource: 'caption-track'
    })
  })

  it('accepts YouTube microformat video ids and parses srv3 caption segments', async () => {
    const playerResponse = {
      microformat: { playerMicroformatRenderer: { externalVideoId: 'micro1234' } },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{
            baseUrl: 'https://www.youtube.com/api/timedtext?v=micro1234&lang=en',
            languageCode: 'en',
            kind: 'asr'
          }]
        }
      }
    }
    const result = await capturePage(
      `<!doctype html><html lang="en-US"><body>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
      </body></html>`,
      'https://www.youtube.com/watch?v=micro1234',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string) => String(input).includes('/oembed?') ? { ok: false } : ({
            ok: true,
            headers: { get: () => null },
            text: async () => '<timedtext><body><p t="1200"><s>First </s><s>&amp; second</s></p></body></timedtext>'
          })
        })
      }
    )

    expect(result.youtube).toMatchObject({
      videoId: 'micro1234',
      transcript: '0:01 First & second',
      transcriptStatus: 'captured',
      transcriptLanguage: 'en',
      transcriptSource: 'caption-track'
    })
  })

  it('chooses a visible transcript button over hidden or close buttons', async () => {
    const result = await capturePage(
      `<!doctype html><html lang="ja"><head><title>動画</title></head><body>
        <button id="close" aria-label="文字起こしを閉じる" hidden>文字起こしを閉じる</button>
        <button id="hidden-show" aria-label="文字起こしを表示" style="display:none">文字起こしを表示</button>
        <button id="show" aria-label="文字起こしを表示">文字起こしを表示</button>
        <div id="transcript"></div>
      </body></html>`,
      'https://www.youtube.com/watch?v=visiblebutton1',
      null,
      (window) => {
        window.document.querySelector('#show')?.addEventListener('click', () => {
          const segment = window.document.createElement('ytd-transcript-segment-renderer')
          segment.textContent = '0:05 表示中ボタンから取得'
          window.document.querySelector('#transcript')?.append(segment)
        })
      }
    )

    expect(result.youtube).toMatchObject({
      transcript: '0:05 表示中ボタンから取得',
      transcriptStatus: 'captured',
      transcriptSource: 'page'
    })
  })

  it('rejects malformed caption timestamps instead of producing false 0:00 segments', async () => {
    const playerResponse = {
      videoDetails: { videoId: 'broken1234' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{
            baseUrl: 'https://www.youtube.com/api/timedtext?v=broken1234&lang=ja',
            languageCode: 'ja'
          }]
        }
      }
    }
    const result = await capturePage(
      `<script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>`,
      'https://www.youtube.com/watch?v=broken1234',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string) => String(input).includes('/oembed?') ? { ok: false } : ({
            ok: true,
            headers: { get: () => null },
            text: async () => '<transcript><text start="not-a-time">偽の字幕</text></transcript>'
          })
        })
      }
    )

    expect(result.youtube).toMatchObject({
      videoId: 'broken1234',
      transcriptStatus: 'failed'
    })
    expect((result.youtube as Record<string, unknown>).transcript).toBeUndefined()
  })

  it('rejects oversized or non-caption YouTube responses before reading their bodies', async () => {
    const cases = [
      {
        videoId: 'large1234',
        baseUrl: 'https://www.youtube.com/api/timedtext?v=large1234&lang=en',
        contentLength: '600000'
      },
      {
        videoId: 'unsafe1234',
        baseUrl: 'https://www.youtube.com/watch?v=unsafe1234',
        contentLength: null
      }
    ]

    for (const testCase of cases) {
      const playerResponse = {
        videoDetails: { videoId: testCase.videoId },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [{ baseUrl: testCase.baseUrl, languageCode: 'en' }]
          }
        }
      }
      let bodyRead = false
      const result = await capturePage(
        `<script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>`,
        `https://www.youtube.com/watch?v=${testCase.videoId}`,
        null,
        (window) => {
          Object.defineProperty(window, 'fetch', {
            configurable: true,
            value: async (input: string) => String(input).includes('/oembed?') ? { ok: false } : ({
              ok: true,
              headers: { get: () => testCase.contentLength },
              text: async () => {
                bodyRead = true
                return '<transcript><text start="0">must not be read</text></transcript>'
              }
            })
          })
        }
      )

      expect(bodyRead).toBe(false)
      expect(result.youtube).toMatchObject({
        videoId: testCase.videoId,
        transcriptStatus: 'failed'
      })
    }
  })

  it('marks YouTube clips with no transcript evidence as unavailable, including live URLs', async () => {
    const result = await capturePage(
      '<!doctype html><html><head><title>ライブ動画</title></head><body></body></html>',
      'https://www.youtube.com/live/live1234',
      null
    )

    expect(result.youtube).toMatchObject({
      videoId: 'live1234',
      transcriptStatus: 'unavailable'
    })
    expect((result.youtube as Record<string, unknown>).transcript).toBeUndefined()
  })

  it('marks stale or unusable YouTube transcript evidence as failed instead of captured', async () => {
    const stalePlayerResponse = {
      videoDetails: { videoId: 'different-video' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=different-video&lang=en', languageCode: 'en' }]
        }
      }
    }
    let captionFetchCalled = false
    const result = await capturePage(
      `<!doctype html><html><head><title>動画</title></head><body>
        <script>var ytInitialPlayerResponse = ${JSON.stringify(stalePlayerResponse)};</script>
      </body></html>`,
      'https://www.youtube.com/watch?v=current-video',
      null,
      (window) => {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          value: async (input: string) => {
            if (String(input).includes('/oembed?')) return { ok: false }
            captionFetchCalled = true
            throw new Error('must not fetch stale captions')
          }
        })
      }
    )

    expect(captionFetchCalled).toBe(false)
    expect(result.youtube).toMatchObject({
      videoId: 'current-video',
      transcriptStatus: 'failed'
    })
    expect((result.youtube as Record<string, unknown>).transcript).toBeUndefined()
  })

  it('prefers a matching current player response over stale SPA data', async () => {
    const staleResponse = {
      videoDetails: { videoId: 'previous-video' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{
            baseUrl: 'https://www.youtube.com/api/timedtext?v=previous-video&lang=en',
            languageCode: 'en'
          }]
        }
      }
    }
    const currentResponse = { videoDetails: { videoId: 'current1234' } }
    const result = await capturePage(
      `<script>var ytInitialPlayerResponse = ${JSON.stringify(staleResponse)};</script>
       <script>var ytInitialPlayerResponse = ${JSON.stringify(currentResponse)};</script>`,
      'https://www.youtube.com/watch?v=current1234',
      null
    )

    expect(result.youtube).toMatchObject({
      videoId: 'current1234',
      transcriptStatus: 'unavailable'
    })
  })
})
