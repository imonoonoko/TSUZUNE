import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { beforeAll, afterAll, expect, it } from 'vitest'
import { evaluateBaseInWorker } from '../src/mcp/base-worker-client'
import { parseBaseProfile } from '../src/core/base-profile'
import type { BaseWorkerRequest } from '../src/mcp/base-worker-client'

let directory: string; let workerUrl: URL
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mcp-base-worker-')); workerUrl = pathToFileURL(join(directory, 'base-worker.mjs'))
  await build({ entryPoints: ['src/mcp/base-worker.ts'], outfile: join(directory, 'base-worker.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } })
})
afterAll(async () => { await rm(directory, { recursive: true, force: true }) })
function request(source = 'views: [{type: table}]', content = ''): BaseWorkerRequest {
  const parsed = parseBaseProfile(source); if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics))
  return { profile: parsed.profile, viewIndex: 0, options: {}, notes: [{ path: 'a.md', name: 'a', content, modifiedAt: 0, size: content.length }] }
}
it('terminates catastrophic regex and allows subsequent real Worker evaluation', async () => {
  const runaway = request('filters: /^(a+)+$/.matches(value)\nviews: [{type: table}]', `---\nvalue: "${'a'.repeat(100)}!"\n---`)
  await expect(evaluateBaseInWorker(runaway, { workerUrl, timeoutMs: 500 })).rejects.toThrow('timed out')
  expect((await evaluateBaseInWorker(request(), { workerUrl })).rows).toHaveLength(1)
})
it('cancels a running Worker and handles Worker errors without poisoning subsequent requests', async () => {
  const controller = new AbortController()
  const pending = evaluateBaseInWorker(request(), { workerUrl, signal: controller.signal }); controller.abort()
  await expect(pending).rejects.toThrow('cancelled')
  await expect(evaluateBaseInWorker(request(), { workerUrl: pathToFileURL(join(directory, 'missing.js')) })).rejects.toThrow()
  expect((await evaluateBaseInWorker(request(), { workerUrl })).rows).toHaveLength(1)
})
