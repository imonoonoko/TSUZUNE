import { spawn, spawnSync, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createKnowledgeFixture, knowledgePrompts, createEvidenceFixture, evidencePrompts } from './codex-knowledge-fixture.mjs'

import { assertNoTreeMutation } from './mcp-readonly-integrity.mjs'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const option = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1] }
if (process.argv.includes('--help')) {
  console.log('node scripts/evaluate-codex-knowledge.mjs --model MODEL [--codex-js CLI_ENTRY] [--server FROZEN_SERVER] [--phase baseline|final] [--evidence]\nRequires an explicitly chosen model. Each run creates isolated synthetic materials and retains JSONL, stderr, replies and saved bytes under ignored work/codex-integration/. No normal configuration or authentication changes. Process success still requires evidence review of all selected scenarios.')
  process.exit(0)
}
const model = option('--model')
if (!model || model.startsWith('--')) throw new Error('Explicit --model is required. Model-driven acceptance is held until the user selects one.')
const catalog = JSON.parse(await readFile(join(root, 'src/mcp/tool-catalog.json'), 'utf8'))
const phase = option('--phase') ?? 'final'
if (!['baseline', 'final'].includes(phase)) throw new Error('--phase must be baseline or final')
if (phase === 'baseline' && !option('--server')) throw new Error('Baseline requires --server pointing at the frozen pre-change bundle.')
const evidenceSuite = process.argv.includes('--evidence');
const addedTools = evidenceSuite ? ['list_note_sections', 'fetch_note_section'] : ['build_context_set', 'list_bases', 'query_base', 'get_local_graph']
const enabledTools = phase === 'baseline' ? catalog.common.filter((name) => !addedTools.includes(name)) : catalog.common
// Mirror the existing production approval catalog in this ephemeral fixture only.
// Prompted operations stay prompted; ordinary revision-checked AI updates stay auto.
const approvalArgs = ['-c', `mcp_servers.tsuzune_fixture.default_tools_approval_mode=${JSON.stringify(catalog.codex.defaultApproval)}`]
for (const [name, approval] of Object.entries(catalog.codex.approvalOverrides)) {
  approvalArgs.push('-c', `mcp_servers.tsuzune_fixture.tools.${name}.approval_mode=${JSON.stringify(approval)}`)
}
const codex = resolve(option('--codex-js') ?? 'C:/nvm4w/nodejs/node_modules/@openai/codex/bin/codex.js')
await readFile(codex)
const parent = join(root, 'work', 'codex-integration')
await mkdir(parent, { recursive: true })
const directory = await mkdtemp(join(parent, `${phase}-`))
const vault = join(directory, 'fixture'), cwd = join(directory, 'empty')
await mkdir(cwd)
await createKnowledgeFixture(vault)
if (evidenceSuite) await createEvidenceFixture(vault)
let server = option('--server') ? resolve(option('--server')) : join(directory, 'mcp', 'server.js')
if (!option('--server')) {
  await run(process.execPath, [join(root, 'scripts', 'build-mcp.mjs'), '--outfile', server], { cwd: root })
  await writeFile(join(directory, 'mcp', 'package.json'), '{"type":"module"}\n')
}
const serverHash = createHash('sha256').update(await readFile(server)).digest('hex')
const results = []
await writeFile(join(directory, 'run.json'), JSON.stringify({ phase, suite: evidenceSuite ? "evidence-12" : "knowledge-6", requestedModel: model, requestedReasoning: 'high', actualModel: 'not_observable', server, serverHash, enabledTools, toolApprovalPolicy: catalog.codex, executionApproval: 'approve-for-me (automatic review; no bypass)', sandbox: 'workspace-write', normalConfigIgnored: true, acceptance: 'pending evidence review' }, null, 2))
for (const [index, prompt] of (evidenceSuite ? [...knowledgePrompts, ...evidencePrompts] : knowledgePrompts).entries()) {
  const scenario = index + 1, prefix = join(directory, String(scenario))
  const args = [codex, 'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--json', '--skip-git-repo-check', '--model', model, '--approve-for-me', '-C', cwd, '-c', 'model_reasoning_effort="high"', '-c', `mcp_servers.tsuzune_fixture.command=${JSON.stringify(process.execPath)}`, '-c', `mcp_servers.tsuzune_fixture.args=${JSON.stringify([server, '--vault', vault, '--settings', join(directory, 'missing-settings.json')])}`, '-c', `mcp_servers.tsuzune_fixture.enabled_tools=${JSON.stringify(enabledTools)}`, '-c', 'mcp_servers.tsuzune_fixture.required=true', '-c', 'mcp_servers.tsuzune_fixture.startup_timeout_sec=30', '-o', `${prefix}.md`, '-']
  args.splice(args.length - 1, 0, ...approvalArgs)
  const operation = async () => {
  const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let stdout = '', stderr = '', timedOut = false
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.stdin.on('error', (error) => { stderr += `\nstdin: ${error.message}` })
  child.stdin.end('VaultへのアクセスはTSUZUNE連携のみを使ってください。\n' + prompt)
  let postKillTimer
  const exit = await new Promise((resolveExit) => {
    child.on('close', resolveExit)
    child.on('error', (error) => { stderr += `\nspawn: ${error.message}`; resolveExit(null) })
    postKillTimer = undefined
    const timeout = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32' && child.pid) {
        const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000, encoding: 'utf8' })
        stderr += `\nowned tree cleanup: ${killed.status ?? killed.error?.message}`
      } else child.kill('SIGKILL')
      postKillTimer = setTimeout(() => {
        stderr += '\nprocess pipes did not close after owned tree cleanup'
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref()
        resolveExit(null)
      }, 5000)
    }, 240000)
    child.once('close', () => clearTimeout(timeout))
    child.once('error', () => clearTimeout(timeout))
  }).finally(() => clearTimeout(postKillTimer))
  return {stdout,stderr,exit,timedOut}
  }
  const {stdout,stderr,exit,timedOut}=await (scenario===5 ? operation() : assertNoTreeMutation([{name:'fixture',path:vault},{name:'settings',path:join(directory,'missing-settings.json')}],operation,`Codex scenario ${scenario}`))
  await writeFile(`${prefix}.jsonl`, stdout)
  await writeFile(`${prefix}.stderr.txt`, stderr)
  await writeFile(`${prefix}.saved.md`, await readFile(join(vault, '比較結果.md')))
  const events = stdout.split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line) } catch { return { unparsed: line } } })
  const calls = events.filter((event) => JSON.stringify(event).includes('mcp_tool_call'))
  results.push({ scenario, prompt, exit, timedOut, calls, readOnlyUnchanged: scenario===5 ? 'authorized write scenario' : true, evidenceReview: 'pending' })
  await writeFile(join(directory, 'scenarios.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ directory, scenario, exit, timedOut, evidenceReview: 'pending' }))
  if (exit !== 0 || timedOut) { process.exitCode = 1; break }
}
