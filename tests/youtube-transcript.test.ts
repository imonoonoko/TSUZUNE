import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fetchYoutubeTranscriptWithYtDlp } from '../src/main/youtube-transcript'

const event = (tStartMs: number, text: string) => ({ tStartMs, segs: [{ utf8: text }] })

describe('fetchYoutubeTranscriptWithYtDlp', () => {
  it('passes a safe URL and language order, then parses JSON3', async () => {
    let args: string[] = []
    const result = await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', 'ja-JP', {
      tempRoot: tmpdir(),
      runner: async (_file, received, options) => {
        args = received
        await writeFile(join(options.cwd, 'qH0jNKhfidQ.ja-orig.json3'), JSON.stringify({ events: [event(0, 'こんにちは'), event(61000, '世界')] }))
      }
    })
    expect(args[0]).toBe('--ignore-config')
    expect(args).toContain('--sub-langs')
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('ja-orig,ja,en-orig,en')
    expect(args.at(-1)).toBe('https://www.youtube.com/watch?v=qH0jNKhfidQ')
    expect(result).toEqual({ transcript: '0:00 こんにちは\n1:01 世界', language: 'ja-orig', truncated: false })
  })

  it('rejects invalid ids without running a process', async () => {
    let called = false
    expect(await fetchYoutubeTranscriptWithYtDlp('https://youtube.com/watch?v=x', undefined, { runner: async () => { called = true } })).toBeNull()
    expect(called).toBe(false)
  })

  it('returns null for process failure, missing files, and malformed events', async () => {
    expect(await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', undefined, { runner: async () => { throw new Error('failed') } })).toBeNull()
    expect(await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', undefined, { runner: async () => undefined })).toBeNull()
    const result = await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', undefined, { runner: async (_file, _args, options) => {
      await writeFile(join(options.cwd, 'qH0jNKhfidQ.ja-orig.json3'), JSON.stringify({ events: [{ nope: true }, event(0, 'ok')] }))
    } })
    expect(result?.transcript).toBe('0:00 ok')
  })

  it('uses a valid preferred subtitle saved before a later language fails', async () => {
    const result = await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', 'ja-JP', { runner: async (_file, _args, options) => {
      await writeFile(join(options.cwd, 'qH0jNKhfidQ.ja-orig.json3'), JSON.stringify({ events: [event(0, '先に保存済み')] }))
      throw new Error('later language failed')
    } })
    expect(result).toEqual({ transcript: '0:00 先に保存済み', language: 'ja-orig', truncated: false })
  })

  it('keeps a transcript beyond the former 48 KiB boundary', async () => {
    const result = await fetchYoutubeTranscriptWithYtDlp('qH0jNKhfidQ', undefined, { runner: async (_file, _args, options) => {
      await writeFile(join(options.cwd, 'qH0jNKhfidQ.ja-orig.json3'), JSON.stringify({ events: Array.from({ length: 1000 }, (_, i) => event(i * 1000, 'あ'.repeat(80))) }))
    } })
    expect(result?.truncated).toBe(false)
    expect(Buffer.byteLength(result?.transcript ?? '', 'utf8')).toBeGreaterThan(48 * 1024)
    expect(result?.transcript.endsWith('あ')).toBe(true)
    expect(result?.transcript.includes('�')).toBe(false)
  })
})
