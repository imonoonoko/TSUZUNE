import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const vaultPath = await mkdtemp(join(tmpdir(), 'tsuzune-mcp-freebuff-'))
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(process.env.TSUZUNE_MCP_SERVER_PATH ?? 'out/mcp/server.js'), '--vault', vaultPath, '--profile', 'freebuff'],
  stderr: 'pipe'
})
const client = new Client({
  name: 'tsuzune-mcp-freebuff-check',
  version: '0.3.0'
})

let stderr = ''
transport.stderr?.on('data', (chunk) => {
  stderr += chunk.toString()
})

try {
  await client.connect(transport)

  const listed = await client.listTools()
  const toolNames = listed.tools.map((tool) => tool.name).sort()
  const toolCatalog = JSON.parse(
    await readFile(new URL('../src/mcp/tool-catalog.json', import.meta.url), 'utf8')
  )
  const expected = [...toolCatalog.common].sort()

  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected Freebuff tools: ${toolNames.join(', ')}`)
  }

  const runtimeInfo = await client.callTool({
    name: 'runtime_info',
    arguments: {}
  })
  if (
    runtimeInfo.isError ||
    runtimeInfo.structuredContent?.profile !== 'freebuff' ||
    runtimeInfo.structuredContent?.stale_runtime !== false ||
    !/^sha256:[0-9a-f]{64}$/.test(
      runtimeInfo.structuredContent?.vault_id
    )
  ) {
    throw new Error('Freebuff runtime_info did not report its active profile.')
  }

  const definitionCharacters = JSON.stringify(listed.tools).length
  console.log(
    `Freebuff MCP check passed (${toolNames.length} tools, ${definitionCharacters} definition characters).`
  )
} catch (error) {
  if (stderr) {
    console.error(stderr)
  }
  throw error
} finally {
  await client.close().catch(() => undefined)
  await rm(vaultPath, { recursive: true, force: true })
}
