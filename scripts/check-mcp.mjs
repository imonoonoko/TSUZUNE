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
  await mkdir(join(vaultPath, 'Knowledge'))
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
    'add_link',
    'autonomous_update_note',
    'build_context',
    'create_note',
    'fetch',
    'get_backlinks',
    'move_note',
    'patch_note',
    'search',
    'suggest_links',
    'update_note'
  ]
  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${toolNames.join(', ')}`)
  }
  const toolsByName = new Map(listed.tools.map((tool) => [tool.name, tool]))
  const contextInputSchema = toolsByName.get('build_context')?.inputSchema
  const contextQuerySchema = contextInputSchema?.properties?.query
  if (
    contextQuerySchema?.type !== 'string' ||
    contextQuerySchema.maxLength !== 500 ||
    contextInputSchema?.required?.includes('query')
  ) {
    throw new Error('build_context query must be optional and limited to 500 characters.')
  }
  for (const name of ['search', 'fetch', 'get_backlinks', 'build_context', 'suggest_links']) {
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
  for (const name of ['create_note', 'update_note', 'autonomous_update_note', 'patch_note', 'move_note', 'add_link']) {
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
  if (
    toolsByName.get('autonomous_update_note')?.annotations?.destructiveHint !==
    true
  ) {
    throw new Error(
      'autonomous_update_note must disclose full-content replacement.'
    )
  }
  if (toolsByName.get('patch_note')?.annotations?.destructiveHint !== true) {
    throw new Error('patch_note must disclose that it modifies a note.')
  }

  if (toolsByName.get('move_note')?.annotations?.destructiveHint !== true) {
    throw new Error('move_note must disclose that it relocates a note.')
  }
  if (toolsByName.get('add_link')?.annotations?.destructiveHint !== true) {
    throw new Error('add_link must disclose that it modifies a note.')
  }

  const search = await client.callTool({
    name: 'search',
    arguments: { query: 'Local Markdown' }
  })
  if (
    search.isError ||
    search.structuredContent?.results?.length !== 1 ||
    search.content?.length !== 1 ||
    search.content[0]?.type !== 'text' ||
    search.content[0].text !==
      JSON.stringify(search.structuredContent, null, 2)
  ) {
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
    !Array.isArray(context.content) ||
    context.content.length !== 0 ||
    !String(context.structuredContent?.markdown).includes(
      'Projects/TSUZUNE.md'
    )
  ) {
    throw new Error('build_context did not return the structured-only context.')
  }

  const queriedContext = await client.callTool({
    name: 'build_context',
    arguments: {
      id: 'Home.md',
      max_characters: 5_000,
      query: 'Local Markdown'
    }
  })
  const queriedSource = queriedContext.structuredContent?.included?.find(
    (source) => source?.path === 'Projects/TSUZUNE.md'
  )
  if (
    queriedContext.isError ||
    !Array.isArray(queriedContext.content) ||
    queriedContext.content.length !== 0 ||
    String(queriedContext.structuredContent?.markdown).includes('Query:') ||
    !queriedSource?.selection_reasons?.includes('質問語に一致')
  ) {
    throw new Error('build_context did not pass query to the context builder.')
  }

  const rejectedLongQuery = await client.callTool({
    name: 'build_context',
    arguments: {
      id: 'Home.md',
      query: 'x'.repeat(501)
    }
  })
  if (!rejectedLongQuery.isError) {
    throw new Error('build_context accepted a query longer than 500 characters.')
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
      content: '# AI-created\n\nUpdated through MCP.\n\nUpdated through MCP.',
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

  const patched = await client.callTool({
    name: 'patch_note',
    arguments: {
      id: 'Projects/AI-created.md',
      expected_revision: updatedRevision,
      operations: [
        {
          find: 'Updated through MCP.',
          replace: 'Patched through MCP.',
          replace_all: true
        }
      ],
      reason: 'MCP replace_all smoke test'
    }
  })
  const patchedText = await readFile(
    join(vaultPath, 'Projects', 'AI-created.md'),
    'utf8'
  )
  if (
    patched.isError ||
    patched.structuredContent?.patch?.operations?.[0]?.match_count !== 2 ||
    patchedText.match(/Patched through MCP\./g)?.length !== 2 ||
    patchedText.includes('Updated through MCP.')
  ) {
    throw new Error('patch_note did not honor replace_all through MCP.')
  }

  const autonomous = await client.callTool({
    name: 'autonomous_update_note',
    arguments: {
      id: 'Projects/AI-created.md',
      content: '# AI-created\n\nUpdated autonomously through MCP.',
      reason: 'MCP smoke test',
      source_refs: ['NotebookLM/smoke-test.md']
    }
  })
  if (
    autonomous.isError ||
    autonomous.structuredContent?.provenance?.actor !== 'ai' ||
    autonomous.structuredContent?.provenance?.history_path === undefined ||
    !(await readFile(join(vaultPath, 'Projects', 'AI-created.md'), 'utf8')).includes(
      'Updated autonomously through MCP'
    )
  ) {
    throw new Error('autonomous_update_note did not apply the AI update.')
  }
  const updatedPath = join(vaultPath, 'Projects', 'AI-created.md')
  const autonomousRevision = autonomous.structuredContent?.metadata?.revision
  if (typeof autonomousRevision !== 'string') {
    throw new Error('autonomous_update_note did not return a revision token.')
  }
  const autonomousBefore = await stat(updatedPath)
  const unchanged = await client.callTool({
    name: 'autonomous_update_note',
    arguments: {
      id: 'Projects/AI-created.md',
      content: '# AI-created\n\nUpdated autonomously through MCP.',
      expected_revision: autonomousRevision,
      reason: 'MCP unchanged smoke test',
      source_refs: ['NotebookLM/smoke-test.md']
    }
  })
  if (
    unchanged.isError ||
    unchanged.structuredContent?.unchanged !== true ||
    unchanged.structuredContent?.provenance?.history_path !== undefined ||
    (await stat(updatedPath)).mtimeMs !== autonomousBefore.mtimeMs
  ) {
    throw new Error('autonomous_update_note did not return the revision-aware no-op.')
  }
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


  await client.callTool({
    name: 'create_note',
    arguments: {
      path: 'Knowledge/Context.md',
      content: '# Context\n\nAI AgentのContext-Sidecar構想。'
    }
  })
  const suggested = await client.callTool({
    name: 'suggest_links',
    arguments: { source: 'Home.md' }
  })
  if (
    suggested.isError ||
    !Array.isArray(suggested.structuredContent?.candidates) ||
    suggested.structuredContent.candidates.some(
      (candidate) => candidate?.target === 'Projects/TSUZUNE.md'
    )
  ) {
    throw new Error('suggest_links errored or returned an already-linked target.')
  }
  const linked = await client.callTool({
    name: 'add_link',
    arguments: {
      source: 'Home.md',
      target: 'Knowledge/Context.md',
      reason: 'MCP smoke test'
    }
  })
  if (
    linked.isError ||
    typeof linked.structuredContent?.history_path !== 'string' ||
    !(await readFile(join(vaultPath, 'Home.md'), 'utf8')).includes(
      '[[Knowledge/Context]]'
    )
  ) {
    throw new Error('add_link did not add the Wiki link with an audit trail.')
  }
  const linkAudit = await readFile(
    join(vaultPath, ...linked.structuredContent.history_path.split('/')),
    'utf8'
  )
  if (!linkAudit.includes('kind: note_link_add')) {
    throw new Error('add_link did not write a note_link_add audit record.')
  }

  await client.callTool({
    name: 'create_note',
    arguments: { path: 'Projects/Movable.md', content: '# Movable\n\nMove me.' }
  })
  const preflight = await client.callTool({
    name: 'move_note',
    arguments: {
      source: 'Projects/Movable.md',
      destination: 'History/Movable.md',
      preflight_only: true
    }
  })
  if (
    preflight.isError ||
    preflight.structuredContent?.preflight !== true ||
    !(await stat(join(vaultPath, 'Projects', 'Movable.md'))).isFile() ||
    !Array.isArray(preflight.structuredContent?.manifest?.link_impact_paths)
  ) {
    throw new Error('move_note preflight did not report safety without moving.')
  }
  const moved = await client.callTool({
    name: 'move_note',
    arguments: {
      source: 'Projects/Movable.md',
      destination: 'History/Movable.md',
      reason: 'MCP smoke test'
    }
  })
  if (
    moved.isError ||
    moved.structuredContent?.old_path !== 'Projects/Movable.md' ||
    moved.structuredContent?.new_path !== 'History/Movable.md' ||
    moved.structuredContent?.provenance?.actor !== 'ai' ||
    typeof moved.structuredContent?.history_path !== 'string' ||
    !(await readFile(join(vaultPath, 'History', 'Movable.md'), 'utf8')).includes(
      'Move me.'
    )
  ) {
    throw new Error('move_note did not move the note with an audit trail.')
  }
  let sourceStillExists = true
  try {
    await stat(join(vaultPath, 'Projects', 'Movable.md'))
  } catch {
    sourceStillExists = false
  }
  if (sourceStillExists) {
    throw new Error('move_note left the source note behind.')
  }
  const auditRecord = await readFile(
    join(vaultPath, ...moved.structuredContent.history_path.split('/')),
    'utf8'
  )
  if (!auditRecord.includes('kind: note_move')) {
    throw new Error('move_note did not write a note_move audit record.')
  }
  const movedCollision = await client.callTool({
    name: 'move_note',
    arguments: { source: 'Home.md', destination: 'History/Home-active.md' }
  })
  if (!movedCollision.isError) {
    throw new Error('move_note accepted an existing destination.')
  }
  const movedMissing = await client.callTool({
    name: 'move_note',
    arguments: { source: 'Projects/Nope.md', destination: 'History/Nope.md' }
  })
  if (!movedMissing.isError) {
    throw new Error('move_note accepted a missing source.')
  }
  const movedToTrash = await client.callTool({
    name: 'move_note',
    arguments: { source: 'Home.md', destination: '.trash/Home.md' }
  })
  if (!movedToTrash.isError) {
    throw new Error('move_note accepted an internal .trash destination.')
  }
  const movedNonMarkdown = await client.callTool({
    name: 'move_note',
    arguments: { source: 'Home.md', destination: 'History/Home.txt' }
  })
  if (!movedNonMarkdown.isError) {
    throw new Error('move_note accepted a non-Markdown destination.')
  }


  console.log('TSUZUNE MCP smoke check passed: 5 read tools and 6 write tools.')
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
