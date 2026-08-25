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
import {
  assertExactReadOnlyCoverage,
  assertNoTreeMutation
} from './mcp-readonly-integrity.mjs'

const vaultPath = await mkdtemp(join(tmpdir(), 'tsuzune-mcp-'))
const profilePath = await mkdtemp(join(tmpdir(), 'tsuzune-mcp-profile-'))
const settingsPath = join(profilePath, 'settings.json')
const escapedPath = join(
  vaultPath,
  '..',
  `tsuzune-mcp-escape-${process.pid}-${Date.now()}.md`
)
const serverPath = resolve(process.env.TSUZUNE_MCP_SERVER_PATH ?? 'out/mcp/server.js')
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    serverPath,
    '--vault',
    vaultPath,
    '--settings',
    settingsPath,
    '--drive-sync-state',
    join(vaultPath, 'missing-drive-sync-state.json')
  ],
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
  await mkdir(join(vaultPath, '.tsuzune'))
  await mkdir(join(vaultPath, '50_履歴', 'AI更新'), { recursive: true })
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
    join(vaultPath, 'Knowledge', 'Backlink.md'),
    '# Knowledge backlink\n\n[[Projects/TSUZUNE]]',
    'utf8'
  )
  await writeFile(
    join(vaultPath, '50_履歴', 'AI更新', 'Backlink.md'),
    '# History backlink\n\n[[Projects/TSUZUNE]]',
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

  const serverInstructions = client.getInstructions()
  const requiredInstructionTerms = [
    'search',
    'fetch',
    'build_context',
    '40_情報源',
    '50_履歴',
    '削除',
    '強制上書き',
    'Vault外',
    '禁止',
    'MCPが強制'
  ]
  if (
    typeof serverInstructions !== 'string' ||
    serverInstructions.length > 160 ||
    requiredInstructionTerms.some((term) => !serverInstructions.includes(term))
  ) {
    throw new Error(
      'Server instructions must stay concise while preserving routing and safety boundaries.'
    )
  }

  const listed = await client.listTools()
  const toolNames = listed.tools.map((tool) => tool.name).sort()
  const toolCatalog = JSON.parse(
    await readFile(new URL('../src/mcp/tool-catalog.json', import.meta.url), 'utf8')
  )
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  const expected = [...toolCatalog.common, ...toolCatalog.directOnly].sort()
  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${toolNames.join(', ')}`)
  }
  const toolsByName = new Map(listed.tools.map((tool) => [tool.name, tool]))
  const requiredDescriptionTerms = {
    search: ['Use first', 'note id is unknown', 'fetch', 'build_context'],
    fetch: ['full Markdown', 'revision', 'build_context', 'one note'],
    build_context: ['linked or temporal context', 'fetch', 'one note', 'included-source metadata'],
    create_note: ['user directly asks', 'active project contract explicitly requires']
  }
  for (const [name, terms] of Object.entries(requiredDescriptionTerms)) {
    const description = toolsByName.get(name)?.description ?? ''
    if (terms.some((term) => !description.includes(term))) {
      throw new Error(`${name} description lost its semantic contract.`)
    }
  }
  const contextInputSchema = toolsByName.get('build_context')?.inputSchema
  const contextQuerySchema = contextInputSchema?.properties?.query
  if (
    contextQuerySchema?.type !== 'string' ||
    contextQuerySchema.maxLength !== 500 ||
    contextInputSchema?.required?.includes('query')
  ) {
    throw new Error('build_context query must be optional and limited to 500 characters.')
  }
  const contextOutputSchema = toolsByName.get('build_context')?.outputSchema
  const contextSourceSchema = contextOutputSchema?.properties?.included?.items
  if (
    contextSourceSchema?.properties?.revision?.type !== 'string' ||
    contextSourceSchema?.properties?.modified_at?.type !== 'string' ||
    !contextSourceSchema.required?.includes('revision') ||
    !contextSourceSchema.required?.includes('modified_at')
  ) {
    throw new Error(
      'build_context must expose required revision and modified_at source descriptors.'
    )
  }
  const backlinksTool = toolsByName.get('get_backlinks')
  const backlinksInputSchema = backlinksTool?.inputSchema
  const backlinksOutputSchema = backlinksTool?.outputSchema
  if (
    backlinksInputSchema?.properties?.include_history?.type !== 'boolean' ||
    backlinksInputSchema?.required?.includes('include_history') ||
    backlinksInputSchema?.properties?.after?.type !== 'string' ||
    backlinksInputSchema.properties.after.maxLength !== 500 ||
    backlinksInputSchema?.required?.includes('after') ||
    backlinksOutputSchema?.properties?.next_after?.type !== 'string'
  ) {
    throw new Error(
      'get_backlinks must expose optional history and bounded path-cursor inputs.'
    )
  }
  const directoryTool = toolsByName.get('list_directory')
  const directoryInputSchema = directoryTool?.inputSchema
  const directoryOutputSchema = directoryTool?.outputSchema
  if (
    directoryInputSchema?.properties?.expected_fingerprint?.type !== 'string' ||
    directoryInputSchema.properties.expected_fingerprint.pattern !==
      '^sha256:[a-f0-9]{64}$' ||
    directoryInputSchema?.required?.includes('expected_fingerprint') ||
    directoryOutputSchema?.properties?.fingerprint?.type !== 'string' ||
    !directoryOutputSchema?.required?.includes('fingerprint')
  ) {
    throw new Error(
      'list_directory must expose an optional expected fingerprint and a required current fingerprint.'
    )
  }
  for (const name of ['runtime_info', 'delivery_info', 'search', 'fetch', 'get_backlinks', 'build_context', 'list_directory', 'preflight_move_entry', 'suggest_links']) {
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
  const drivePreviewAnnotations = toolsByName.get('preview_drive_sync')?.annotations
  if (
    drivePreviewAnnotations?.readOnlyHint !== true ||
    drivePreviewAnnotations.destructiveHint !== false ||
    drivePreviewAnnotations.idempotentHint !== true ||
    drivePreviewAnnotations.openWorldHint !== true
  ) {
    throw new Error('preview_drive_sync has incorrect annotations.')
  }
  for (const name of ['create_directory', 'create_note', 'update_note', 'autonomous_update_note', 'patch_note', 'move_entry', 'add_link']) {
    const annotations = toolsByName.get(name)?.annotations
    if (
      annotations?.readOnlyHint !== false ||
      annotations.idempotentHint !== false ||
      annotations.openWorldHint !== false
    ) {
      throw new Error(`${name} has incorrect write annotations.`)
    }
  }
  const driveApplyAnnotations = toolsByName.get('apply_drive_sync')?.annotations
  if (
    driveApplyAnnotations?.readOnlyHint !== false ||
    driveApplyAnnotations.destructiveHint !== true ||
    driveApplyAnnotations.idempotentHint !== false ||
    driveApplyAnnotations.openWorldHint !== true
  ) {
    throw new Error('apply_drive_sync has incorrect annotations.')
  }
  if (toolsByName.get('create_note')?.annotations?.destructiveHint !== false) {
    throw new Error('create_note must be marked non-destructive.')
  }
  if (toolsByName.get('create_directory')?.annotations?.destructiveHint !== false) {
    throw new Error('create_directory must be marked non-destructive.')
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

  const declaredReadOnlyToolNames = listed.tools
    .filter((tool) => tool.annotations?.readOnlyHint === true)
    .map((tool) => tool.name)
    .sort()
  const exercisedReadOnlyToolNames = new Set()
  const readOnlyScopes = [
    { name: 'vault', path: vaultPath },
    { name: 'profile', path: profilePath }
  ]
  async function callReadOnlyTool(request) {
    if (!declaredReadOnlyToolNames.includes(request.name)) {
      throw new Error(`${request.name} is not declared read-only.`)
    }
    const result = await assertNoTreeMutation(
      readOnlyScopes,
      () => client.callTool(request),
      `read-only MCP tool ${request.name}`
    )
    exercisedReadOnlyToolNames.add(request.name)
    return result
  }

  const runtimeInfo = await callReadOnlyTool({
    name: 'runtime_info',
    arguments: {}
  })
  const runtime = runtimeInfo.structuredContent
  if (
    runtimeInfo.isError ||
    runtime?.server_version !== packageJson.version ||
    runtime?.package_version !== packageJson.version ||
    runtime?.profile !== 'direct' ||
    !Number.isFinite(Date.parse(runtime?.process_started_at)) ||
    !Number.isFinite(Date.parse(runtime?.build_updated_at)) ||
    runtime?.stale_runtime !== false ||
    !/^sha256:[0-9a-f]{64}$/.test(runtime?.vault_id)
  ) {
    throw new Error('runtime_info did not return the active runtime identity.')
  }

  const deliveryInfo = await callReadOnlyTool({
    name: 'delivery_info',
    arguments: {}
  })
  const delivery = deliveryInfo.structuredContent
  if (
    deliveryInfo.isError ||
    !delivery ||
    JSON.stringify(Object.keys(delivery).sort()) !== JSON.stringify(['status']) ||
    !['match', 'mismatch', 'unknown'].includes(delivery.status) ||
    deliveryInfo.content?.length !== 1 ||
    deliveryInfo.content[0]?.type !== 'text' ||
    deliveryInfo.content[0].text !== JSON.stringify(delivery, null, 2)
  ) {
    throw new Error('delivery_info did not return the bounded delivery status.')
  }

  const serverTimes = await stat(serverPath)
  try {
    const future = new Date(Date.now() + 60_000)
    await utimes(serverPath, future, future)
    const staleRuntime = await callReadOnlyTool({
      name: 'runtime_info',
      arguments: {}
    })
    if (
      staleRuntime.isError ||
      staleRuntime.structuredContent?.stale_runtime !== true
    ) {
      throw new Error('runtime_info did not detect a replaced server build.')
    }
  } finally {
    await utimes(serverPath, serverTimes.atime, serverTimes.mtime)
  }

  if (toolsByName.get('move_entry')?.annotations?.destructiveHint !== true) {
    throw new Error('move_entry must disclose that it relocates a note.')
  }
  if (toolsByName.get('add_link')?.annotations?.destructiveHint !== true) {
    throw new Error('add_link must disclose that it modifies a note.')
  }

  const unavailableDrivePreview = await callReadOnlyTool({
    name: 'preview_drive_sync',
    arguments: {}
  })
  if (
    !unavailableDrivePreview.isError ||
    !String(unavailableDrivePreview.content?.[0]?.text).includes(
      'TSUZUNE本体を起動'
    )
  ) {
    throw new Error('preview_drive_sync did not fail closed without the app.')
  }

  const search = await callReadOnlyTool({
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

  const fetched = await callReadOnlyTool({
    name: 'fetch',
    arguments: { id: 'Projects/TSUZUNE.md' }
  })
  if (
    fetched.isError ||
    fetched.structuredContent?.id !== 'Projects/TSUZUNE.md'
  ) {
    throw new Error('fetch did not return the expected note.')
  }

  const suggested = await callReadOnlyTool({
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

  const firstBacklinks = await callReadOnlyTool({
    name: 'get_backlinks',
    arguments: { id: 'Projects/TSUZUNE.md', limit: 1 }
  })
  const nextAfter = firstBacklinks.structuredContent?.next_after
  const secondBacklinks = await callReadOnlyTool({
    name: 'get_backlinks',
    arguments: {
      id: 'Projects/TSUZUNE.md',
      limit: 1,
      after: nextAfter
    }
  })
  const backlinkIds = [
    ...(firstBacklinks.structuredContent?.backlinks ?? []),
    ...(secondBacklinks.structuredContent?.backlinks ?? [])
  ].map((item) => item.id)
  if (
    firstBacklinks.isError ||
    secondBacklinks.isError ||
    firstBacklinks.structuredContent?.total !== 2 ||
    secondBacklinks.structuredContent?.total !== 2 ||
    typeof nextAfter !== 'string' ||
    secondBacklinks.structuredContent?.next_after !== undefined ||
    backlinkIds.length !== 2 ||
    new Set(backlinkIds).size !== 2 ||
    backlinkIds.some((id) => id.startsWith('50_履歴/'))
  ) {
    throw new Error('get_backlinks did not page filtered sources correctly.')
  }
  const backlinksWithHistory = await callReadOnlyTool({
    name: 'get_backlinks',
    arguments: {
      id: 'Projects/TSUZUNE.md',
      limit: 50,
      include_history: true
    }
  })
  if (
    backlinksWithHistory.isError ||
    backlinksWithHistory.structuredContent?.total !== 3 ||
    !backlinksWithHistory.structuredContent?.backlinks?.some((item) =>
      item.id.startsWith('50_履歴/')
    )
  ) {
    throw new Error('get_backlinks did not include history when requested.')
  }

  const context = await callReadOnlyTool({
    name: 'build_context',
    arguments: { id: 'Home.md', max_characters: 5_000 }
  })
  if (
    context.isError ||
    !Array.isArray(context.content) ||
    context.content.length !== 1 ||
    context.content[0]?.type !== 'text' ||
    !String(context.content[0]?.text).includes('Projects/TSUZUNE.md') ||
    !String(context.structuredContent?.markdown).includes(
      'Projects/TSUZUNE.md'
    )
  ) {
    throw new Error('build_context did not return the context in text content.')
  }
  const contextSource = context.structuredContent?.included?.find(
    (source) => source?.path === 'Projects/TSUZUNE.md'
  )
  if (
    contextSource?.revision !== fetched.structuredContent?.metadata?.revision ||
    contextSource?.modified_at !== fetched.structuredContent?.metadata?.modified_at
  ) {
    throw new Error(
      'build_context source descriptors did not match fetch for the same note.'
    )
  }

  const queriedContext = await callReadOnlyTool({
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
    queriedContext.content.length !== 1 ||
    queriedContext.content[0]?.type !== 'text' ||
    String(queriedContext.structuredContent?.markdown).includes('Query:') ||
    !queriedSource?.selection_reasons?.includes('質問語に一致')
  ) {
    throw new Error('build_context did not pass query to the context builder.')
  }

  const rejectedLongQuery = await callReadOnlyTool({
    name: 'build_context',
    arguments: {
      id: 'Home.md',
      query: 'x'.repeat(501)
    }
  })
  if (!rejectedLongQuery.isError) {
    throw new Error('build_context accepted a query longer than 500 characters.')
  }

  const temporalContext = await callReadOnlyTool({
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

  const knowledgeContext = await callReadOnlyTool({
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

  const rejected = await callReadOnlyTool({
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

  const rejectedDirectory = await client.callTool({
    name: 'create_directory',
    arguments: { path: '../outside' }
  })
  if (!rejectedDirectory.isError) {
    throw new Error('create_directory accepted a path outside the Vault.')
  }

  const listedDirectory = await callReadOnlyTool({
    name: 'list_directory',
    arguments: { path: 'Projects', depth: 1 }
  })
  if (
    listedDirectory.isError ||
    !/^sha256:[a-f0-9]{64}$/.test(
      listedDirectory.structuredContent?.fingerprint ?? ''
    ) ||
    !listedDirectory.structuredContent?.entries?.some(
      (entry) => entry.path === 'Projects/TSUZUNE.md' && entry.type === 'markdown'
    ) ||
    JSON.stringify(listedDirectory.structuredContent).includes('AI連携を試す')
  ) {
    throw new Error('list_directory did not return content-free entry metadata.')
  }
  await writeFile(
    join(vaultPath, 'Projects', 'Changed-after-page.md'),
    '# Changed after page',
    'utf8'
  )
  const staleDirectoryPage = await callReadOnlyTool({
    name: 'list_directory',
    arguments: {
      path: 'Projects',
      depth: 1,
      after: 'Projects/TSUZUNE.md',
      expected_fingerprint: listedDirectory.structuredContent.fingerprint
    }
  })
  if (
    !staleDirectoryPage.isError ||
    !String(staleDirectoryPage.content?.[0]?.text).includes('先頭ページ')
  ) {
    throw new Error('list_directory did not reject a changed scope fingerprint.')
  }
  await rm(join(vaultPath, 'Projects', 'Changed-after-page.md'))

  const createdDirectory = await client.callTool({
    name: 'create_directory',
    arguments: { path: 'Projects/Research' }
  })
  if (
    createdDirectory.isError ||
    createdDirectory.structuredContent?.path !== 'Projects/Research'
  ) {
    throw new Error('create_directory did not create the expected folder.')
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

  const openedForUpdate = await callReadOnlyTool({
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

  const unavailableMovePreflight = await callReadOnlyTool({
    name: 'preflight_move_entry',
    arguments: {
      source: 'Projects/TSUZUNE.md',
      destination: 'History/TSUZUNE.md'
    }
  })
  if (
    !unavailableMovePreflight.isError ||
    !String(unavailableMovePreflight.content?.[0]?.text).includes(
      'TSUZUNE本体を起動'
    )
  ) {
    throw new Error('preflight_move_entry did not fail closed without the app.')
  }
  const unavailableMove = await client.callTool({
    name: 'move_entry',
    arguments: {
      source: 'Projects/TSUZUNE.md',
      destination: 'History/TSUZUNE.md',
      expected_fingerprint: 'sha256:unavailable',
      reason: 'MCP smoke test',
      source_refs: []
    }
  })
  if (
    !unavailableMove.isError ||
    !String(unavailableMove.content?.[0]?.text).includes(
      'TSUZUNE本体を起動'
    )
  ) {
    throw new Error('move_entry did not fail closed without the app.')
  }
  assertExactReadOnlyCoverage(
    declaredReadOnlyToolNames,
    exercisedReadOnlyToolNames
  )
  console.log('TSUZUNE MCP smoke check passed: 10 read tools and 8 write tools.')
} catch (error) {
  if (stderr.trim()) {
    console.error(stderr.trim())
  }
  throw error
} finally {
  await client.close().catch(() => undefined)
  await rm(vaultPath, { recursive: true, force: true })
  await rm(profilePath, { recursive: true, force: true })
  await rm(escapedPath, { force: true })
}
