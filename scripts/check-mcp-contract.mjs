import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(
  await readFile(join(repositoryRoot, 'src', 'mcp', 'tool-catalog.json'), 'utf8')
)
const packageJson = JSON.parse(
  await readFile(join(repositoryRoot, 'package.json'), 'utf8')
)
const commonTools = catalog.common
const directTools = [...commonTools, ...catalog.directOnly]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function sorted(values) {
  return [...values].sort()
}

function tableTools(markdown) {
  return [...markdown.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1])
}

assert(commonTools.length === 19, `Expected 19 common tools, got ${commonTools.length}.`)
assert(directTools.length === 21, `Expected 21 direct tools, got ${directTools.length}.`)
assert(
  new Set(directTools).size === directTools.length,
  'MCP tool catalog contains duplicate names.'
)
for (const name of Object.keys(catalog.codex.approvalOverrides)) {
  assert(commonTools.includes(name), `Approval override references unknown tool: ${name}`)
}

const codexHome = await mkdtemp(join(tmpdir(), 'tsuzune-mcp-contract-'))
try {
  await run('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(repositoryRoot, 'scripts', 'register-codex-mcp.ps1'),
    '-CodexHome',
    codexHome
  ])

  const config = (await readFile(join(codexHome, 'config.toml'), 'utf8')).replaceAll(
    '\r\n',
    '\n'
  )
  const enabledMatch = config.match(/^enabled_tools = \[(.*)\]$/m)
  assert(enabledMatch, 'Generated Codex config does not contain enabled_tools.')
  const enabledTools = JSON.parse(`[${enabledMatch[1]}]`)
  assert(
    JSON.stringify(sorted(enabledTools)) === JSON.stringify(sorted(commonTools)),
    `Codex registered tools differ from the common catalog: ${enabledTools.join(', ')}`
  )

  const defaultApprovalMatch = config.match(/^default_tools_approval_mode = "(.*)"$/m)
  assert(
    defaultApprovalMatch?.[1] === catalog.codex.defaultApproval,
    'Codex default approval mode differs from the catalog.'
  )
  for (const [name, approval] of Object.entries(catalog.codex.approvalOverrides)) {
    assert(
      config.includes(
        `[mcp_servers.tsuzune.tools.${name}]\napproval_mode = "${approval}"`
      ),
      `Codex approval mode differs from the catalog for ${name}.`
    )
  }
  const configuredOverrides = [...config.matchAll(
    /^\[mcp_servers\.tsuzune\.tools\.([^\]]+)\]$/gm
  )].map((match) => match[1])
  assert(
    JSON.stringify(sorted(configuredOverrides)) ===
      JSON.stringify(sorted(Object.keys(catalog.codex.approvalOverrides))),
    'Generated Codex config contains approval overrides outside the catalog.'
  )
} finally {
  await rm(codexHome, { recursive: true, force: true })
}

const readme = (await readFile(join(repositoryRoot, 'README.md'), 'utf8')).replaceAll(
  '\r\n',
  '\n'
)
assert(
  readme.includes(`現在のrepository／package versionは\`${packageJson.version}\`です。`) &&
    readme.includes(`/releases/tag/v${packageJson.version}`),
  `README version references must match package.json ${packageJson.version}.`
)
assert(
  readme.includes(`Codex Desktopへ登録するMCP toolは${commonTools.length}個です。`),
  `README must state the current ${commonTools.length}-tool Codex contract.`
)
const readmeToolSection = readme.match(
  /Codex Desktopへ登録するMCP toolは.*?\n([\s\S]*?)\n\nAI更新は/
)?.[1]
assert(readmeToolSection, 'README does not contain the Codex MCP tool table.')
assert(
  JSON.stringify(sorted(tableTools(readmeToolSection))) ===
    JSON.stringify(sorted(commonTools)),
  'README Codex MCP tool table differs from the catalog.'
)

const docsIndex = await readFile(join(repositoryRoot, 'docs', 'INDEX.md'), 'utf8')
assert(
  docsIndex.includes(
    `Codex Desktopの${commonTools.length}ツール登録、direct server ${directTools.length}ツール`
  ),
  'docs/INDEX.md must state the current Codex/direct tool counts.'
)

const integration = (
  await readFile(join(repositoryRoot, 'docs', 'mcp-integration.md'), 'utf8')
).replaceAll('\r\n', '\n')
assert(
  integration.includes(`## Codex Desktopへ登録する${commonTools.length}ツール`),
  'MCP integration guide must state the current Codex tool count.'
)
const commonSection = integration.match(
  /## Codex Desktopへ登録する.*?\n([\s\S]*?)\n### Direct server/
)?.[1]
const directOnlySection = integration.match(
  /### Direct server.*?\n([\s\S]*?)\ndirect serverは/
)?.[1]
assert(commonSection, 'MCP integration guide does not contain the common tool table.')
assert(directOnlySection, 'MCP integration guide does not contain the direct-only table.')
assert(
  JSON.stringify(sorted(tableTools(commonSection))) === JSON.stringify(sorted(commonTools)),
  'MCP integration common tool table differs from the catalog.'
)
assert(
  JSON.stringify(sorted(tableTools(directOnlySection))) ===
    JSON.stringify(sorted(catalog.directOnly)),
  'MCP integration direct-only table differs from the catalog.'
)

console.log(
  `TSUZUNE MCP contract check passed: Codex/Freebuff ${commonTools.length} tools, direct ${directTools.length} tools.`
)
