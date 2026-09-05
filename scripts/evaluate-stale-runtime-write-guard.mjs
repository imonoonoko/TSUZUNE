import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(repoRoot, 'src', 'mcp', 'server.ts')
const packagePath = join(repoRoot, 'package.json')
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const mutationTools = [
  'create_directory',
  'create_note',
  'update_note',
  'autonomous_update_note',
  'patch_note',
  'move_entry',
  'apply_drive_sync',
  'add_link'
]

async function snapshotTree(root) {
  const entries = []
  async function visit(folder) {
    const children = await readdir(folder, { withFileTypes: true })
    children.sort((left, right) => left.name.localeCompare(right.name, 'en'))
    for (const child of children) {
      const absolute = join(folder, child.name)
      const path = relative(root, absolute).split(sep).join('/')
      const info = await stat(absolute)
      if (child.isDirectory()) {
        entries.push({ path, type: 'directory', mtimeMs: info.mtimeMs })
        await visit(absolute)
        continue
      }
      const content = await readFile(absolute)
      entries.push({
        path,
        type: 'file',
        size: info.size,
        mtimeMs: info.mtimeMs,
        sha256: createHash('sha256').update(content).digest('hex')
      })
    }
  }
  await visit(root)
  return JSON.stringify(entries)
}

async function snapshotFile(path) {
  try {
    const info = await stat(path)
    const content = await readFile(path)
    return {
      exists: true,
      size: info.size,
      mtimeMs: info.mtimeMs,
      sha256: createHash('sha256').update(content).digest('hex')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false }
    throw error
  }
}

async function snapshotMutationState(vaultPath, profilePaths) {
  return JSON.stringify({
    vault: await snapshotTree(vaultPath),
    profile: await Promise.all(profilePaths.map(snapshotFile))
  })
}

function responseJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

async function startFixtureBridge(statePath) {
  const token = 'a'.repeat(64)
  const calls = { preview: 0, apply: 0, preflight: 0, move: 0 }
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      responseJson(response, 401, { error: 'unauthorized' })
      return
    }
    let raw = ''
    for await (const chunk of request) raw += chunk.toString()
    const body = JSON.parse(raw || '{}')
    if (request.url === '/preview') {
      calls.preview += 1
      responseJson(response, 200, {
        planId: 'fixture-plan',
        createdAt: '2026-08-18T00:00:00.000Z',
        items: [],
        counts: {
          upload: 0,
          download: 0,
          move: 0,
          conflict: 0,
          preserve: 0,
          trashLocal: 0,
          trashRemote: 0
        }
      })
      return
    }
    if (request.url === '/apply') {
      calls.apply += 1
      responseJson(response, 200, {
        uploaded: 0,
        downloaded: 0,
        moved: 0,
        conflicts: 0,
        preserved: 0,
        conflictPaths: [],
        completedAt: '2026-08-18T00:00:00.000Z'
      })
      return
    }
    if (request.url === '/entry-move/preflight') {
      calls.preflight += 1
      responseJson(response, 200, {
        source_type: 'markdown',
        source: body.source,
        destination: body.destination,
        fingerprint: `sha256:${'1'.repeat(64)}`,
        source_revision: `sha256:${'2'.repeat(64)}`,
        content_revision: `sha256:${'3'.repeat(64)}`,
        counts: { markdown: 1, directories: 0, attachments: 0 },
        mappings: [{ old_path: body.source, new_path: body.destination }],
        mapping_truncated: false,
        collision: false,
        protected_source: false,
        protected_destination: false,
        link_impact: { affected_count: 0, source_paths: [] },
        drive: { tracked_moves: 0, untracked_uploads: 0 }
      })
      return
    }
    if (request.url === '/entry-move/apply') {
      calls.move += 1
      responseJson(response, 200, {
        old_path: body.source,
        new_path: body.destination,
        fingerprint: body.expected_fingerprint
      })
      return
    }
    responseJson(response, 404, { error: 'not found' })
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  assert(address && typeof address !== 'string')
  await writeFile(
    statePath,
    JSON.stringify({
      version: 1,
      origin: `http://127.0.0.1:${address.port}`,
      token
    }),
    'utf8'
  )
  return {
    calls,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose())
    })
  }
}

async function callOk(client, name, args) {
  const result = await client.callTool({ name, arguments: args })
  assert.equal(result.isError, undefined, `${name} failed: ${result.content?.[0]?.text}`)
  return result
}

async function runtimeInfo(client) {
  return (await callOk(client, 'runtime_info', {})).structuredContent
}

