import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DriveSyncApplyResult, DriveSyncPreview } from '../shared/types'

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
  preview(): Promise<DriveSyncPreview>
  apply(planId: string): Promise<DriveSyncApplyResult>
}

function respond(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readPlanId(request: IncomingMessage): Promise<string> {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk.toString()
    if (raw.length > 2_000) throw new Error('同期要求が大きすぎます。')
  }
  const parsed = JSON.parse(raw || '{}') as { planId?: unknown }
  if (typeof parsed.planId !== 'string' || !parsed.planId.trim()) {
    throw new Error('plan_idを指定してください。')
  }
  return parsed.planId
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
        respond(response, 200, await options.preview())
        return
      }
      if (request.url === '/apply') {
        respond(response, 200, await options.apply(await readPlanId(request)))
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
