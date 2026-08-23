import { createHash } from 'node:crypto'
import {
  brotliCompressSync,
  brotliDecompressSync,
  constants as zlibConstants
} from 'node:zlib'

const FORMAT = 'tsuzune-history-store-v2' as const
const VERSION = 2 as const
const MAGIC = Buffer.from('TSUZUNE-HISTORY-V2\n', 'utf8')
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export const MAX_HISTORY_RECORD_BYTES = 16 * 1024 * 1024
export const MAX_HISTORY_SERIALIZED_BYTES = 24 * 1024 * 1024
export const MAX_HISTORY_PAYLOAD_BASE64_CHARS =
  Math.ceil((MAX_HISTORY_RECORD_BYTES * 4) / 3) + 1024

const MAX_TARGET_CHARS = 1024
const MAX_PREVIOUS_REVISION_CHARS = 1024
const MAX_REASON_CHARS = 4096
const MAX_SOURCE_REFS = 64
const MAX_SOURCE_REF_CHARS = 1024
const MAX_DATE_CHARS = 64

const INTENT_FIELDS = [
  'format',
  'version',
  'kind',
  'transactionId',
  'target',
  'recordedAt',
  'previousRevision',
  'previousRecordSha256',
  'reason',
  'sourceRefs',
  'beforeSha256',
  'beforeSizeBytes',
  'afterSha256',
  'afterSizeBytes',
  'beforePayload'
] as const

const RECEIPT_FIELDS = [
  'format',
  'version',
  'kind',
  'transactionId',
  'intentSha256',
  'target',
  'appliedAt',
  'afterSha256',
  'afterSizeBytes'
] as const

interface CompressedPayload {
  codec: 'brotli-base64'
  data: string
}

export interface HistoryIntentInputV2 {
  transactionId: string
  target: string
  recordedAt: string
  previousRevision: string
  previousRecordSha256: string | null
  reason: string
  sourceRefs: string[]
  beforeBytes: Uint8Array
  afterBytes: Uint8Array
}

export interface HistoryIntentV2 {
  format: typeof FORMAT
  version: 2
  kind: 'intent'
  transactionId: string
  target: string
  recordedAt: string
  previousRevision: string
  previousRecordSha256: string | null
  reason: string
  sourceRefs: string[]
  beforeSha256: string
  beforeSizeBytes: number
  afterSha256: string
  afterSizeBytes: number
  beforePayload: CompressedPayload
}

export interface HistoryCommitReceiptV2 {
  format: typeof FORMAT
  version: 2
  kind: 'commit-receipt'
  transactionId: string
  intentSha256: string
  target: string
  appliedAt: string
  afterSha256: string
  afterSizeBytes: number
}

export type HistoryRecordV2 = HistoryIntentV2 | HistoryCommitReceiptV2

export type HistoryCommitClassification =
  | { status: 'unapplied-or-uncertain' }
  | { status: 'committed' }

export function createHistoryIntentV2(
  input: HistoryIntentInputV2
): HistoryIntentV2 {
  assertTransactionId(input.transactionId)
  assertTarget(input.target)
  const recordedAt = normalizeDate(input.recordedAt, 'recordedAt')
  if (!input.previousRevision.trim()) {
    throw new Error('History Store v2 previousRevision is required')
  }
  if (
    input.previousRecordSha256 !== null &&
    !SHA256_PATTERN.test(input.previousRecordSha256)
  ) {
    throw new Error('History Store v2 previousRecordSha256 is invalid')
  }
  assertProvenance(input.reason, input.sourceRefs)
  const before = checkedBytes(input.beforeBytes, 'before')
  const after = checkedBytes(input.afterBytes, 'after')

  return {
    format: FORMAT,
    version: VERSION,
    kind: 'intent',
    transactionId: input.transactionId,
    target: input.target,
    recordedAt,
    previousRevision: input.previousRevision,
    previousRecordSha256: input.previousRecordSha256,
    reason: input.reason,
    sourceRefs: [...input.sourceRefs],
    beforeSha256: sha256Bytes(before),
    beforeSizeBytes: before.length,
    afterSha256: sha256Bytes(after),
    afterSizeBytes: after.length,
    beforePayload: compress(before)
  }
}