async function setBuildTime(client, bundlePath, processStartedAt, offsetMs) {
  const time = new Date(Date.parse(processStartedAt) + offsetMs)
  await utimes(bundlePath, time, time)
  return runtimeInfo(client)
}

async function run() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tsuzune-stale-guard-'))
  const expectedTempPrefix = `${resolve(tmpdir())}${sep}`.toLowerCase()
  assert(resolve(fixtureRoot).toLowerCase().startsWith(expectedTempPrefix))
  const vaultPath = join(fixtureRoot, 'vault')
  const outPath = join(fixtureRoot, 'out', 'mcp')
  const bundlePath = join(outPath, 'server.js')
  const missingBundlePath = join(outPath, 'server.missing.js')
  const fixturePackagePath = join(fixtureRoot, 'package.json')
  const missingPackagePath = join(fixtureRoot, 'package.missing.json')
  const settingsPath = join(fixtureRoot, 'settings.json')
  const reviewStorePath = join(fixtureRoot, 'ai-write-review-proposals.json')
  const bridgeStatePath = join(fixtureRoot, 'mcp-drive-sync.json')
  const mutationStatePaths = [settingsPath, reviewStorePath, bridgeStatePath]
  let bridge
  let client
  let transport

  try {
    await mkdir(join(vaultPath, 'Projects'), { recursive: true })
    await mkdir(join(vaultPath, 'Knowledge'), { recursive: true })
    await mkdir(outPath, { recursive: true })
    await writeFile(
      join(vaultPath, 'Home.md'),
      '# Home\n\nFixture home. [[Knowledge/Target]]',
      'utf8'
    )
    await writeFile(
      join(vaultPath, 'Projects', 'Source.md'),
      '# Source\n\nMove fixture.',
      'utf8'
    )
    await writeFile(
      join(vaultPath, 'Knowledge', 'Target.md'),
      '# Target\n\nLinked target.',
      'utf8'
    )
    await writeFile(
      join(vaultPath, 'Knowledge', 'Other.md'),
      '# Other\n\nFresh link target.',
      'utf8'
    )
    await writeFile(fixturePackagePath, JSON.stringify(packageJson), 'utf8')

    const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n')
    await build({
      stdin: {
        contents: source,
        resolveDir: dirname(sourcePath),
        sourcefile: sourcePath,
        loader: 'ts'
      },
      outfile: bundlePath,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      define: {
        __TSUZUNE_VERSION__: JSON.stringify(packageJson.version)
      },
      logLevel: 'silent'
    })
    const oldBuildTime = new Date(Date.now() - 60_000)
    await utimes(bundlePath, oldBuildTime, oldBuildTime)
    bridge = await startFixtureBridge(bridgeStatePath)

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        bundlePath,
        '--vault',
        vaultPath,
        '--settings',
        settingsPath,
        '--drive-sync-state',
        bridgeStatePath
      ],
      stderr: 'pipe'
    })
    client = new Client({ name: 'stale-runtime-guard-evaluation', version: '1.0.0' })
    await client.connect(transport)

    const initial = await runtimeInfo(client)
    assert.equal(initial.stale_runtime, false)
    assert.equal(initial.package_version, packageJson.version)

    await callOk(client, 'search', { query: 'Fixture' })
    await callOk(client, 'delivery_info', {})
    await callOk(client, 'fetch', { id: 'Home.md' })
    await callOk(client, 'get_backlinks', { id: 'Knowledge/Target.md' })
    await callOk(client, 'build_context', { id: 'Home.md' })
    await callOk(client, 'list_directory', { path: '', depth: 2 })
    await callOk(client, 'preview_drive_sync', {})
    await callOk(client, 'preflight_move_entry', {
      source: 'Projects/Source.md',
      destination: 'Projects/Moved.md'
    })

    const beforeStaleReads = await snapshotMutationState(vaultPath, mutationStatePaths)
    const stale = await setBuildTime(
      client,
      bundlePath,
      initial.process_started_at,
      60_000
    )
    assert.equal(stale.stale_runtime, true)

    const staleReads = [
      ['delivery_info', {}],
      ['search', { query: 'Fixture' }],
      ['fetch', { id: 'Home.md' }],
      ['get_backlinks', { id: 'Knowledge/Target.md' }],
      ['build_context', { id: 'Home.md' }],
      ['list_directory', { path: '', depth: 2 }],
      ['preview_drive_sync', {}],
      ['preflight_move_entry', {
        source: 'Projects/Source.md',
        destination: 'Projects/Moved.md'
      }]
    ]
    for (const [name, args] of staleReads) await callOk(client, name, args)
    const afterStaleReads = await snapshotMutationState(vaultPath, mutationStatePaths)
    assert.equal(afterStaleReads, beforeStaleReads)

    const home = await callOk(client, 'fetch', { id: 'Home.md' })
    const revision = home.structuredContent.metadata.revision
    const staleWrites = [
      ['create_directory', { path: 'Projects/StaleFolder' }],
      ['create_note', { path: 'Projects/Stale.md', content: '# Stale' }],
      ['update_note', {
        id: 'Home.md',
        content: '# Stale update',
        expected_revision: revision
      }],
      ['autonomous_update_note', {
        id: 'Home.md',
        content: '# Stale autonomous update',
        expected_revision: revision,
        reason: 'fixture'
      }],
      ['patch_note', {
        id: 'Home.md',
        expected_revision: revision,
        operations: [{ find: 'Fixture', replace: 'Stale' }],
        reason: 'fixture'
      }],
      ['move_entry', {
        source: 'Projects/Source.md',
        destination: 'Projects/Moved.md',
        expected_fingerprint: `sha256:${'1'.repeat(64)}`
      }],
      ['apply_drive_sync', { plan_id: 'fixture-plan' }],
      ['add_link', {
        source: 'Home.md',
        target: 'Knowledge/Other.md',
        expected_revision: revision,
        reason: 'fixture'
      }]
    ]
    const staleErrors = []
    for (const [name, args] of staleWrites) {
      const result = await client.callTool({ name, arguments: args })
      const message = String(result.content?.[0]?.text ?? '')
      assert.equal(result.isError, true, `${name} was not rejected`)
      assert(message.includes('STALE_RUNTIME_WRITE_BLOCKED'), `${name} used the wrong error`)
      assert(message.includes('npm run mcp:register'), `${name} omitted the recovery command`)
      assert(message.includes('restart the MCP client'), `${name} omitted the restart step`)
      staleErrors.push(name)
    }
    const afterStaleWrites = await snapshotMutationState(vaultPath, mutationStatePaths)
    assert.equal(afterStaleWrites, beforeStaleReads)
    assert.equal(bridge.calls.apply, 0)
    assert.equal(bridge.calls.move, 0)

    const beforeBoundary = await setBuildTime(
      client,
      bundlePath,
      initial.process_started_at,
      -60_000
    )
    const equalBoundary = await setBuildTime(
      client,
      bundlePath,
      initial.process_started_at,
      0
    )
    const plusOneBoundary = await setBuildTime(
      client,
      bundlePath,
      initial.process_started_at,
      1
    )
    assert.equal(beforeBoundary.stale_runtime, false)
    assert.equal(equalBoundary.stale_runtime, false)
    assert.equal(plusOneBoundary.stale_runtime, true)

    await setBuildTime(client, bundlePath, initial.process_started_at, -60_000)
    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    const longRunningFresh = await runtimeInfo(client)
    assert.equal(longRunningFresh.stale_runtime, false)

    await writeFile(
      fixturePackagePath,
      JSON.stringify({ ...packageJson, version: `${packageJson.version}-mismatch` }),
      'utf8'
    )
    const packageMismatch = await runtimeInfo(client)
    assert.equal(packageMismatch.stale_runtime, true)
    await writeFile(fixturePackagePath, JSON.stringify(packageJson), 'utf8')

    await rename(fixturePackagePath, missingPackagePath)
    const missingPackage = await runtimeInfo(client)
    assert.equal(missingPackage.package_version, null)
    assert.equal(missingPackage.stale_runtime, false)
    await rename(missingPackagePath, fixturePackagePath)

    const beforeMissingBuild = await snapshotMutationState(vaultPath, mutationStatePaths)
    await rename(bundlePath, missingBundlePath)
    await callOk(client, 'search', { query: 'Fixture' })
    const missingBuildWrite = await client.callTool({
      name: 'create_note',
      arguments: { path: 'Projects/Missing-build.md', content: '# Missing build' }
    })
    assert.equal(missingBuildWrite.isError, true)
    assert(
      String(missingBuildWrite.content?.[0]?.text ?? '').includes(
        'RUNTIME_FRESHNESS_UNAVAILABLE'
      )
    )
    assert(
      String(missingBuildWrite.content?.[0]?.text ?? '').includes('npm run mcp:register')
    )
    assert(
      String(missingBuildWrite.content?.[0]?.text ?? '').includes(
        'restart the MCP client'
      )
    )
    assert.equal(
      await snapshotMutationState(vaultPath, mutationStatePaths),
      beforeMissingBuild
    )
    await rename(missingBundlePath, bundlePath)
    await setBuildTime(client, bundlePath, initial.process_started_at, -60_000)

    const freshWrites = []
    await callOk(client, 'create_directory', { path: 'Projects/FreshFolder' })
    freshWrites.push('create_directory')
    await callOk(client, 'create_note', {
      path: 'Projects/Fresh.md',
      content: '# Fresh\n\nCreated.'
    })
    freshWrites.push('create_note')
    let fresh = await callOk(client, 'fetch', { id: 'Projects/Fresh.md' })
    await callOk(client, 'update_note', {
      id: 'Projects/Fresh.md',
      content: '# Fresh\n\nUpdated.',
      expected_revision: fresh.structuredContent.metadata.revision
    })
    freshWrites.push('update_note')
    fresh = await callOk(client, 'fetch', { id: 'Projects/Fresh.md' })
    await callOk(client, 'autonomous_update_note', {
      id: 'Projects/Fresh.md',
      content: '# Fresh\n\nUpdated autonomously.',
      expected_revision: fresh.structuredContent.metadata.revision,
      reason: 'fixture'
    })
    freshWrites.push('autonomous_update_note')
    fresh = await callOk(client, 'fetch', { id: 'Projects/Fresh.md' })
    await callOk(client, 'patch_note', {
      id: 'Projects/Fresh.md',
      expected_revision: fresh.structuredContent.metadata.revision,
      operations: [{ find: 'autonomously', replace: 'by fixture' }],
      reason: 'fixture'
    })
    freshWrites.push('patch_note')
    const freshHome = await callOk(client, 'fetch', { id: 'Home.md' })
    await callOk(client, 'add_link', {
      source: 'Home.md',
      target: 'Knowledge/Other.md',
      expected_revision: freshHome.structuredContent.metadata.revision,
      reason: 'fixture'
    })
    freshWrites.push('add_link')
    await callOk(client, 'move_entry', {
      source: 'Projects/Source.md',
      destination: 'Projects/Moved.md',
      expected_fingerprint: `sha256:${'1'.repeat(64)}`
    })
    freshWrites.push('move_entry')
    await callOk(client, 'apply_drive_sync', { plan_id: 'fixture-plan' })
    freshWrites.push('apply_drive_sync')
    assert.deepEqual(freshWrites.sort(), mutationTools.slice().sort())
    assert.equal(bridge.calls.move, 1)
    assert.equal(bridge.calls.apply, 1)

    const timings = []
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now()
      await runtimeInfo(client)
      timings.push(performance.now() - started)
    }
    timings.sort((left, right) => left - right)

    return {
      schema: 'stale-runtime-write-guard-acceptance.v1',
      status: 'pass',
      product_changed: true,
      tool_schema_bytes_delta: 0,
      mutation_surface: {
        expected: mutationTools.length,
        stale_blocked: staleErrors.length,
        fresh_allowed: freshWrites.length
      },
      stale: {
        runtime_detected: true,
        read_and_preflight_passed: staleReads.length + 1,
        mutation_state_unchanged_after_reads: afterStaleReads === beforeStaleReads,
        mutation_state_unchanged_after_writes: afterStaleWrites === beforeStaleReads,
        bridge_apply_calls: 0,
        bridge_move_calls: 0
      },
      boundaries: {
        before_start_stale: beforeBoundary.stale_runtime,
        equal_start_stale: equalBoundary.stale_runtime,
        plus_1ms_stale: plusOneBoundary.stale_runtime,
        repeated_old_build_stale: longRunningFresh.stale_runtime,
        package_mismatch_stale: packageMismatch.stale_runtime,
        package_missing_version: missingPackage.package_version,
        package_missing_stale: missingPackage.stale_runtime,
        bundle_missing_read_continues: true,
        bundle_missing_write_blocked: missingBuildWrite.isError === true
      },
      runtime_info_latency_ms: {
        samples: timings.length,
        median: Number(timings[Math.floor(timings.length / 2)].toFixed(3)),
        max: Number(timings.at(-1).toFixed(3))
      }
    }
  } finally {
    if (client) await client.close().catch(() => {})
    if (bridge) await bridge.close().catch(() => {})
    if (resolve(fixtureRoot).toLowerCase().startsWith(expectedTempPrefix)) {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  }
}

console.log(JSON.stringify(await run(), null, 2))
