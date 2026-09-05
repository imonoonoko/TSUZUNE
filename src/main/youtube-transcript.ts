import { execFile as nodeExecFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(nodeExecFile)
const MAX_FILE_BYTES = 8 * 1024 * 1024

export interface YoutubeTranscriptResult {
  transcript: string
  language?: string
  truncated: boolean
}

export type YoutubeTranscriptFetcher = (videoId: string, preferredLanguage?: string) => Promise<YoutubeTranscriptResult | null>

export interface YoutubeTranscriptRunnerOptions {
  cwd: string
  windowsHide: boolean
  timeout: number
  maxBuffer: number
}

export type YoutubeTranscriptRunner = (file: string, args: string[], options: YoutubeTranscriptRunnerOptions) => Promise<unknown>

export interface YoutubeTranscriptOptions {
  runner?: YoutubeTranscriptRunner
  tempRoot?: string
}

function languageCandidates(preferredLanguage?: string): string[] {
  const base = (preferredLanguage ?? '').trim().toLowerCase().split(/[-_]/)[0].replace(/[^a-z]/g, '')
  const values = base ? [`${base}-orig`, base, 'en-orig', 'en'] : ['ja-orig', 'ja', 'en-orig', 'en']
  return [...new Set(values)]
}

function timestamp(ms: unknown): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null
  const total = Math.floor(ms / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

function parseJson3(raw: string): string {
  const parsed = JSON.parse(raw) as { events?: unknown }
  if (!Array.isArray(parsed.events)) return ''
  return parsed.events.map((event) => {
    if (!event || typeof event !== 'object') return ''
    const item = event as { tStartMs?: unknown; segs?: unknown }
    const time = timestamp(item.tStartMs)
    if (!time || !Array.isArray(item.segs)) return ''
    const text = cleanText(item.segs.map((seg) => seg && typeof seg === 'object' ? (seg as { utf8?: unknown }).utf8 : '').join(''))
    return text ? `${time} ${text}` : ''
  }).filter(Boolean).join('\n')
}

export async function fetchYoutubeTranscriptWithYtDlp(videoId: string, preferredLanguage?: string, options: YoutubeTranscriptOptions = {}): Promise<YoutubeTranscriptResult | null> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoId)) return null
  const root = resolve(options.tempRoot ?? tmpdir())
  let directory: string | undefined
  try {
    directory = await mkdtemp(join(root, 'tsuzune-youtube-'))
    const candidates = languageCandidates(preferredLanguage)
    const runner = options.runner ?? ((file, args, runnerOptions) => execFile(file, args, runnerOptions))
    try {
      await runner('yt-dlp', ['--ignore-config', '--no-playlist', '--skip-download', '--write-subs', '--write-auto-subs', '--sub-format', 'json3', '--sub-langs', candidates.join(','), '--no-progress', '--js-runtimes', 'node', '-o', join(directory, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${videoId}`], { cwd: directory, windowsHide: true, timeout: 20000, maxBuffer: 256 * 1024 })
    } catch {
      // A later language can fail after yt-dlp has already saved an earlier requested subtitle.
    }
    const files = await readdir(directory)
    for (const language of candidates) {
      const file = files.find((name) => name === `${videoId}.${language}.json3`)
      if (!file) continue
      const path = join(directory, file)
      if ((await stat(path)).size > MAX_FILE_BYTES) return null
      const raw = await readFile(path)
      const text = parseJson3(raw.toString('utf8'))
      if (!text) continue
      return { transcript: text, language, truncated: false }
    }
    return null
  } catch {
    return null
  } finally {
    if (directory) {
      const resolved = resolve(directory)
      const relativePath = relative(root, resolved)
      if (isAbsolute(relativePath) === false && relativePath !== '' && !relativePath.startsWith(`..${sep}`) && relativePath !== '..') {
        try {
          await rm(resolved, { recursive: true, force: true })
        } catch {
          // A locked temporary file must not turn a successful clip into a failed save.
        }
      }
    }
  }
}