export function createHistoryCommitReceiptV2(
  intent: HistoryIntentV2,
  observedAfterBytes: Uint8Array,
  appliedAt: string
): HistoryCommitReceiptV2 {
  validateIntent(intent)
  const observed = checkedBytes(observedAfterBytes, 'observed after')
  assertObservedAfter(intent, observed)
  const normalizedAppliedAt = normalizeDate(appliedAt, 'appliedAt')
  assertReceiptChronology(intent.recordedAt, normalizedAppliedAt)
  return {
    format: FORMAT,
    version: VERSION,
    kind: 'commit-receipt',
    transactionId: intent.transactionId,
    intentSha256: historyRecordSha256(intent),
    target: intent.target,
    appliedAt: normalizedAppliedAt,
    afterSha256: intent.afterSha256,
    afterSizeBytes: intent.afterSizeBytes
  }
}

export function classifyHistoryCommitV2(
  intent: HistoryIntentV2,
  receipt: HistoryCommitReceiptV2 | undefined,
  observedAfterBytes: Uint8Array
): HistoryCommitClassification {
  validateIntent(intent)
  if (!receipt) return { status: 'unapplied-or-uncertain' }
  validateReceipt(receipt)
  assertReceiptChronology(intent.recordedAt, receipt.appliedAt)
  if (receipt.transactionId !== intent.transactionId) {
    throw new Error('History Store v2 receipt transaction mismatch')
  }
  if (receipt.target !== intent.target) {
    throw new Error('History Store v2 receipt target mismatch')
  }
  if (receipt.intentSha256 !== historyRecordSha256(intent)) {
    throw new Error('History Store v2 receipt intent hash mismatch')
  }
  if (
    receipt.afterSha256 !== intent.afterSha256 ||
    receipt.afterSizeBytes !== intent.afterSizeBytes
  ) {
    throw new Error('History Store v2 receipt after state mismatch')
  }
  assertObservedAfter(intent, checkedBytes(observedAfterBytes, 'observed after'))
  return { status: 'committed' }
}

export function restoreHistoryPreviousBytes(intent: HistoryIntentV2): Buffer {
  validateIntentShape(intent)
  const previous = decompress(intent.beforePayload)
  if (
    previous.length !== intent.beforeSizeBytes ||
    sha256Bytes(previous) !== intent.beforeSha256
  ) {
    throw new Error('History Store v2 previous bytes hash mismatch')
  }
  return previous
}

export function encodeHistoryRecordV2(record: HistoryRecordV2): Buffer {
  validateRecord(record)
  const canonical = canonicalizeRecord(record)
  return Buffer.concat([MAGIC, Buffer.from(JSON.stringify(canonical), 'utf8')])
}

export function decodeHistoryRecordV2(bytes: Uint8Array): HistoryRecordV2 {
  if (bytes.byteLength > MAX_HISTORY_SERIALIZED_BYTES) {
    throw new Error('History Store v2 serialized record is too large')
  }
  const encoded = Buffer.from(bytes)
  if (encoded.length <= MAGIC.length) {
    throw new Error('History Store v2 record is truncated')
  }
  if (!encoded.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('History Store v2 record header is invalid')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(encoded.subarray(MAGIC.length).toString('utf8'))
  } catch {
    throw new Error('History Store v2 record JSON is invalid')
  }
  if (!isObject(parsed)) {
    throw new Error('History Store v2 record is invalid')
  }
  if (parsed.format !== FORMAT || parsed.version !== VERSION) {
    throw new Error('History Store v2 record version is unsupported')
  }
  const record = parsed as unknown as HistoryRecordV2
  validateRecord(record)
  const canonicalRecord = canonicalizeRecord(record)
  const canonicalBytes = Buffer.concat([
    MAGIC,
    Buffer.from(JSON.stringify(canonicalRecord), 'utf8')
  ])
  if (!encoded.equals(canonicalBytes)) {
    throw new Error('History Store v2 record encoding is not canonical')
  }
  return canonicalRecord
}

export function historyRecordSha256(record: HistoryRecordV2): string {
  return sha256Bytes(encodeHistoryRecordV2(record))
}

