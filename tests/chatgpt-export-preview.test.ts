import { describe, expect, it } from 'vitest'
import {
  resolveAttachmentIndex,
  type IndexedAttachmentEntry
} from '../src/cli/chatgpt-export-preview'

const archiveA = 'a'.repeat(64)
const archiveB = 'b'.repeat(64)

function entry(
  entryBaseName: string,
  entryIndex: number,
  selectedSha256 = archiveA,
  directory = 'files'
): IndexedAttachmentEntry {
  return {
    selectedPath: `C:/anonymous/${selectedSha256.slice(0, 1)}.zip`,
    selectedSha256,
    entryPath: `${directory}/${entryBaseName}`,
    entryBaseName,
    entryIndex,
    entrySize: 10 + entryIndex,
    entrySha256: entryIndex.toString(16).padStart(64, '0')
  }
}

describe('ChatGPT export attachment preview', () => {
  it('uses exact provider IDs and partitions resolved and unreferenced entries', () => {
    const plainId = 'file_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const serviceId = 'file-ABCDEFGHIJKLMNOPQRSTUV'
    const sedimentId = 'file_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const ambiguousId = 'file_cccccccccccccccccccccccccccccccc'
    const missingId = 'file_dddddddddddddddddddddddddddddddd'
    const caseMismatchId = 'file-abcdefghijklmnopqrstuv'
    const entries = [
      entry(`${plainId}.dat`, 1),
      entry(`${serviceId}.dat`, 2),
      entry(`${sedimentId}.dat`, 3),
      entry(`${ambiguousId}.dat`, 4),
      entry(`${ambiguousId}.dat`, 1, archiveB),
      entry('unreferenced-file.dat', 5),
      entry('prefix-file-substring.dat', 6)
    ]
    const messages = [
      {
        attachmentRefs: [
          plainId,
          `file-service://${serviceId}`,
          `sediment://${sedimentId}`,
          missingId,
          ambiguousId,
          caseMismatchId,
          `https://${plainId}`,
          'file-service://file%2Dencoded',
          'file-substring'
        ]
      },
      { attachmentRefs: [plainId] }
    ]

    const result = resolveAttachmentIndex(messages, entries)
    const byReference = new Map(
      result.attachmentReferences.map((reference) => [
        reference.reference,
        reference
      ])
    )

    expect(byReference.get(plainId)).toMatchObject({
      expectedEntryBaseName: `${plainId}.dat`,
      status: 'resolved',
      occurrenceCount: 2
    })
    expect(byReference.get(`file-service://${serviceId}`)?.status).toBe(
      'resolved'
    )
    expect(byReference.get(`sediment://${sedimentId}`)?.status).toBe(
      'resolved'
    )
    expect(byReference.get(missingId)?.status).toBe('missing')
    expect(byReference.get(ambiguousId)).toMatchObject({
      status: 'ambiguous',
      matchedEntryIds: expect.arrayContaining([
        expect.stringMatching(/^chatgpt_attachment_/),
        expect.stringMatching(/^chatgpt_attachment_/)
      ])
    })
    expect(byReference.get(caseMismatchId)?.status).toBe('missing')
    expect(byReference.get(`https://${plainId}`)?.status).toBe('unsupported')
    expect(byReference.get('file-service://file%2Dencoded')?.status).toBe(
      'unsupported'
    )
    expect(byReference.get('file-substring')?.status).toBe('unsupported')
    expect(result.stats).toEqual({
      attachmentEntryCount: 7,
      attachmentReferenceCount: 9,
      resolvedAttachmentReferenceCount: 3,
      missingAttachmentReferenceCount: 2,
      ambiguousAttachmentReferenceCount: 1,
      unsupportedAttachmentReferenceCount: 3,
      resolvedAttachmentEntryCount: 3,
      unreferencedAttachmentEntryCount: 4
    })
    expect(result.resolvedAttachmentEntryIds).toHaveLength(3)
    expect(result.unreferencedAttachmentEntryIds).toHaveLength(4)
    expect(result.warnings).toHaveLength(6)
  })

  it('is deterministic for the same anonymous index', () => {
    const id = 'file_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    const entries = [entry(`${id}.dat`, 1)]
    const messages = [{ attachmentRefs: [id] }]

    expect(resolveAttachmentIndex(messages, entries)).toEqual(
      resolveAttachmentIndex(messages, entries)
    )
  })

  it('does not normalize opaque references before exact resolution', () => {
    const id = 'file_ffffffffffffffffffffffffffffffff'
    const result = resolveAttachmentIndex(
      [{ attachmentRefs: [` ${id} `, '   '] }],
      [entry(`${id}.dat`, 1)]
    )

    expect(result.attachmentReferences).toEqual([
      expect.objectContaining({
        reference: '   ',
        expectedEntryBaseName: null,
        status: 'unsupported'
      }),
      expect.objectContaining({
        reference: ` ${id} `,
        expectedEntryBaseName: null,
        status: 'unsupported'
      })
    ])
    expect(result.stats.resolvedAttachmentReferenceCount).toBe(0)
    expect(result.stats.unsupportedAttachmentReferenceCount).toBe(2)
  })
})
