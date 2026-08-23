import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  classifyHistoryCommitV2,
  createHistoryIntentV2,
  decodeHistoryRecordV2,
  encodeHistoryRecordV2,
  historyRecordSha256,
  restoreHistoryPreviousBytes
} from '../src/mcp/history-store-v2'
import {
  recoverHistoryShadowReceiptV2,
  runHistoryShadowUpdateV2
} from '../src/mcp/history-store-v2-shadow'
import { VaultMcpService } from '../src/mcp/service'

describe('TSUZUNE History Store v2 shadow fixture', () => {
  let root = ''
  let shadowDirectory = ''
  let service: VaultMcpService

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tsuzune-history-v2-shadow-'))
    shadowDirectory = join(root, '.shadow-history-v2')
    await mkdir(join(root, 'Projects'))
    await writeFile(
      join(root, 'Projects', 'TSUZUNE.md'),
      '# TSUZUNE\r\n\r\nAI連携を試す。\r\n',
      'utf8'
    )
    service = new VaultMcpService({ explicitVaultPath: root })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function shadowFiles(): Promise<string[]> {
    try {
      return (await readdir(shadowDirectory)).sort()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  it('wraps the existing Markdown history update with a committed v2 shadow record', async () => {
    const target = 'Projects/TSUZUNE.md'
    const beforeBytes = await readFile(join(root, target))
    const afterBytes = Buffer.from('# TSUZUNE\n\n新しい連携方針。\n', 'utf8')
    const opened = await service.fetch(target)

    const result = await runHistoryShadowUpdateV2({
      historyDirectory: shadowDirectory,
      intentInput: {
        transactionId: 'shadow-success-001',
        target,
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: opened.metadata.revision,
        previousRecordSha256: null,
        reason: 'shadow fixture',
        sourceRefs: ['tests/history-store-v2-shadow.test.ts'],
        beforeBytes,
        afterBytes
      },
      applyCanonicalUpdate: () =>
        service.autonomousUpdateNote(target, afterBytes.toString('utf8'), {
          expectedRevision: opened.metadata.revision,
          reason: 'shadow fixture',
          sourceRefs: ['tests/history-store-v2-shadow.test.ts']
        }),
      readCanonicalBytes: () => readFile(join(root, target)),
      appliedAt: '2026-08-23T00:00:01.000Z'
    })

    expect(result.v2Status).toBe('committed')
    const intentRecord = decodeHistoryRecordV2(await readFile(result.intentPath))
    const receiptRecord = decodeHistoryRecordV2(await readFile(result.receiptPath))
    if (intentRecord.kind !== 'intent') throw new Error('expected intent')
    if (receiptRecord.kind !== 'commit-receipt') throw new Error('expected receipt')

    expect(restoreHistoryPreviousBytes(intentRecord)).toEqual(beforeBytes)
    expect(
      classifyHistoryCommitV2(intentRecord, receiptRecord, await readFile(join(root, target)))
    ).toEqual({ status: 'committed' })
    expect(result.updateResult.provenance.history_path).toMatch(
      /^50_履歴\/AI更新\/.*\.md$/
    )
    const legacyHistory = await readFile(
      join(root, result.updateResult.provenance.history_path ?? ''),
      'utf8'
    )
    expect(legacyHistory).toContain('AI連携を試す。')
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/),
      expect.stringMatching(/\.receipt\.hsv2$/)
    ])
  })

  it('keeps v2 records outside public Markdown readers', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('# TSUZUNE\n\nreader parity。\n', 'utf8')
    const opened = await service.fetch(target)

    await runHistoryShadowUpdateV2({
      historyDirectory: shadowDirectory,
      intentInput: {
        transactionId: 'shadow-reader-parity-001',
        target,
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: opened.metadata.revision,
        previousRecordSha256: null,
        reason: 'reader parity fixture',
        sourceRefs: [],
        beforeBytes,
        afterBytes
      },
      applyCanonicalUpdate: () =>
        service.autonomousUpdateNote(target, afterBytes.toString('utf8'), {
          expectedRevision: opened.metadata.revision,
          reason: 'reader parity fixture'
        }),
      readCanonicalBytes: () => readFile(targetPath),
      appliedAt: '2026-08-23T00:00:01.000Z'
    })

    expect((await service.fetch(target)).text).toBe(afterBytes.toString('utf8'))
    expect(
      (await service.search('TSUZUNE', 100, true)).results.every((result) =>
        result.id.endsWith('.md')
      )
    ).toBe(true)
    expect(
      (
        await service.buildContext(target, 15_000, { includeHistory: true })
      ).included.every((note) => note.path.endsWith('.md'))
    ).toBe(true)
  })

  it('leaves only an uncertain intent when the canonical update fails', async () => {
    const target = 'Projects/TSUZUNE.md'
    const beforeBytes = await readFile(join(root, target))

    await expect(
      runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-failure-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: 'sha256:fixture',
          previousRecordSha256: null,
          reason: 'failure fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes: Buffer.from('after')
        },
        applyCanonicalUpdate: async () => {
          throw new Error('simulated update failure')
        },
        readCanonicalBytes: () => readFile(join(root, target)),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })
    ).rejects.toThrow(/simulated update failure/)

    expect(await readFile(join(root, target))).toEqual(beforeBytes)
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])
  })

  it('characterizes callback rejection after canonical mutation as no-go', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('after mutation', 'utf8')

    await expect(
      runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-post-save-rejection-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: 'sha256:fixture',
          previousRecordSha256: null,
          reason: 'post-save rejection fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes
        },
        applyCanonicalUpdate: async () => {
          await writeFile(targetPath, afterBytes)
          throw new Error('simulated post-save failure')
        },
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })
    ).rejects.toThrow(/simulated post-save failure/)

    expect(await readFile(targetPath)).toEqual(afterBytes)
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])
  })

  it('does not write a receipt when canonical read-back differs from the intent', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)

    const result = await runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-mismatch-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: 'sha256:fixture',
          previousRecordSha256: null,
          reason: 'mismatch fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes: Buffer.from('expected')
        },
        applyCanonicalUpdate: () => writeFile(targetPath, 'unexpected', 'utf8'),
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })

    expect(result).toMatchObject({
      v2Status: 'pending-recovery',
      pendingReason: expect.stringMatching(/observed after hash mismatch/)
    })

    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])
  })

  it('preserves a successful canonical result when read-back needs recovery', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    let canonicalUpdates = 0

    const result = await runHistoryShadowUpdateV2({
      historyDirectory: shadowDirectory,
      intentInput: {
        transactionId: 'shadow-readback-failure-001',
        target,
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'sha256:fixture',
        previousRecordSha256: null,
        reason: 'read-back failure fixture',
        sourceRefs: [],
        beforeBytes,
        afterBytes: Buffer.from('after')
      },
      applyCanonicalUpdate: async () => {
        canonicalUpdates += 1
        await writeFile(targetPath, 'after', 'utf8')
        return { existingResult: true }
      },
      readCanonicalBytes: async () => {
        throw new Error('simulated read-back failure')
      },
      appliedAt: '2026-08-23T00:00:01.000Z'
    })

    expect(result).toMatchObject({
      updateResult: { existingResult: true },
      v2Status: 'pending-recovery',
      pendingReason: 'simulated read-back failure'
    })
    expect(canonicalUpdates).toBe(1)
    expect(await readFile(targetPath, 'utf8')).toBe('after')
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])
  })

  it('keeps an unstringifiable post-canonical failure pending recovery', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)

    const result = await runHistoryShadowUpdateV2({
      historyDirectory: shadowDirectory,
      intentInput: {
        transactionId: 'shadow-unknown-failure-001',
        target,
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'sha256:fixture',
        previousRecordSha256: null,
        reason: 'unknown failure fixture',
        sourceRefs: [],
        beforeBytes,
        afterBytes: Buffer.from('after')
      },
      applyCanonicalUpdate: async () => {
        await writeFile(targetPath, 'after', 'utf8')
        return { existingResult: true }
      },
      readCanonicalBytes: () => Promise.reject(Object.create(null)),
      appliedAt: '2026-08-23T00:00:01.000Z'
    })

    expect(result).toMatchObject({
      updateResult: { existingResult: true },
      v2Status: 'pending-recovery',
      pendingReason: 'Unknown History Store v2 shadow failure'
    })
  })

  it('stops before canonical mutation when hard-link preflight fails', async () => {
    const target = 'Projects/TSUZUNE.md'
    const beforeBytes = await readFile(join(root, target))
    let canonicalUpdates = 0

    await expect(
      runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-preflight-failure-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: 'sha256:fixture',
          previousRecordSha256: null,
          reason: 'preflight fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes: Buffer.from('after')
        },
        applyCanonicalUpdate: async () => {
          canonicalUpdates += 1
        },
        readCanonicalBytes: () => readFile(join(root, target)),
        appliedAt: '2026-08-23T00:00:01.000Z',
        failpoint: (stage) => {
          if (stage === 'preflight') throw new Error('simulated hard-link failure')
        }
      })
    ).rejects.toThrow(/simulated hard-link failure/)

    expect(canonicalUpdates).toBe(0)
    expect(await readFile(join(root, target))).toEqual(beforeBytes)
    expect(await shadowFiles()).toEqual([])
  })

  it('stops before canonical mutation when intent persistence fails', async () => {
    const target = 'Projects/TSUZUNE.md'
    const beforeBytes = await readFile(join(root, target))
    let canonicalUpdates = 0

    await expect(
      runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-intent-failure-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: 'sha256:fixture',
          previousRecordSha256: null,
          reason: 'intent failure fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes: Buffer.from('after')
        },
        applyCanonicalUpdate: async () => {
          canonicalUpdates += 1
        },
        readCanonicalBytes: () => readFile(join(root, target)),
        appliedAt: '2026-08-23T00:00:01.000Z',
        failpoint: (stage) => {
          if (stage === 'intent') throw new Error('simulated ENOSPC')
        }
      })
    ).rejects.toThrow(/simulated ENOSPC/)

    expect(canonicalUpdates).toBe(0)
    expect(await readFile(join(root, target))).toEqual(beforeBytes)
    expect(await shadowFiles()).toEqual([])
  })

  it('recovers only the receipt after receipt persistence fails', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('# TSUZUNE\n\nreceipt復旧。\n', 'utf8')
    const opened = await service.fetch(target)
    let canonicalUpdates = 0
    const intentInput = {
      transactionId: 'shadow-receipt-failure-001',
      target,
      recordedAt: '2026-08-23T00:00:00.000Z',
      previousRevision: opened.metadata.revision,
      previousRecordSha256: null,
      reason: 'receipt failure fixture',
      sourceRefs: [],
      beforeBytes,
      afterBytes
    }

    const result = await runHistoryShadowUpdateV2({
      historyDirectory: shadowDirectory,
      intentInput,
      applyCanonicalUpdate: async () => {
        canonicalUpdates += 1
        return service.autonomousUpdateNote(target, afterBytes.toString('utf8'), {
          expectedRevision: opened.metadata.revision,
          reason: 'receipt failure fixture'
        })
      },
      readCanonicalBytes: () => readFile(targetPath),
      appliedAt: '2026-08-23T00:00:01.000Z',
      failpoint: (stage) => {
        if (stage === 'receipt') throw new Error('simulated receipt ENOSPC')
      }
    })

    expect(result).toMatchObject({
      v2Status: 'pending-recovery',
      pendingReason: 'simulated receipt ENOSPC'
    })
    expect(result.updateResult.provenance.history_path).toMatch(/\.md$/)
    expect(canonicalUpdates).toBe(1)
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])

    await recoverHistoryShadowReceiptV2({
      historyDirectory: shadowDirectory,
      intentInput,
      readCanonicalBytes: () => readFile(targetPath),
      appliedAt: '2026-08-23T00:00:02.000Z'
    })

    expect(canonicalUpdates).toBe(1)
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/),
      expect.stringMatching(/\.receipt\.hsv2$/)
    ])
  })

  it('keeps a stale concurrent update uncommitted and creates no legacy history', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const opened = await service.fetch(target)
    await writeFile(targetPath, '# TSUZUNE\n\n外部更新。\n', 'utf8')
    const targetInfo = await stat(targetPath)
    const externalTime = new Date(targetInfo.mtimeMs + 10_000)
    await utimes(targetPath, externalTime, externalTime)

    await expect(
      runHistoryShadowUpdateV2({
        historyDirectory: shadowDirectory,
        intentInput: {
          transactionId: 'shadow-stale-001',
          target,
          recordedAt: '2026-08-23T00:00:00.000Z',
          previousRevision: opened.metadata.revision,
          previousRecordSha256: null,
          reason: 'stale fixture',
          sourceRefs: [],
          beforeBytes,
          afterBytes: Buffer.from('stale overwrite')
        },
        applyCanonicalUpdate: () =>
          service.autonomousUpdateNote(target, 'stale overwrite', {
            expectedRevision: opened.metadata.revision
          }),
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })
    ).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })

    expect(await readFile(targetPath, 'utf8')).toContain('外部更新。')
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/)
    ])
    await expect(stat(join(root, '50_履歴', 'AI更新'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('finalizes only the missing receipt when the canonical update already matches', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('# TSUZUNE\n\n復旧済み。\n', 'utf8')
    const intentInput = {
      transactionId: 'shadow-recovery-001',
      target,
      recordedAt: '2026-08-23T00:00:00.000Z',
      previousRevision: 'sha256:fixture',
      previousRecordSha256: null,
      reason: 'recovery fixture',
      sourceRefs: [],
      beforeBytes,
      afterBytes
    }
    const intent = createHistoryIntentV2(intentInput)
    const stem = historyRecordSha256(intent).slice('sha256:'.length)
    const intentPath = join(shadowDirectory, `${stem}.intent.hsv2`)
    await mkdir(shadowDirectory)
    await writeFile(intentPath, encodeHistoryRecordV2(intent))
    await writeFile(targetPath, afterBytes)

    const result = await recoverHistoryShadowReceiptV2({
      historyDirectory: shadowDirectory,
      intentInput,
      readCanonicalBytes: () => readFile(targetPath),
      appliedAt: '2026-08-23T00:00:01.000Z'
    })

    expect(result.intentPath).toBe(intentPath)
    expect(decodeHistoryRecordV2(await readFile(result.receiptPath))).toMatchObject({
      kind: 'commit-receipt',
      intentSha256: historyRecordSha256(intent)
    })
    const firstReceiptBytes = await readFile(result.receiptPath)
    await recoverHistoryShadowReceiptV2({
      historyDirectory: shadowDirectory,
      intentInput,
      readCanonicalBytes: () => readFile(targetPath),
      appliedAt: '2026-08-23T00:00:02.000Z'
    })
    expect(await readFile(result.receiptPath)).toEqual(firstReceiptBytes)
    expect((await shadowFiles()).some((file) => file.endsWith('.tmp'))).toBe(false)
  })

  it('preserves and rejects a partial intent during receipt recovery', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('after', 'utf8')
    const intentInput = {
      transactionId: 'shadow-recovery-partial-001',
      target,
      recordedAt: '2026-08-23T00:00:00.000Z',
      previousRevision: 'sha256:fixture',
      previousRecordSha256: null,
      reason: 'partial fixture',
      sourceRefs: [],
      beforeBytes,
      afterBytes
    }
    const intent = createHistoryIntentV2(intentInput)
    const stem = historyRecordSha256(intent).slice('sha256:'.length)
    const intentPath = join(shadowDirectory, `${stem}.intent.hsv2`)
    await mkdir(shadowDirectory)
    await writeFile(intentPath, 'partial')
    await writeFile(targetPath, afterBytes)

    await expect(
      recoverHistoryShadowReceiptV2({
        historyDirectory: shadowDirectory,
        intentInput,
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })
    ).rejects.toThrow(/existing intent does not match/)

    expect(await readFile(intentPath, 'utf8')).toBe('partial')
    expect(await shadowFiles()).toEqual([expect.stringMatching(/\.intent\.hsv2$/)])
  })

  it('preserves and rejects a partial receipt during idempotent recovery', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('after', 'utf8')
    const intentInput = {
      transactionId: 'shadow-recovery-receipt-001',
      target,
      recordedAt: '2026-08-23T00:00:00.000Z',
      previousRevision: 'sha256:fixture',
      previousRecordSha256: null,
      reason: 'receipt fixture',
      sourceRefs: [],
      beforeBytes,
      afterBytes
    }
    const intent = createHistoryIntentV2(intentInput)
    const stem = historyRecordSha256(intent).slice('sha256:'.length)
    const intentPath = join(shadowDirectory, `${stem}.intent.hsv2`)
    const receiptPath = join(shadowDirectory, `${stem}.receipt.hsv2`)
    await mkdir(shadowDirectory)
    await writeFile(intentPath, encodeHistoryRecordV2(intent))
    await writeFile(receiptPath, 'partial')
    await writeFile(targetPath, afterBytes)

    await expect(
      recoverHistoryShadowReceiptV2({
        historyDirectory: shadowDirectory,
        intentInput,
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      })
    ).rejects.toThrow(/existing receipt does not match/)

    expect(await readFile(receiptPath, 'utf8')).toBe('partial')
  })

  it('converges concurrent receipt recovery to one immutable receipt', async () => {
    const target = 'Projects/TSUZUNE.md'
    const targetPath = join(root, target)
    const beforeBytes = await readFile(targetPath)
    const afterBytes = Buffer.from('after', 'utf8')
    const intentInput = {
      transactionId: 'shadow-concurrent-recovery-001',
      target,
      recordedAt: '2026-08-23T00:00:00.000Z',
      previousRevision: 'sha256:fixture',
      previousRecordSha256: null,
      reason: 'concurrent recovery fixture',
      sourceRefs: [],
      beforeBytes,
      afterBytes
    }
    const intent = createHistoryIntentV2(intentInput)
    const stem = historyRecordSha256(intent).slice('sha256:'.length)
    await mkdir(shadowDirectory)
    await writeFile(
      join(shadowDirectory, `${stem}.intent.hsv2`),
      encodeHistoryRecordV2(intent)
    )
    await writeFile(targetPath, afterBytes)

    const results = await Promise.all([
      recoverHistoryShadowReceiptV2({
        historyDirectory: shadowDirectory,
        intentInput,
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:01.000Z'
      }),
      recoverHistoryShadowReceiptV2({
        historyDirectory: shadowDirectory,
        intentInput,
        readCanonicalBytes: () => readFile(targetPath),
        appliedAt: '2026-08-23T00:00:02.000Z'
      })
    ])

    expect(results[0].receiptPath).toBe(results[1].receiptPath)
    expect(await shadowFiles()).toEqual([
      expect.stringMatching(/\.intent\.hsv2$/),
      expect.stringMatching(/\.receipt\.hsv2$/)
    ])
  })
})
