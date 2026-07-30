import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const vaultPath = await mkdtemp(join(tmpdir(), 'tsuzune-mcp-'))
const escapedPath = join(
  vaultPath,
  '..',
  `tsuzune-mcp-escape-${process.pid}-${Date.now()}.md`
)
const serverPath = resolve('out/mcp/server.js')
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath, '--vault', vaultPath],
  stderr: 'pipe'
})
const client = new Client({
  name: 'tsuzune-mcp-check',
  version: '0.3.0'
})

let stderr = ''
transport.stderr?.on('data', (chunk) => {
  stderr += chunk.toString()
})

try {
  await mkdir(join(vaultPath, 'Projects'))
  await mkdir(join(vaultPath, 'History'))
  await writeFile(
    join(vaultPath, 'Home.md'),
    '# Home\n\nTSUZUNE MCP smoke test. [[Projects/TSUZUNE]]',
    'utf8'
  )
  await writeFile(
    join(vaultPath, 'Projects', 'TSUZUNE.md'),
    '# TSUZUNE\n\nLocal Markdown memory.',
    'utf8'
  )
  await writeFile(
    join(vaultPath, 'History', 'Home-planning.md'),
    [
      '---',
      'kind: state',
      'subject: "[[Home]]"',
      'status: planning',
      'valid_from: 2026-06-01',
      'valid_to: 2026-07-01',
      '---',
      '# Home planning'
    ].join('\n'),
    'utf8'
  )
  await writeFile(
    join(vaultPath, 'History', 'Home-active.md'),
    [
      '---',
      'kind: state',
      'subject: "[[Home]]"',
      'status: active',
      'valid_from: 2026-07-01',
      '---',
      '# Home active'
    ].join('\n'),
    'utf8'
  )

  await client.connect(transport)

  const listed = await client.listTools()
  const toolNames = listed.tools.map((tool) => tool.name).sort()
  const expected = [
    'build_context',
    'create_note',
    'fetch',
    'get_backlinks',
    'search',
    'update_note'
  ]
  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${toolNames.join(', ')}`)
  }
  const toolsByName = new Map(listed.tools.map((tool) => [tool.name, tool]))
  for (const name of ['search', 'fetch', 'get_backlinks', 'build_context']) {
    const annotations = toolsByName.get(name)?.annotations
    if (
      annotations?.readOnlyHint !== true ||
      annotations.destructiveHint !== false ||
      annotations.idempotentHint !== true ||
      annotations.openWorldHint !== false
    ) {
      throw new Error(`${name} has incorrect read-only annotations.`)
    }
  }
  for (const name of ['create_note', 'update_note']) {
    const annotations = toolsByName.get(name)?.annotations
    if (
      annotations?.readOnlyHint !== false ||
      annotations.idempotentHint !== false ||
      annotations.openWorldHint !== false
    ) {
      throw new Error(`${name} has incorrect write annotations.`)
    }
  }
  if (toolsByName.get('create_note')?.annotations?.destructiveHint !== false) {
    throw new Error('create_note must be marked non-destructive.')
  }
  if (toolsByName.get('update_note')?.annotations?.destructiveHint !== true) {
    throw new Error('update_note must disclose full-content replacement.')
  }

  const search = await client.callTool({
    name: 'search',
    arguments: { query: 'Local Markdown' }
  })
  if (search.isError || search.structuredContent?.results?.length !== 1) {
    throw new Error('search did not return the expected note.')
  }

  const fetched = await client.callTool({
    name: 'fetch',
    arguments: { id: 'Projects/TSUZUNE.md' }
  })
  if (
    fetched.isError ||
    fetched.structuredContent?.id !== 'Projects/TSUZUNE.md'
  ) {
    throw new Error('fetch did not return the expected note.')
  }

  const backlinks = await client.callTool({
    name: 'get_backlinks',
    arguments: { id: 'Projects/TSUZUNE.md' }
  })
  if (
    backlinks.isError ||
    backlinks.structuredContent?.total !== 1
  ) {
    throw new Error('get_backlinks did not return the expected source.')
  }

  const context = await client.callTool({
    name: 'build_context',
    arguments: { id: 'Home.md', max_characters: 5_000 }
  })
  if (
    context.isError ||
    !String(context.structuredContent?.markdown).includes(
      'Projects/TSUZUNE.md'
    )
  ) {
    throw new Error('build_context did not include the linked note.')
  }

  const temporalContext = await client.callTool({
    name: 'build_context',
    arguments: {
      id: 'Home.md',
      max_characters: 5_000,
      as_of: '2026-07-15',
      include_history: true
    }
  })
  const temporalSources = temporalContext.structuredContent?.included
  const historicalSource = Array.isArray(temporalSources)
    ? temporalSources.find(
        (source) => source?.path === 'History/Home-planning.md'
      )
    : undefined
  const historicalSeed = Array.isArray(temporalSources)
    ? temporalSources.find((source) => source?.path === 'Home.md')
    : undefined
  const temporalWarnings = temporalContext.structuredContent?.warnings
  if (
    temporalContext.isError ||
    temporalContext.structuredContent?.as_of !== '2026-07-15' ||
    temporalContext.structuredContent?.temporal_perspective !==
      'valid-time' ||
    historicalSeed?.content_omitted !== true ||
    historicalSource?.temporal_status !== 'historical' ||
    !Array.isArray(historicalSource?.selection_reasons) ||
    !Array.isArray(temporalWarnings) ||
    !temporalWarnings.some(
      (warning) =>
        warning?.code === 'UNSCOPED_NORMAL_CONTENT_OMITTED'
    ) ||
    String(temporalContext.structuredContent?.markdown).includes(
      'TSUZUNE MCP smoke test.'
    )
  ) {
    throw new Error(
      'build_context did not expose the requested temporal context.'
    )
  }

  const knowledgeContext = await client.callTool({
    name: 'build_context',
    arguments: {
      id: 'Home.md',
      max_characters: 5_000,
      as_of: '2026-07-15',
      temporal_perspective: 'knowledge-time'
    }
  })
  if (
    knowledgeContext.isError ||
    knowledgeContext.structuredContent?.temporal_perspective !==
      'knowledge-time' ||
    String(knowledgeContext.structuredContent?.markdown).includes(
      '# Home active'
    )
  ) {
    throw new Error(
      'build_context did not honor the requested knowledge-time perspective.'
    )
  }

  const rejected = await client.callTool({
    name: 'fetch',
    arguments: { id: '../outside.md' }
  })
  if (!rejected.isError) {
    throw new Error('fetch accepted a path outside the Vault.')
  }

  const rejectedCreate = await client.callTool({
    name: 'create_note',
    arguments: {
      path: `../${escapedPath.split(/[\\/]/).at(-1)}`,
      content: 'Must stay inside the Vault.'
    }
  })
  if (!rejectedCreate.isError) {
    throw new Error('create_note accepted a path outside the Vault.')
  }

  const created = await client.callTool({
    name: 'create_note',
    arguments: {
      path: 'Projects/AI-created.md',
      content: '# AI-created\n\nCreated through MCP.'
    }
  })
  if (
    created.isError ||
    created.structuredContent?.id !== 'Projects/AI-created.md'
  ) {
    throw new Error('create_note did not create the expected note.')
  }

  const openedForUpdate = await client.callTool({
    name: 'fetch',
    arguments: { id: 'Projects/AI-created.md' }
  })
  const revision = openedForUpdate.structuredContent?.metadata?.revision
  if (typeof revision !== 'string') {
    throw new Error('fetch did not return a revision token.')
  }

  const updated = await client.callTool({
    name: 'update_note',
    arguments: {
      id: 'Projects/AI-created.md',
      content: '# AI-created\n\nUpdated through MCP.',
      expected_revision: revision
    }
  })
  if (
    updated.isError ||
    !(await readFile(join(vaultPath, 'Projects', 'AI-created.md'), 'utf8')).includes(
      'Updated through MCP'
    )
  ) {
    throw new Error('update_note did not update the expected revision.')
  }

  const updatedRevision = updated.structuredContent?.metadata?.revision
  if (typeof updatedRevision !== 'string') {
    throw new Error('update_note did not return a new revision token.')
  }
  const updatedPath = join(vaultPath, 'Projects', 'AI-created.md')
  await writeFile(updatedPath, 'External change', 'utf8')
  const currentInfo = await stat(updatedPath)
  const externalTime = new Date(currentInfo.mtimeMs + 10_000)
  await utimes(updatedPath, externalTime, externalTime)
  const conflict = await client.callTool({
    name: 'update_note',
    arguments: {
      id: 'Projects/AI-created.md',
      content: 'Stale overwrite',
      expected_revision: updatedRevision
    }
  })
  if (
    !conflict.isError ||
    (await readFile(updatedPath, 'utf8')) !== 'External change'
  ) {
    throw new Error('update_note did not preserve an external change.')
  }

  console.log('TSUZUNE MCP smoke check passed: 4 read tools and 2 write tools.')
} catch (error) {
  if (stderr.trim()) {
    console.error(stderr.trim())
  }
  throw error
} finally {
  await client.close().catch(() => undefined)
  await rm(vaultPath, { recursive: true, force: true })
  await rm(escapedPath, { force: true })
}
