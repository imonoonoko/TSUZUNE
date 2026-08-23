import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import {
  classifyHistoryCommitV2,
  createHistoryCommitReceiptV2,
  createHistoryIntentV2,
  decodeHistoryRecordV2,
  encodeHistoryRecordV2,
  historyRecordSha256,
  type HistoryIntentInputV2
} from './history-store-v2'

export interface HistoryShadowUpdateInputV2<T> {
  historyDirectory: string
  intentInput: HistoryIntentInputV2
  applyCanonicalUpdate: () => Promise<T>
  readCanonicalBytes: () => Promise<Uint8Array>
  appliedAt: string
  failpoint?: (stage: 'preflight' | 'intent' | 'receipt') => void | Promise<void>
}

export interface HistoryShadowUpdateResultV2<T> {
  intentPath: string
  receiptPath: string
  updateResult: T
  v2Status: 'committed' | 'pending-recovery'
  pendingReason?: string
}

export interface HistoryShadowReceiptRecoveryInputV2 {
  historyDirectory: string
  intentInput: HistoryIntentInputV2
  readCanonicalBytes: () => Promise<Uint8Array>
  appliedAt: string
}

export async function runHistoryShadowUpdateV2<T>(
  input: HistoryShadowUpdateInputV2<T>
): Promise<HistoryShadowUpdateResultV2<T>> {
  const intent = createHistoryIntentV2(input.intentInput)
  const stem = historyRecordSha256(intent).slice('sha256:'.length)
  const intentPath = join(input.historyDirectory, `${stem}.intent.hsv2`)
  const receiptPath = join(input.historyDirectory, `${stem}.receipt.hsv2`)

  await mkdir(input.historyDirectory, { recursive: true })
  await preflightHistoryShadowDirectoryV2(input.historyDirectory, input.failpoint)
  await input.failpoint?.('intent')
  await writeImmutable(intentPath, encodeHistoryRecordV2(intent))

  const updateResult = await input.applyCanonicalUpdate()
  try {
    const observedAfterBytes = await input.readCanonicalBytes()
    const receipt = createHistoryCommitReceiptV2(
      intent,
      observedAfterBytes,
      input.appliedAt
    )
    await input.failpoint?.('receipt')
    await writeImmutable(receiptPath, encodeHistoryRecordV2(receipt))
  } catch (error) {
    return {
      intentPath,
      receiptPath,
      updateResult,
      v2Status: 'pending-recovery',
      pendingReason:
        error instanceof Error
          ? error.message
          : 'Unknown History Store v2 shadow failure'
    }
  }

  return {
    intentPath,
    receiptPath,
    updateResult,
    v2Status: 'committed'
  }
}

async function preflightHistoryShadowDirectoryV2(
  historyDirectory: string,
  failpoint?: HistoryShadowUpdateInputV2<unknown>['failpoint']
): Promise<void> {
  const path = join(historyDirectory, `.preflight-${randomUUID()}.hsv2`)
  try {
    await failpoint?.('preflight')
    await writeImmutable(path, Buffer.from('history-store-v2-preflight'))
  } finally {
    await unlink(path).catch(() => undefined)
  }
}

export async function recoverHistoryShadowReceiptV2(
  input: HistoryShadowReceiptRecoveryInputV2
): Promise<{ intentPath: string; receiptPath: string }> {
  const intent = createHistoryIntentV2(input.intentInput)
  const stem = historyRecordSha256(intent).slice('sha256:'.length)
  const intentPath = join(input.historyDirectory, `${stem}.intent.hsv2`)
  const receiptPath = join(input.historyDirectory, `${stem}.receipt.hsv2`)
  const expectedIntentBytes = encodeHistoryRecordV2(intent)
  const existingIntentBytes = await readFile(intentPath)

  if (!existingIntentBytes.equals(expectedIntentBytes)) {
    throw new Error('History Store v2 existing intent does not match')
  }

  const observedAfterBytes = await input.readCanonicalBytes()
  const existingReceiptBytes = await readFile(receiptPath).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  })
  if (existingReceiptBytes) {
    validateExistingReceipt(intent, existingReceiptBytes, observedAfterBytes)
    return { intentPath, receiptPath }
  }

  const receipt = createHistoryCommitReceiptV2(
    intent,
    observedAfterBytes,
    input.appliedAt
  )
  const receiptBytes = encodeHistoryRecordV2(receipt)
  try {
    await writeImmutable(receiptPath, receiptBytes)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    validateExistingReceipt(intent, await readFile(receiptPath), observedAfterBytes)
  }

  return { intentPath, receiptPath }
}

function validateExistingReceipt(
  intent: ReturnType<typeof createHistoryIntentV2>,
  receiptBytes: Uint8Array,
  observedAfterBytes: Uint8Array
): void {
  try {
    const receipt = decodeHistoryRecordV2(receiptBytes)
    if (receipt.kind !== 'commit-receipt') throw new Error()
    classifyHistoryCommitV2(intent, receipt, observedAfterBytes)
  } catch {
    throw new Error('History Store v2 existing receipt does not match')
  }
}

async function writeImmutable(path: string, bytes: Uint8Array): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  const handle = await open(temporaryPath, 'wx')
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } catch (error) {
    await handle.close()
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
  await handle.close()
  try {
    await link(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}
