import { brotliCompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  classifyHistoryCommitV2,
  createHistoryCommitReceiptV2,
  createHistoryIntentV2,
  decodeHistoryRecordV2,
  encodeHistoryRecordV2,
  historyRecordSha256,
  MAX_HISTORY_PAYLOAD_BASE64_CHARS,
  MAX_HISTORY_RECORD_BYTES,
  MAX_HISTORY_SERIALIZED_BYTES,
  restoreHistoryPreviousBytes
} from '../src/mcp/history-store-v2'

function transition(beforeBytes: Uint8Array, afterBytes: Uint8Array) {
  return createHistoryIntentV2({
    transactionId: '018f9f7e-1234-7abc-8def-1234567890ab',
    target: '10_プロジェクト/TSUZUNE.md',
    recordedAt: '2026-08-23T00:00:00.000Z',
    previousRevision: 'sha256:revision-1',
    previousRecordSha256: null,
    reason: '履歴v2 fixture',
    sourceRefs: ['30_知識/source.md'],
    beforeBytes,
    afterBytes
  })
}

describe('TSUZUNE History Store v2', () => {
  it('restores exact previous bytes including BOM, Japanese, emoji, and CRLF', () => {
    const before = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('鈴音🎐\r\n一行目\r\n', 'utf8')
    ])
    const after = Buffer.from('鈴音🎐\n差し替え✨\n', 'utf8')
    const intent = transition(before, after)

    expect(restoreHistoryPreviousBytes(intent)).toEqual(before)

    const decoded = decodeHistoryRecordV2(encodeHistoryRecordV2(intent))
    expect(decoded).toEqual(intent)
    if (decoded.kind !== 'intent') throw new Error('expected an intent record')
    expect(restoreHistoryPreviousBytes(decoded)).toEqual(before)
  })

  it('treats an intent without a matching receipt as unapplied or uncertain', () => {
    const before = Buffer.alloc(0)
    const after = Buffer.from('new\n', 'utf8')
    const intent = transition(before, after)

    expect(classifyHistoryCommitV2(intent, undefined, after)).toEqual({
      status: 'unapplied-or-uncertain'
    })

    const receipt = createHistoryCommitReceiptV2(
      intent,
      after,
      '2026-08-23T00:00:01.000Z'
    )
    const decodedReceipt = decodeHistoryRecordV2(encodeHistoryRecordV2(receipt))
    expect(decodedReceipt).toEqual(receipt)
    expect(classifyHistoryCommitV2(intent, receipt, after)).toEqual({
      status: 'committed'
    })
    expect(restoreHistoryPreviousBytes(intent)).toEqual(before)
  })

  it('rejects a receipt for different observed bytes or a different intent', () => {
    const after = Buffer.from('after', 'utf8')
    const intent = transition(Buffer.from('before', 'utf8'), after)
    const receipt = createHistoryCommitReceiptV2(
      intent,
      after,
      '2026-08-23T00:00:01.000Z'
    )

    expect(() =>
      classifyHistoryCommitV2(intent, receipt, Buffer.from('other', 'utf8'))
    ).toThrow(/observed after hash mismatch/)

    const otherIntent = transition(Buffer.from('different', 'utf8'), after)
    expect(() => classifyHistoryCommitV2(otherIntent, receipt, after)).toThrow(
      /intent hash mismatch/
    )
  })

  it('rejects a valid Brotli payload substituted from another record', () => {
    const intent = transition(Buffer.from('before', 'utf8'), Buffer.from('after'))
    intent.beforePayload.data = brotliCompressSync(
      Buffer.from('different', 'utf8')
    ).toString('base64')

    expect(() => restoreHistoryPreviousBytes(intent)).toThrow(
      /previous bytes hash mismatch/
    )
  })

  it('rejects metadata tampering before serialization', () => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    intent.beforeSizeBytes += 1

    expect(() => encodeHistoryRecordV2(intent)).toThrow(
      /previous bytes hash mismatch/
    )
  })

  it('rejects truncated and unsupported serialized records', () => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    const encoded = encodeHistoryRecordV2(intent)

    expect(() => decodeHistoryRecordV2(encoded.subarray(0, 12))).toThrow(
      /record is truncated/
    )

    const unsupported = { ...intent, version: 3 }
    expect(() =>
      decodeHistoryRecordV2(
        Buffer.from(`TSUZUNE-HISTORY-V2\n${JSON.stringify(unsupported)}`, 'utf8')
      )
    ).toThrow(/version is unsupported/)
  })

  it('rejects a payload that expands beyond the supported record size', () => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    intent.beforePayload.data = brotliCompressSync(
      Buffer.alloc(MAX_HISTORY_RECORD_BYTES + 1)
    ).toString('base64')

    expect(() => restoreHistoryPreviousBytes(intent)).toThrow(
      /payload is corrupt or too large/
    )
  })

  it.each([
    [
      'invalid header',
      Buffer.from('NOT-TSUZUNE-HISTORY-V2\n{}'),
      /header is invalid/
    ],
    [
      'invalid JSON',
      Buffer.from('TSUZUNE-HISTORY-V2\n{'),
      /record JSON is invalid/
    ],
    [
      'non-object JSON',
      Buffer.from('TSUZUNE-HISTORY-V2\n[]'),
      /record is invalid/
    ],
    [
      'unsupported kind',
      Buffer.from(
        `TSUZUNE-HISTORY-V2\n${JSON.stringify({
          ...transition(Buffer.from('before'), Buffer.from('after')),
          kind: 'unknown'
        })}`
      ),
      /record kind is unsupported/
    ],
    [
      'malformed Brotli',
      Buffer.from(
        `TSUZUNE-HISTORY-V2\n${JSON.stringify({
          ...transition(Buffer.from('before'), Buffer.from('after')),
          beforePayload: { codec: 'brotli-base64', data: 'bm90LWJyb3RsaQ==' }
        })}`
      ),
      /payload is corrupt or too large/
    ]
  ])('rejects malformed serialized input: %s', (_label, encoded, error) => {
    expect(() => decodeHistoryRecordV2(encoded)).toThrow(error)
  })

  it('rejects tampered receipt and after-state metadata', () => {
    const after = Buffer.from('after')
    const intent = transition(Buffer.from('before'), after)
    const receipt = createHistoryCommitReceiptV2(
      intent,
      after,
      '2026-08-23T00:00:01.000Z'
    )

    const tamperedReceipt = {
      ...receipt,
      intentSha256: `sha256:${'0'.repeat(64)}`
    }
    expect(() => classifyHistoryCommitV2(intent, tamperedReceipt, after)).toThrow(
      /receipt intent hash mismatch/
    )

    const tamperedIntent = {
      ...intent,
      afterSha256: `sha256:${'0'.repeat(64)}`
    }
    expect(() => classifyHistoryCommitV2(tamperedIntent, receipt, after)).toThrow(
      /receipt intent hash mismatch/
    )
  })

  it('validates target, chain reference, and receipt chronology', () => {
    expect(() =>
      createHistoryIntentV2({
        transactionId: 'tx',
        target: '../outside.md',
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'revision',
        previousRecordSha256: null,
        reason: 'fixture',
        sourceRefs: [],
        beforeBytes: Buffer.alloc(0),
        afterBytes: Buffer.alloc(0)
      })
    ).toThrow(/target is invalid/)

    expect(() =>
      createHistoryIntentV2({
        transactionId: 'tx',
        target: 'note.md',
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'revision',
        previousRecordSha256: 'not-a-hash',
        reason: 'fixture',
        sourceRefs: [],
        beforeBytes: Buffer.alloc(0),
        afterBytes: Buffer.alloc(0)
      })
    ).toThrow(/previousRecordSha256 is invalid/)

    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    expect(() =>
      createHistoryCommitReceiptV2(
        intent,
        Buffer.from('after'),
        '2026-08-22T23:59:59.000Z'
      )
    ).toThrow(/appliedAt precedes recordedAt/)
  })

  it('round-trips an empty-to-empty transition and keeps intent-only state uncertain', () => {
    const intent = transition(Buffer.alloc(0), Buffer.alloc(0))
    const decoded = decodeHistoryRecordV2(encodeHistoryRecordV2(intent))
    if (decoded.kind !== 'intent') throw new Error('expected an intent record')

    expect(restoreHistoryPreviousBytes(decoded)).toEqual(Buffer.alloc(0))
    for (const observed of [Buffer.alloc(0), Buffer.from('unrelated')]) {
      expect(classifyHistoryCommitV2(decoded, undefined, observed)).toEqual({
        status: 'unapplied-or-uncertain'
      })
    }
  })

  it.each([
    ['leading JSON whitespace', (json: string) => ` ${json}`],
    ['trailing JSON whitespace', (json: string) => `${json} `],
    [
      'duplicate key',
      (json: string) => json.replace('{', '{"format":"tsuzune-history-store-v2",')
    ]
  ])('rejects non-canonical serialized intent bytes: %s', (_label, mutate) => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    const json = encodeHistoryRecordV2(intent)
      .subarray(Buffer.byteLength('TSUZUNE-HISTORY-V2\n'))
      .toString('utf8')
    const encoded = Buffer.from(`TSUZUNE-HISTORY-V2\n${mutate(json)}`, 'utf8')

    expect(() => decodeHistoryRecordV2(encoded)).toThrow(
      /record encoding is not canonical/
    )
  })

  it('rejects unknown fields and invalid UTF-8 in serialized records', () => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    expect(() =>
      encodeHistoryRecordV2({ ...intent, unknown: true } as typeof intent)
    ).toThrow(/intent fields are invalid/)

    const encoded = encodeHistoryRecordV2(intent)
    encoded[encoded.length - 2] = 0xff
    expect(() => decodeHistoryRecordV2(encoded)).toThrow(
      /record JSON is invalid|record encoding is not canonical/
    )
  })

  it('rejects chronology tampering even when the receipt bypasses the factory', () => {
    const after = Buffer.from('after')
    const intent = transition(Buffer.from('before'), after)
    const receipt = createHistoryCommitReceiptV2(
      intent,
      after,
      '2026-08-23T00:00:01.000Z'
    )

    expect(() =>
      classifyHistoryCommitV2(
        intent,
        { ...receipt, appliedAt: '2026-08-22T23:59:59.000Z' },
        after
      )
    ).toThrow(/appliedAt precedes recordedAt/)
  })

  it('rejects oversized serialized and compressed inputs before decoding them', () => {
    expect(() =>
      decodeHistoryRecordV2(Buffer.alloc(MAX_HISTORY_SERIALIZED_BYTES + 1))
    ).toThrow(/serialized record is too large/)

    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    intent.beforePayload.data = 'A'.repeat(MAX_HISTORY_PAYLOAD_BASE64_CHARS + 1)
    expect(() => restoreHistoryPreviousBytes(intent)).toThrow(
      /compressed payload is too large/
    )
  })

  it('bounds provenance and target metadata', () => {
    expect(() =>
      createHistoryIntentV2({
        transactionId: 'tx',
        target: `${'a'.repeat(1022)}.md`,
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'revision',
        previousRecordSha256: null,
        reason: 'fixture',
        sourceRefs: [],
        beforeBytes: Buffer.alloc(0),
        afterBytes: Buffer.alloc(0)
      })
    ).toThrow(/target is invalid/)

    expect(() =>
      createHistoryIntentV2({
        transactionId: 'tx',
        target: 'note.md',
        recordedAt: '2026-08-23T00:00:00.000Z',
        previousRevision: 'revision',
        previousRecordSha256: null,
        reason: 'x'.repeat(4097),
        sourceRefs: [],
        beforeBytes: Buffer.alloc(0),
        afterBytes: Buffer.alloc(0)
      })
    ).toThrow(/provenance is invalid/)
  })

  it('uses one fixed field order for encoding and hashing', () => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    const reversed = Object.fromEntries(Object.entries(intent).reverse()) as typeof intent
    const reorderedBytes = Buffer.from(
      `TSUZUNE-HISTORY-V2\n${JSON.stringify(reversed)}`,
      'utf8'
    )

    expect(() => decodeHistoryRecordV2(reorderedBytes)).toThrow(
      /record encoding is not canonical/
    )
    expect(encodeHistoryRecordV2(reversed)).toEqual(encodeHistoryRecordV2(intent))
    expect(historyRecordSha256(reversed)).toBe(historyRecordSha256(intent))
  })

  it.each(['!', ' ', '==='])('rejects non-canonical base64 suffix %j', (suffix) => {
    const intent = transition(Buffer.from('before'), Buffer.from('after'))
    intent.beforePayload.data += suffix

    expect(() => restoreHistoryPreviousBytes(intent)).toThrow(
      /payload base64 is invalid/
    )
  })
})
