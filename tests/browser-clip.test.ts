import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractWikiLinks } from '../src/core/links'
import {
  BrowserClipService,
  type BrowserClipPayload
} from '../src/main/browser-clip'
import type { YoutubeTranscriptFetcher } from '../src/main/youtube-transcript'
import { VaultService } from '../src/main/vault'

const temporaryDirectories: string[] = []

async function fixture(
  fetchYoutubeTranscript: YoutubeTranscriptFetcher = async () => null
): Promise<{
  root: string
  service: BrowserClipService
}> {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-browser-clip-'))
  temporaryDirectories.push(root)
  await mkdir(join(root, '01_受信箱'))
  const vault = new VaultService()
  await vault.setRootPath(root)
  return {
    root,
    service: new BrowserClipService({
      vault,
      now: () => new Date('2026-09-01T03:04:05.000Z'),
      fetchYoutubeTranscript
    })
  }
}

function webPayload(overrides: Partial<BrowserClipPayload> = {}): BrowserClipPayload {
  return {
    requestId: 'capture-request-0001',
    url: 'https://example.com/articles/context-engine?from=test',
    title: '文脈エンジンの作り方',
    description: 'ページの概要です。',
    selection: '選択した重要箇所',
    content: '本文です。',
    siteName: 'Example',
    author: 'Author',
    language: 'ja',
    ...overrides
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('BrowserClipService', () => {
  it('creates independent provenance snapshots in the Inbox without overwriting', async () => {
    const { root, service } = await fixture()

    const first = await service.capture(webPayload())
    const second = await service.capture(
      webPayload({ requestId: 'capture-request-0002', content: '変更後の本文です。' })
    )

    expect(first.path).toMatch(/^01_受信箱\/2026-09-01-120405 - 文脈エンジンの作り方\.md$/)
    expect(second.path).toMatch(/ \(2\)\.md$/)
    const firstContent = await readFile(join(root, first.path), 'utf8')
    const secondContent = await readFile(join(root, second.path), 'utf8')
    expect(firstContent).toContain('source_type: web')
    expect(firstContent).toContain('role: inbox-source')
    expect(firstContent).toContain('source_url: "https://example.com/articles/context-engine?from=test"')
    expect(firstContent).toContain('captured_at: "2026-09-01T03:04:05.000Z"')
    expect(firstContent).toContain('外部ソース・未検証')
    expect(firstContent).toContain('本文です。')
    expect(secondContent).toContain('変更後の本文です。')
    expect(firstContent).not.toContain('50_履歴')
  })

  it('records bounded YouTube metadata and optional visible transcript', async () => {
    const { root, service } = await fixture()
    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=PGPMocgdIiA',
        title: 'AIで文脈エンジンを作る',
        description: '動画説明',
        content: '',
        youtube: {
          videoId: 'PGPMocgdIiA',
          channel: 'Example Channel',
          timestampSeconds: 125.4,
          transcript: '00:00 導入\n00:30 文脈の説明',
          transcriptStatus: 'captured',
          transcriptLanguage: 'ja',
          transcriptSource: 'caption-track'
        }
      })
    )

    const content = await readFile(join(root, result.path), 'utf8')
    expect(result.sourceType).toBe('youtube')
    expect(content).toContain('source_type: youtube')
    expect(content).toContain('youtube_video_id: "PGPMocgdIiA"')
    expect(content).toContain('youtube_timestamp_seconds: 125')
    expect(content).toContain('youtube_transcript_status: captured')
    expect(content).toContain('youtube_transcript_language: "ja"')
    expect(content).toContain('youtube_transcript_source: caption-track')
    expect(content).toContain('Example Channel')
    expect(content).toContain('00:30 文脈の説明')
  })

  it('recovers a failed YouTube transcript through the local fallback before saving', async () => {
    const fetchYoutubeTranscript = vi.fn<YoutubeTranscriptFetcher>(async () => ({
      transcript: '0:00 最近さ、AI社員って知ってる？\n0:08 実演を始めます。',
      language: 'ja-orig',
      truncated: false
    }))
    const { root, service } = await fixture(fetchYoutubeTranscript)

    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=qH0jNKhfidQ',
        title: 'Claude CodeのAI社員を使った最新起業',
        language: 'ja-JP',
        content: '',
        youtube: {
          videoId: 'qH0jNKhfidQ',
          transcriptStatus: 'failed'
        }
      })
    )

    expect(fetchYoutubeTranscript).toHaveBeenCalledOnce()
    expect(fetchYoutubeTranscript).toHaveBeenCalledWith('qH0jNKhfidQ', 'ja-JP')
    expect(result.youtubeTranscriptStatus).toBe('captured')
    const content = await readFile(join(root, result.path), 'utf8')
    expect(content).toContain('youtube_transcript_status: captured')
    expect(content).toContain('youtube_transcript_language: "ja-orig"')
    expect(content).toContain('youtube_transcript_source: caption-track')
    expect(content).toContain('0:08 実演を始めます。')
    expect(content).not.toContain('文字起こし: 取得できず')
  })

  it('does not run the local fallback when the page already supplied a transcript', async () => {
    const fetchYoutubeTranscript = vi.fn<YoutubeTranscriptFetcher>(async () => null)
    const { service } = await fixture(fetchYoutubeTranscript)

    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=already1234',
        title: '取得済み動画',
        content: '',
        youtube: {
          videoId: 'already1234',
          transcript: '0:00 取得済み',
          transcriptStatus: 'captured',
          transcriptSource: 'page'
        }
      })
    )

    expect(fetchYoutubeTranscript).not.toHaveBeenCalled()
    expect(result.youtubeTranscriptStatus).toBe('captured')
  })

  it('replaces a truncated page transcript with a complete local transcript', async () => {
    const fetchYoutubeTranscript = vi.fn<YoutubeTranscriptFetcher>(async () => ({
      transcript: '0:00 冒頭\n29:00 途中\n41:52 最後まで取得',
      language: 'ja-orig',
      truncated: false
    }))
    const { root, service } = await fixture(fetchYoutubeTranscript)

    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=cehtaE2YCxc',
        title: '長い字幕の動画',
        content: '',
        youtube: {
          videoId: 'cehtaE2YCxc',
          transcript: '0:00 冒頭\n29:00 途中',
          transcriptStatus: 'truncated',
          transcriptSource: 'page'
        }
      })
    )

    expect(fetchYoutubeTranscript).toHaveBeenCalledOnce()
    expect(fetchYoutubeTranscript).toHaveBeenCalledWith('cehtaE2YCxc', 'ja')
    expect(result.youtubeTranscriptStatus).toBe('captured')
    const content = await readFile(join(root, result.path), 'utf8')
    expect(content).toContain('youtube_transcript_status: captured')
    expect(content).toContain('youtube_transcript_language: "ja-orig"')
    expect(content).toContain('youtube_transcript_source: caption-track')
    expect(content).toContain('41:52 最後まで取得')
    expect(content).not.toContain('文字起こし: 一部取得')
  })

  it('keeps the longer page transcript when the local fallback is also truncated', async () => {
    const fetchYoutubeTranscript = vi.fn<YoutubeTranscriptFetcher>(async () => ({
      transcript: '0:00 冒頭',
      language: 'ja-orig',
      truncated: true
    }))
    const { root, service } = await fixture(fetchYoutubeTranscript)

    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=partial1234',
        title: '長い動画',
        content: '',
        youtube: {
          videoId: 'partial1234',
          transcript: '0:00 冒頭\n29:00 取得できた範囲',
          transcriptStatus: 'truncated',
          transcriptSource: 'page'
        }
      })
    )

    expect(fetchYoutubeTranscript).toHaveBeenCalledOnce()
    expect(result.youtubeTranscriptStatus).toBe('truncated')
    const content = await readFile(join(root, result.path), 'utf8')
    expect(content).toContain('29:00 取得できた範囲')
    expect(content).toContain('youtube_transcript_source: page')
  })

  it('does not run the local fallback for a non-web YouTube URL', async () => {
    const fetchYoutubeTranscript = vi.fn<YoutubeTranscriptFetcher>(async () => null)
    const { service } = await fixture(fetchYoutubeTranscript)

    await expect(
      service.capture(
        webPayload({
          url: 'ftp://youtube.com/watch?v=qH0jNKhfidQ',
          title: '非Web URL',
          content: '',
          youtube: {
            videoId: 'qH0jNKhfidQ',
            transcriptStatus: 'failed'
          }
        })
      )
    ).rejects.toThrow('source URLはhttpまたはhttpsで指定してください。')

    expect(fetchYoutubeTranscript).not.toHaveBeenCalled()
  })

  it('records an unavailable transcript explicitly without inventing transcript text', async () => {
    const { root, service } = await fixture()
    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/live/live1234',
        title: '字幕のないライブ動画',
        content: '',
        youtube: {
          videoId: 'live1234',
          transcriptStatus: 'unavailable'
        }
      })
    )

    const content = await readFile(join(root, result.path), 'utf8')
    expect(content).toContain('youtube_video_id: "live1234"')
    expect(content).toContain('youtube_transcript_status: unavailable')
    expect(content).toContain('文字起こし: クリップ時に確認できず')
    expect(content).not.toContain('## 文字起こし')
  })

  it('records a truncated YouTube transcript explicitly', async () => {
    const { root, service } = await fixture()
    const result = await service.capture(
      webPayload({
        url: 'https://www.youtube.com/watch?v=partial1234',
        title: '長い動画',
        content: '',
        youtube: {
          videoId: 'partial1234',
          transcript: '00:00 取得できた範囲',
          transcriptStatus: 'truncated',
          transcriptSource: 'page'
        }
      })
    )

    const content = await readFile(join(root, result.path), 'utf8')
    expect(content).toContain('youtube_transcript_status: truncated')
    expect(content).toContain('文字起こし: 一部取得（ページ表示）')
    expect(content).toContain('00:00 取得できた範囲')
  })

  it('fences untrusted page text so it cannot add Wiki links or frontmatter', async () => {
    const { root, service } = await fixture()
    const result = await service.capture(
      webPayload({
        title: '---\nmalicious: true\n[[偽リンク]]',
        selection: '[[30_知識/乗っ取り]]\n<script>alert(1)</script>',
        content: '```\n[[別の偽リンク]]\n```'
      })
    )
    const content = await readFile(join(root, result.path), 'utf8')

    expect(extractWikiLinks(content)).toEqual([])
    expect(content).toContain('[[30_知識/乗っ取り]]')
    expect(content).toContain('<script>alert(1)</script>')
    expect(result.path).toMatch(/^01_受信箱\//)
  })

  it('preserves source content beyond the former organizer size boundary', async () => {
    const { root, service } = await fixture()
    const result = await service.capture(
      webPayload({
        selection: '選'.repeat(40_000),
        content: '本文'.repeat(80_000)
      })
    )

    const content = await readFile(join(root, result.path), 'utf8')
    expect(Buffer.byteLength(content, 'utf8')).toBeGreaterThan(64 * 1024)
    expect(content).toContain('本文'.repeat(80_000))
  })

  it('rejects non-web URLs without creating a note', async () => {
    const { root, service } = await fixture()

    await expect(
      service.capture(webPayload({ url: 'file:///C:/Users/Humin/secret.txt' }))
    ).rejects.toThrow(/http/)
    await expect(stat(join(root, '01_受信箱'))).resolves.toBeDefined()
  })
})
