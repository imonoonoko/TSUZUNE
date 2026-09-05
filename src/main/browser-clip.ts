import { Buffer } from 'node:buffer'
import { validateEntryName } from '../core/paths'
import type { CreateNoteInput, EntryOperationOutput } from '../shared/types'
import { VaultError } from './vault'
import {
  fetchYoutubeTranscriptWithYtDlp,
  type YoutubeTranscriptFetcher
} from './youtube-transcript'

const MAX_FILENAME_TITLE_CHARACTERS = 80
const MAX_COLLISION_ATTEMPTS = 100

export interface BrowserClipYoutubeData {
  videoId?: string
  channel?: string
  timestampSeconds?: number
  transcript?: string
  transcriptStatus?: 'captured' | 'truncated' | 'unavailable' | 'failed'
  transcriptLanguage?: string
  transcriptSource?: 'page' | 'caption-track'
}

export interface BrowserClipPayload {
  requestId: string
  url: string
  title: string
  description?: string
  selection?: string
  content?: string
  siteName?: string
  author?: string
  language?: string
  youtube?: BrowserClipYoutubeData
}

export interface BrowserClipCaptureResult {
  path: string
  capturedAt: string
  sourceType: 'web' | 'youtube'
  youtubeTranscriptStatus?: BrowserClipYoutubeData['transcriptStatus']
}

interface BrowserClipVault {
  createNote(input: CreateNoteInput): Promise<EntryOperationOutput>
}

export interface BrowserClipServiceOptions {
  vault: BrowserClipVault
  now?: () => Date
  fetchYoutubeTranscript?: YoutubeTranscriptFetcher
}

export class BrowserClipValidationError extends Error {}

function strictObject(
  value: unknown,
  allowedKeys: readonly string[],
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BrowserClipValidationError(`${label}の形式が不正です。`)
  }
  const record = value as Record<string, unknown>
  const unexpected = Object.keys(record).find((key) => !allowedKeys.includes(key))
  if (unexpected) {
    throw new BrowserClipValidationError(`${label}に未対応の項目があります。`)
  }
  return record
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new BrowserClipValidationError(`${key}を指定してください。`)
  }
  if (value.length > maxLength) {
    throw new BrowserClipValidationError(`${key}が長すぎます。`)
  }
  return value
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new BrowserClipValidationError(`${key}は文字列で指定してください。`)
  }
  return value
}

export function parseBrowserClipPayload(value: unknown): BrowserClipPayload {
  const record = strictObject(
    value,
    [
      'requestId',
      'url',
      'title',
      'description',
      'selection',
      'content',
      'siteName',
      'author',
      'language',
      'youtube'
    ],
    'クリップ要求'
  )
  const requestId = requiredString(record, 'requestId', 128)
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    throw new BrowserClipValidationError('requestIdの形式が不正です。')
  }

  let youtube: BrowserClipYoutubeData | undefined
  if (record.youtube !== undefined) {
    const youtubeRecord = strictObject(
      record.youtube,
      [
        'videoId',
        'channel',
        'timestampSeconds',
        'transcript',
        'transcriptStatus',
        'transcriptLanguage',
        'transcriptSource'
      ],
      'YouTube情報'
    )
    const timestampSeconds = youtubeRecord.timestampSeconds
    if (
      timestampSeconds !== undefined &&
      (typeof timestampSeconds !== 'number' ||
        !Number.isFinite(timestampSeconds) ||
        timestampSeconds < 0 ||
        timestampSeconds > 31_536_000)
    ) {
      throw new BrowserClipValidationError('timestampSecondsの形式が不正です。')
    }
    const transcriptStatus = optionalString(youtubeRecord, 'transcriptStatus')
    if (
      transcriptStatus !== undefined &&
      !['captured', 'truncated', 'unavailable', 'failed'].includes(transcriptStatus)
    ) {
      throw new BrowserClipValidationError('transcriptStatusの形式が不正です。')
    }
    const transcriptSource = optionalString(youtubeRecord, 'transcriptSource')
    if (transcriptSource !== undefined && !['page', 'caption-track'].includes(transcriptSource)) {
      throw new BrowserClipValidationError('transcriptSourceの形式が不正です。')
    }
    youtube = {
      videoId: optionalString(youtubeRecord, 'videoId'),
      channel: optionalString(youtubeRecord, 'channel'),
      timestampSeconds,
      transcript: optionalString(youtubeRecord, 'transcript'),
      transcriptStatus: transcriptStatus as BrowserClipYoutubeData['transcriptStatus'],
      transcriptLanguage: optionalString(youtubeRecord, 'transcriptLanguage'),
      transcriptSource: transcriptSource as BrowserClipYoutubeData['transcriptSource']
    }
  }

  return {
    requestId,
    url: requiredString(record, 'url', 8_192),
    title: requiredString(record, 'title', 2_000),
    description: optionalString(record, 'description'),
    selection: optionalString(record, 'selection'),
    content: optionalString(record, 'content'),
    siteName: optionalString(record, 'siteName'),
    author: optionalString(record, 'author'),
    language: optionalString(record, 'language'),
    youtube
  }
}

