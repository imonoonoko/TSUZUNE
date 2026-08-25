import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import {
  deliveryStatus,
  snapshotSourceTree
} from './source-fingerprint.mjs'

const checks = new Map([
  ['current-decision', 'check:current-decision'],
  ['typecheck', 'typecheck'],
  ['test', 'test'],
  ['mcp', 'check:mcp']
])
const notProven = [
  'packaged',
  'installed',
  'live',
  'user-acceptance',
  'token',
  'billing'
]

function npmInvocation(scriptName) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, 'run', scriptName]
    }
  }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `npm.cmd run ${scriptName}`]
    }
  }
  return { command: 'npm', args: ['run', scriptName] }
}

function parseArguments(args) {
  let taskId
  let rawChecks
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!value || (flag !== '--task' && flag !== '--checks')) {
      return { error: 'invalid_arguments' }
    }
    if (flag === '--task') {
      if (taskId !== undefined) return { error: 'invalid_arguments' }
      taskId = value.trim()
    } else {
      if (rawChecks !== undefined) return { error: 'invalid_arguments' }
      rawChecks = value
    }
  }
  if (!taskId) return { error: 'invalid_task_id' }
  const checkIds = rawChecks?.split(',').map((value) => value.trim()) ?? []
  if (checkIds.length === 0 || checkIds.some((value) => !value)) {
    return { taskId, error: 'invalid_checks' }
  }
  if (new Set(checkIds).size !== checkIds.length) {
    return { taskId, error: 'duplicate_check' }
  }
  if (checkIds.some((id) => !checks.has(id))) {
    return { taskId, error: 'unknown_check' }
  }
  return { taskId, checkIds }
}

function checkReceipts(checkIds) {
  return checkIds.map((id) => ({
    id,
    command: `npm run ${checks.get(id)}`,
    status: 'not_run',
    exit_code: null,
    elapsed_ms: null,
    summary: null
  }))
}

function receiptBase(taskId, selectedChecks, startedAt) {
  return {
    schema_version: 1,
    task_id: taskId ?? null,
    status: 'fail',
    proof_layer: 'source-and-fixture',
    source_before: null,
    source_after: null,
    source_unchanged: false,
    delivery_before: 'unknown',
    delivery_after: 'unknown',
    checks: checkReceipts(selectedChecks),
    first_failure: null,
    not_proven: [...notProven],
    elapsed_ms: Math.round(performance.now() - startedAt)
  }
}

function printAndExit(receipt, exitCode) {
  console.log(JSON.stringify(receipt))
  process.exitCode = exitCode
}

const startedAt = performance.now()
const parsed = parseArguments(process.argv.slice(2))
if (parsed.error) {
  const receipt = receiptBase(parsed.taskId, [], startedAt)
  receipt.first_failure = { id: 'preflight', reason: parsed.error }
  printAndExit(receipt, 1)
} else {
  const repositoryRoot = resolve(process.cwd())
  const receipt = receiptBase(parsed.taskId, parsed.checkIds, startedAt)
  try {
    receipt.source_before = await snapshotSourceTree(repositoryRoot)
  } catch {
    receipt.first_failure = { id: 'preflight', reason: 'source_snapshot_failed' }
    receipt.elapsed_ms = Math.round(performance.now() - startedAt)
    printAndExit(receipt, 1)
  }

  if (receipt.source_before) {
    receipt.delivery_before = await deliveryStatus(repositoryRoot)
    for (const check of receipt.checks) {
      const checkStartedAt = performance.now()
      const invocation = npmInvocation(checks.get(check.id))
      const result = spawnSync(invocation.command, invocation.args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: 'ignore',
        windowsHide: true
      })
      check.elapsed_ms = Math.round(performance.now() - checkStartedAt)
      check.exit_code = Number.isInteger(result.status) ? result.status : null
      if (!result.error && result.status === 0) {
        check.status = 'pass'
        continue
      }
      check.status = 'fail'
      check.summary = result.error
        ? 'check failed to start'
        : result.status === null
          ? 'check ended without an exit code'
          : `check exited with code ${result.status}`
      receipt.first_failure = {
        id: check.id,
        reason: result.error ? 'start_failed' : 'nonzero_exit',
        exit_code: check.exit_code
      }
      break
    }

    try {
      receipt.source_after = await snapshotSourceTree(repositoryRoot)
      receipt.source_unchanged =
        JSON.stringify(receipt.source_before) === JSON.stringify(receipt.source_after)
    } catch {
      if (!receipt.first_failure) {
        receipt.first_failure = { id: 'postflight', reason: 'source_snapshot_failed' }
      }
    }
    receipt.delivery_after = await deliveryStatus(repositoryRoot)

    if (!receipt.first_failure && !receipt.source_unchanged) {
      receipt.first_failure = { id: 'postflight', reason: 'source_changed' }
    }
    if (
      !receipt.first_failure &&
      receipt.delivery_before !== receipt.delivery_after
    ) {
      receipt.first_failure = { id: 'postflight', reason: 'delivery_status_changed' }
    }
    receipt.status = receipt.first_failure ? 'fail' : 'pass'
    receipt.elapsed_ms = Math.round(performance.now() - startedAt)
    printAndExit(receipt, receipt.status === 'pass' ? 0 : 1)
  }
}
