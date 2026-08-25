import { execFile as execFileCallback, spawnSync } from 'node:child_process'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFile = promisify(execFileCallback)
const script = join(process.cwd(), 'scripts', 'check-workflow-harness.mjs')

async function createFixture(scripts: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-workflow-harness-'))
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      scripts
    })
  )
  await execFile('git', ['init'], { cwd: root })
  return root
}

function runHarness(root: string, args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  })
  return {
    exitCode: result.status,
    receipt: JSON.parse(result.stdout.trim()),
    stderr: result.stderr
  }
}

it('runs one allowlisted check and prints a bounded receipt', async () => {
  const root = await createFixture({
    'check:current-decision': 'node -e "process.exit(0)"'
  })
  try {
    const { exitCode, receipt, stderr } = runHarness(
      root,
      ['--task', 'fixture-pass', '--checks', 'current-decision']
    )

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(receipt).toMatchObject({
      schema_version: 1,
      task_id: 'fixture-pass',
      status: 'pass',
      proof_layer: 'source-and-fixture',
      source_unchanged: true,
      delivery_before: 'unknown',
      delivery_after: 'unknown',
      checks: [{ id: 'current-decision', status: 'pass', exit_code: 0 }],
      first_failure: null,
      not_proven: [
        'packaged',
        'installed',
        'live',
        'user-acceptance',
        'token',
        'billing'
      ]
    })
    expect(receipt.source_before).toEqual(receipt.source_after)
    expect(receipt.source_before).toMatchObject({
      fileCount: expect.any(Number),
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      excludedPaths: ['docs/reports/production-update-latest.json']
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('stops at the first failure without copying child output', async () => {
  const root = await createFixture({
    'check:current-decision': 'node -e "process.exit(0)"',
    typecheck:
      'node -e "console.error(\'TOP_SECRET_FIXTURE\');process.exit(7)"',
    test: 'node -e "require(\'node:fs\').writeFileSync(\'should-not-run.txt\',\'x\')"'
  })
  try {
    const { exitCode, receipt, stderr } = runHarness(root, [
      '--task',
      'fixture-fail',
      '--checks',
      'current-decision,typecheck,test'
    ])

    expect(exitCode).toBe(1)
    expect(receipt).toMatchObject({
      status: 'fail',
      source_unchanged: true,
      checks: [
        { id: 'current-decision', status: 'pass', exit_code: 0 },
        {
          id: 'typecheck',
          status: 'fail',
          exit_code: 7,
          summary: 'check exited with code 7'
        },
        { id: 'test', status: 'not_run', exit_code: null }
      ],
      first_failure: { id: 'typecheck', reason: 'nonzero_exit', exit_code: 7 }
    })
    expect(JSON.stringify(receipt)).not.toContain('TOP_SECRET_FIXTURE')
    expect(stderr).not.toContain('TOP_SECRET_FIXTURE')
    await expect(access(join(root, 'should-not-run.txt'))).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects unknown checks and unsupported output options before execution', async () => {
  const root = await createFixture({
    'check:current-decision':
      'node -e "require(\'node:fs\').writeFileSync(\'should-not-run.txt\',\'x\')"'
  })
  try {
    const unknown = runHarness(root, [
      '--task',
      'fixture-unknown',
      '--checks',
      'unknown'
    ])
    const unsupportedOut = runHarness(root, [
      '--task',
      'fixture-out',
      '--checks',
      'current-decision',
      '--out',
      '..\\outside.json'
    ])

    expect(unknown.exitCode).toBe(1)
    expect(unknown.receipt).toMatchObject({
      status: 'fail',
      checks: [],
      first_failure: { id: 'preflight', reason: 'unknown_check' }
    })
    expect(unsupportedOut.exitCode).toBe(1)
    expect(unsupportedOut.receipt.first_failure).toEqual({
      id: 'preflight',
      reason: 'invalid_arguments'
    })
    await expect(access(join(root, 'should-not-run.txt'))).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('fails when a passing check changes the source tree', async () => {
  const root = await createFixture({
    'check:current-decision':
      'node -e "require(\'node:fs\').writeFileSync(\'mutated.txt\',\'x\')"'
  })
  try {
    const { exitCode, receipt } = runHarness(root, [
      '--task',
      'fixture-mutation',
      '--checks',
      'current-decision'
    ])

    expect(exitCode).toBe(1)
    expect(receipt).toMatchObject({
      status: 'fail',
      source_unchanged: false,
      checks: [{ id: 'current-decision', status: 'pass', exit_code: 0 }],
      first_failure: { id: 'postflight', reason: 'source_changed' }
    })
    expect(receipt.source_after.fileCount).toBe(receipt.source_before.fileCount + 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