function validateRecord(record: HistoryRecordV2): void {
  if (record.format !== FORMAT || record.version !== VERSION) {
    throw new Error('History Store v2 record version is unsupported')
  }
  if (record.kind === 'intent') {
    validateIntent(record)
    return
  }
  if (record.kind === 'commit-receipt') {
    validateReceipt(record)
    return
  }
  throw new Error('History Store v2 record kind is unsupported')
}

function validateIntent(intent: HistoryIntentV2): void {
  validateIntentShape(intent)
  restoreHistoryPreviousBytes(intent)
}

function validateIntentShape(intent: HistoryIntentV2): void {
  if (intent.format !== FORMAT || intent.version !== VERSION || intent.kind !== 'intent') {
    throw new Error('History Store v2 intent is invalid')
  }
  assertExactFields(intent, INTENT_FIELDS, 'intent')
  assertTransactionId(intent.transactionId)
  assertTarget(intent.target)
  normalizeDate(intent.recordedAt, 'recordedAt')
  if (
    !intent.previousRevision ||
    typeof intent.previousRevision !== 'string' ||
    intent.previousRevision.length > MAX_PREVIOUS_REVISION_CHARS
  ) {
    throw new Error('History Store v2 previousRevision is invalid')
  }
  if (
    intent.previousRecordSha256 !== null &&
    !SHA256_PATTERN.test(intent.previousRecordSha256)
  ) {
    throw new Error('History Store v2 previousRecordSha256 is invalid')
  }
  assertProvenance(intent.reason, intent.sourceRefs)
  assertHashAndSize(intent.beforeSha256, intent.beforeSizeBytes, 'before')
  assertHashAndSize(intent.afterSha256, intent.afterSizeBytes, 'after')
  if (!isObject(intent.beforePayload)) {
    throw new Error('History Store v2 before payload is invalid')
  }
  assertExactFields(intent.beforePayload, ['codec', 'data'], 'payload')
}

function validateReceipt(receipt: HistoryCommitReceiptV2): void {
  if (
    receipt.format !== FORMAT ||
    receipt.version !== VERSION ||
    receipt.kind !== 'commit-receipt'
  ) {
    throw new Error('History Store v2 receipt is invalid')
  }
  assertExactFields(receipt, RECEIPT_FIELDS, 'receipt')
  assertTransactionId(receipt.transactionId)
  assertTarget(receipt.target)
  normalizeDate(receipt.appliedAt, 'appliedAt')
  if (!SHA256_PATTERN.test(receipt.intentSha256)) {
    throw new Error('History Store v2 receipt intent hash is invalid')
  }
  assertHashAndSize(receipt.afterSha256, receipt.afterSizeBytes, 'receipt after')
}

function assertObservedAfter(intent: HistoryIntentV2, observed: Buffer): void {
  if (
    observed.length !== intent.afterSizeBytes ||
    sha256Bytes(observed) !== intent.afterSha256
  ) {
    throw new Error('History Store v2 observed after hash mismatch')
  }
}

function assertHashAndSize(hash: string, size: number, label: string): void {
  if (!SHA256_PATTERN.test(hash)) {
    throw new Error(`History Store v2 ${label} hash is invalid`)
  }
  if (!Number.isInteger(size) || size < 0 || size > MAX_HISTORY_RECORD_BYTES) {
    throw new Error(`History Store v2 ${label} size is invalid`)
  }
}

function assertTransactionId(transactionId: string): void {
  if (!transactionId || typeof transactionId !== 'string' || transactionId.length > 128) {
    throw new Error('History Store v2 transactionId is invalid')
  }
}

function assertProvenance(reason: string, sourceRefs: string[]): void {
  if (
    !Array.isArray(sourceRefs) ||
    sourceRefs.length > MAX_SOURCE_REFS ||
    sourceRefs.some(
      (sourceRef) =>
        typeof sourceRef !== 'string' ||
        sourceRef.length > MAX_SOURCE_REF_CHARS
    ) ||
    typeof reason !== 'string' ||
    reason.length > MAX_REASON_CHARS
  ) {
    throw new Error('History Store v2 provenance is invalid')
  }
}