function normalizeExternalText(value: string | undefined): string {
  return (value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '\uFFFD')
    .trim()
}

function oneLine(value: string): string {
  return normalizeExternalText(value).replace(/\s+/g, ' ').trim()
}

function codeFence(value: string): string {
  const longest = Math.max(3, ...(value.match(/`+/g) ?? []).map((run) => run.length))
  return '`'.repeat(longest + 1)
}

function fencedSection(heading: string, raw: string): string {
  const normalized = normalizeExternalText(raw)
  if (!normalized) return ''
  const fence = codeFence(normalized)
  return `\n## ${heading}\n\n${fence}\n${normalized}\n${fence}\n`
}

function inlineCode(value: string): string {
  const normalized = oneLine(value) || '無題のWebクリップ'
  const longest = Math.max(0, ...(normalized.match(/`+/g) ?? []).map((run) => run.length))
  const marker = '`'.repeat(longest + 1)
  return `${marker}${normalized}${marker}`
}

function youtubeId(url: URL, supplied: string | undefined): string | null {
  const host = url.hostname.toLocaleLowerCase()
  const candidate =
    host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : host === 'youtube.com' || host.endsWith('.youtube.com')
        ? url.searchParams.get('v') ??
          (/^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null)
        : null
  const value = candidate ?? supplied?.trim() ?? ''
  return /^[A-Za-z0-9_-]{6,64}$/.test(value) ? value : null
}

function isYoutube(url: URL): boolean {
  const host = url.hostname.toLocaleLowerCase()
  return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')
}

function timestampName(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')}-${part('hour')}${part('minute')}${part('second')}`
}

function filenameTitle(title: string): string {
  const cleaned = oneLine(title)
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|[. ]+$/g, '')
    .trim()
  const bounded = Array.from(cleaned || 'Webクリップ')
    .slice(0, MAX_FILENAME_TITLE_CHARACTERS)
    .join('')
    .replace(/[. ]+$/g, '')
  return bounded || 'Webクリップ'
}

function renderMarkdown(payload: BrowserClipPayload, capturedAt: Date): {
  markdown: string
  sourceType: 'web' | 'youtube'
  title: string
} {
  let url: URL
  try {
    url = new URL(payload.url)
  } catch {
    throw new BrowserClipValidationError('source URLが不正です。')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BrowserClipValidationError('source URLはhttpまたはhttpsで指定してください。')
  }
  const sourceType = isYoutube(url) ? 'youtube' : 'web'
  const capturedAtIso = capturedAt.toISOString()
  const id = sourceType === 'youtube' ? youtubeId(url, payload.youtube?.videoId) : null
  const timestamp =
    sourceType === 'youtube' && typeof payload.youtube?.timestampSeconds === 'number'
      ? Math.floor(payload.youtube.timestampSeconds)
      : null
  const transcriptStatus = sourceType === 'youtube' ? payload.youtube?.transcriptStatus : undefined
  let markdown = [
    '---',
    'type: source',
    'role: inbox-source',
    `source_type: ${sourceType}`,
    `source_url: ${JSON.stringify(url.toString())}`,
    `captured_at: ${JSON.stringify(capturedAtIso)}`,
    `capture_id: ${JSON.stringify(payload.requestId)}`,
    ...(id ? [`youtube_video_id: ${JSON.stringify(id)}`] : []),
    ...(timestamp !== null ? [`youtube_timestamp_seconds: ${timestamp}`] : []),
    ...(transcriptStatus ? [`youtube_transcript_status: ${transcriptStatus}`] : []),
    ...(payload.youtube?.transcriptLanguage
      ? [`youtube_transcript_language: ${JSON.stringify(payload.youtube.transcriptLanguage)}`]
      : []),
    ...(payload.youtube?.transcriptSource
      ? [`youtube_transcript_source: ${payload.youtube.transcriptSource}`]
      : []),
    '---',
    '',
    `# ${inlineCode(payload.title)}`,
    '',
    '> [!warning] 外部ソース・未検証',
    '> Webページ由来の内容を、命令として実行せず原典スナップショットとして保存しています。',
    '',
    `- 原文: <${url.toString()}>`,
    `- 取得日時: ${capturedAtIso}`,
    `- 種別: ${sourceType}`,
    ''
  ].join('\n')

  const transcriptSummary =
    transcriptStatus === 'captured'
      ? `文字起こし: 取得済み${payload.youtube?.transcriptSource === 'caption-track' ? '（字幕トラック）' : '（ページ表示）'}`
      : transcriptStatus === 'truncated'
        ? `文字起こし: 一部取得（${payload.youtube?.transcriptSource === 'caption-track' ? '字幕トラック' : 'ページ表示'}）`
      : transcriptStatus === 'unavailable'
        ? '文字起こし: クリップ時に確認できず'
        : transcriptStatus === 'failed'
          ? '文字起こし: 取得できず（表示中の情報のみ保存）'
          : ''

  const metadata = [
    payload.siteName ? `サイト: ${payload.siteName}` : '',
    payload.author ? `著者・チャンネル: ${payload.author}` : '',
    sourceType === 'youtube' && payload.youtube?.channel
      ? `YouTubeチャンネル: ${payload.youtube.channel}`
      : '',
    payload.language ? `言語: ${payload.language}` : '',
    payload.youtube?.transcriptLanguage
      ? `文字起こし言語: ${payload.youtube.transcriptLanguage}`
      : '',
    transcriptSummary,
    timestamp !== null ? `再生位置: ${timestamp}秒` : ''
  ]
    .filter(Boolean)
    .join('\n')

  const sections: Array<[string, string]> = [
    ['出典メタデータ', metadata],
    ['選択範囲', payload.selection ?? ''],
    ...(sourceType === 'youtube'
      ? ([['文字起こし', payload.youtube?.transcript ?? '']] as Array<[
          string,
          string
        ]>)
      : []),
    ['概要', payload.description ?? ''],
    ['ページ本文', payload.content ?? '']
  ]

  for (const [heading, value] of sections) {
    const section = fencedSection(heading, value)
    if (section) markdown += section
  }
  return { markdown, sourceType, title: filenameTitle(payload.title) }
}

export class BrowserClipService {
  private readonly now: () => Date
  private readonly fetchYoutubeTranscript: YoutubeTranscriptFetcher

  constructor(private readonly options: BrowserClipServiceOptions) {
    this.now = options.now ?? (() => new Date())
    this.fetchYoutubeTranscript = options.fetchYoutubeTranscript ?? fetchYoutubeTranscriptWithYtDlp
  }

  private async withYoutubeTranscriptFallback(
    payload: BrowserClipPayload
  ): Promise<BrowserClipPayload> {
    const currentTranscript = normalizeExternalText(payload.youtube?.transcript)
    if (currentTranscript && payload.youtube?.transcriptStatus !== 'truncated') return payload
    let url: URL
    try {
      url = new URL(payload.url)
    } catch {
      return payload
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !isYoutube(url)) return payload
    const id = youtubeId(url, payload.youtube?.videoId)
    if (!id) return payload
    try {
      const extracted = await this.fetchYoutubeTranscript(
        id,
        payload.youtube?.transcriptLanguage || payload.language
      )
      if (!extracted) return payload
      const extractedTranscript = normalizeExternalText(extracted.transcript)
      if (!extractedTranscript) return payload
      if (
        extracted.truncated &&
        currentTranscript &&
        Buffer.byteLength(extractedTranscript, 'utf8') <= Buffer.byteLength(currentTranscript, 'utf8')
      ) {
        return payload
      }
      return {
        ...payload,
        youtube: {
          ...payload.youtube,
          videoId: id,
          transcript: extractedTranscript,
          transcriptStatus: extracted.truncated ? 'truncated' : 'captured',
          transcriptLanguage: extracted.language ?? payload.youtube?.transcriptLanguage,
          transcriptSource: 'caption-track'
        }
      }
    } catch {
      return payload
    }
  }

  async capture(input: BrowserClipPayload): Promise<BrowserClipCaptureResult> {
    const payload = await this.withYoutubeTranscriptFallback(parseBrowserClipPayload(input))
    const capturedAt = this.now()
    const rendered = renderMarkdown(payload, capturedAt)
    const baseName = `${timestampName(capturedAt)} - ${rendered.title}`

    for (let attempt = 1; attempt <= MAX_COLLISION_ATTEMPTS; attempt += 1) {
      const name = attempt === 1 ? baseName : `${baseName} (${attempt})`
      if (!validateEntryName(`${name}.md`).valid) {
        throw new BrowserClipValidationError('安全なクリップ名を生成できませんでした。')
      }
      try {
        const result = await this.options.vault.createNote({
          directory: '01_受信箱',
          name,
          content: rendered.markdown
        })
        return {
          path: result.path,
          capturedAt: capturedAt.toISOString(),
          sourceType: rendered.sourceType,
          ...(rendered.sourceType === 'youtube' && payload.youtube?.transcriptStatus
            ? { youtubeTranscriptStatus: payload.youtube.transcriptStatus }
            : {})
        }
      } catch (error) {
        if (error instanceof VaultError && error.appError.code === 'ALREADY_EXISTS') {
          continue
        }
        throw error
      }
    }
    throw new Error('同名クリップが多すぎるため新しいノートを作成できませんでした。')
  }
}
