import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  DriveSyncApplyResult,
  DriveSyncPreview,
  DriveSyncPreviewOptions
} from '../shared/types'
import type {
  EntryMoveApplyInput,
  EntryMovePlan,
  EntryMoveResult
} from './entry-move'

interface BridgeState {
  version: 1
  origin: string
  token: string
}

export interface DriveSyncBridge {
  close(): Promise<void>
}

export interface DriveSyncBridgeOptions {
  statePath: string
  preview(options?: DriveSyncPreviewOptions): Promise<DriveSyncPreview>
  apply(planId: string): Promise<DriveSyncApplyResult>
  preflightMoveEntry?(source: string, destination: string): Promise<EntryMovePlan>
  moveEntry?(input: EntryMoveApplyInput): Promise<EntryMoveResult>
}

function respond(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readPlanId(request: IncomingMessage): Promise<string> {
  const parsed = await readJson(request)
  if (typeof parsed.planId !== 'string' || !parsed.planId.trim()) {
    throw new Error('plan_idを指定してください。')
  }
  return parsed.planId
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk.toString()
    if (raw.length > 20_000) throw new Error('要求が大きすぎます。')
  }
  const parsed = JSON.parse(raw || '{}') as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('要求の形式が不正です。')
  }
  return parsed as Record<string, unknown>
}

export async function startDriveSyncBridge(
  options: DriveSyncBridgeOptions
): Promise<DriveSyncBridge> {
  const token = randomBytes(32).toString('hex')
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      respond(response, 401, { error: '同期要求を認証できません。' })
      return
    }
    if (request.method !== 'POST') {
      respond(response, 405, { error: 'POSTだけを受け付けます。' })
      return
    }

    try {
      if (request.url === '/preview') {
        const body = await readJson(request)
        const previewOptions: DriveSyncPreviewOptions = {}
        for (const key of ['propagateLocalDeletion', 'propagateRemoteDeletion', 'forceFull'] as const) {
          if (body[key] !== undefined && typeof body[key] !== 'boolean') {
            throw new Error(`${key}はbooleanで指定してください。`)
          }
          if (body[key] !== undefined) previewOptions[key] = body[key] as boolean
        }
        respond(response, 200, await options.preview(previewOptions))
        return
      }
      if (request.url === '/apply') {
        respond(response, 200, await options.apply(await readPlanId(request)))
        return
      }
      if (request.url === '/entry-move/preflight' && options.preflightMoveEntry) {
        const body = await readJson(request)
        if (typeof body.source !== 'string' || typeof body.destination !== 'string') {
          throw new Error('sourceとdestinationを指定してください。')
        }
        respond(
          response,
          200,
          await options.preflightMoveEntry(body.source, body.destination)
        )
        return
      }
      if (request.url === '/entry-move/apply' && options.moveEntry) {
        const body = await readJson(request)
        if (
          typeof body.source !== 'string' ||
          typeof body.destination !== 'string' ||
          typeof body.expected_fingerprint !== 'string' ||
          typeof body.reason !== 'string' ||
          !Array.isArray(body.source_refs) ||
          !body.source_refs.every((value) => typeof value === 'string')
        ) {
          throw new Error('move_entry要求の形式が不正です。')
        }
        respond(
          response,
          200,
          await options.moveEntry({
            source: body.source,
            destination: body.destination,
            expected_fingerprint: body.expected_fingerprint,
            actor: 'ai',
            reason: body.reason,
            source_refs: body.source_refs as string[]
          })
        )
        return
      }
      respond(response, 404, { error: '同期操作が見つかりません。' })
    } catch (error) {
      respond(response, 400, {
        error: error instanceof Error ? error.message : 'Drive同期に失敗しました。'
      })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Drive同期MCPの待受を開始できませんでした。')
  }

  const state: BridgeState = {
    version: 1,
    origin: `http://127.0.0.1:${address.port}`,
    token
  }
  const temporaryPath = `${options.statePath}.tmp-${randomUUID()}`
  await mkdir(dirname(options.statePath), { recursive: true })
  try {
    await writeFile(temporaryPath, JSON.stringify(state), 'utf8')
    await rename(temporaryPath, options.statePath)
  } catch (error) {
    server.close()
    await rm(temporaryPath, { force: true })
    throw error
  }

  return {
    async close(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      try {
        const current = JSON.parse(
          await readFile(options.statePath, 'utf8')
        ) as Partial<BridgeState>
        if (current.token === token) await rm(options.statePath, { force: true })
      } catch {
        // A stale or replaced capability file must not block app shutdown.
      }
    }
  }
}