function assertTarget(target: string): void {
  if (typeof target !== 'string' || target.length > MAX_TARGET_CHARS) {
    throw new Error('History Store v2 target is invalid')
  }
  const normalized = target.replaceAll('\\', '/')
  const segments = target.split('/')
  if (
    !target ||
    target !== normalized ||
    target.startsWith('/') ||
    /^[a-zA-Z]:/.test(target) ||
    target.includes('\0') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..') ||
    !target.toLowerCase().endsWith('.md')
  ) {
    throw new Error('History Store v2 target is invalid')
  }
}

function checkedBytes(bytes: Uint8Array, label: string): Buffer {
  const value = Buffer.from(bytes)
  if (value.length > MAX_HISTORY_RECORD_BYTES) {
    throw new Error(`History Store v2 ${label} bytes exceed the supported size`)
  }
  return value
}

function compress(value: Buffer): CompressedPayload {
  return {
    codec: 'brotli-base64',
    data: brotliCompressSync(value, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 }
    }).toString('base64')
  }
}

function decompress(payload: CompressedPayload): Buffer {
  if (payload.codec !== 'brotli-base64' || typeof payload.data !== 'string') {
    throw new Error('History Store v2 payload codec is invalid')
  }
  if (payload.data.length > MAX_HISTORY_PAYLOAD_BASE64_CHARS) {
    throw new Error('History Store v2 compressed payload is too large')
  }
  if (!BASE64_PATTERN.test(payload.data)) {
    throw new Error('History Store v2 payload base64 is invalid')
  }
  try {
    const compressed = Buffer.from(payload.data, 'base64')
    if (compressed.toString('base64') !== payload.data) {
      throw new Error('History Store v2 payload base64 is invalid')
    }
    const value = brotliDecompressSync(compressed, {
      maxOutputLength: MAX_HISTORY_RECORD_BYTES + 1
    })
    if (value.length > MAX_HISTORY_RECORD_BYTES) {
      throw new Error('History Store v2 payload is corrupt or too large')
    }
    return value
  } catch {
    throw new Error('History Store v2 payload is corrupt or too large')
  }
}

function normalizeDate(value: string, label: string): string {
  if (typeof value !== 'string' || value.length > MAX_DATE_CHARS) {
    throw new Error(`History Store v2 ${label} is invalid`)
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`History Store v2 ${label} is invalid`)
  }
  return new Date(timestamp).toISOString()
}

function sha256Bytes(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertReceiptChronology(recordedAt: string, appliedAt: string): void {
  if (Date.parse(appliedAt) < Date.parse(recordedAt)) {
    throw new Error('History Store v2 appliedAt precedes recordedAt')
  }
}

function assertExactFields(
  value: object,
  expectedFields: readonly string[],
  label: string
): void {
  const actual = Object.keys(value).sort()
  const expected = [...expectedFields].sort()
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw new Error(`History Store v2 ${label} fields are invalid`)
  }
}

function canonicalizeRecord(record: HistoryRecordV2): HistoryRecordV2 {
  if (record.kind === 'intent') {
    return {
      format: record.format,
      version: record.version,
      kind: record.kind,
      transactionId: record.transactionId,
      target: record.target,
      recordedAt: normalizeDate(record.recordedAt, 'recordedAt'),
      previousRevision: record.previousRevision,
      previousRecordSha256: record.previousRecordSha256,
      reason: record.reason,
      sourceRefs: [...record.sourceRefs],
      beforeSha256: record.beforeSha256,
      beforeSizeBytes: record.beforeSizeBytes,
      afterSha256: record.afterSha256,
      afterSizeBytes: record.afterSizeBytes,
      beforePayload: {
        codec: record.beforePayload.codec,
        data: record.beforePayload.data
      }
    }
  }
  return {
    format: record.format,
    version: record.version,
    kind: record.kind,
    transactionId: record.transactionId,
    intentSha256: record.intentSha256,
    target: record.target,
    appliedAt: normalizeDate(record.appliedAt, 'appliedAt'),
    afterSha256: record.afterSha256,
    afterSizeBytes: record.afterSizeBytes
  }
}
