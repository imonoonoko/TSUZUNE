import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'

const token = process.env.TSUZUNE_LIVE_DRIVE_ACCESS_TOKEN
if (!token || process.env.TSUZUNE_LIVE_DRIVE_ACCEPT !== 'disposable-only') {
  throw new Error(
    'Set a transient access token and TSUZUNE_LIVE_DRIVE_ACCEPT=disposable-only.'
  )
}

const api = 'https://www.googleapis.com/drive/v3/files'
const uploadApi = 'https://www.googleapis.com/upload/drive/v3/files'
const fields = 'id,name,mimeType,parents,version,md5Checksum,appProperties,trashed'
const acceptance = 'o2-p4-live-roundtrip'
const vaultId = `acceptance-${randomUUID()}`
const createdIds = []

async function request(url, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    throw new Error(`Drive API ${response.status}: ${(await response.text()).trim()}`)
  }
  return response.status === 204 ? null : response.json()
}

function urlFor(base, id, query = {}) {
  const url = new URL(id ? `${base}/${encodeURIComponent(id)}` : base)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url
}

function multipart(metadata, bytes, mimeType) {
  const boundary = `tsuzune_${randomUUID()}`
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
  }
}

async function createMetadata(metadata) {
  const file = await request(urlFor(api, null, { fields }), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(metadata)
  })
  createdIds.push(file.id)
  return file
}

async function createFile(metadata, bytes, mimeType) {
  const body = multipart(metadata, bytes, mimeType)
  const file = await request(urlFor(uploadApi, null, { uploadType: 'multipart', fields }), {
    method: 'POST',
    headers: { 'content-type': body.contentType },
    body: body.body
  })
  createdIds.push(file.id)
  return file
}

async function patchMetadata(id, metadata) {
  return request(urlFor(api, id, { fields }), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(metadata)
  })
}

async function replaceContent(id, metadata, bytes, mimeType) {
  const body = multipart(metadata, bytes, mimeType)
  return request(urlFor(uploadApi, id, { uploadType: 'multipart', fields }), {
    method: 'PATCH',
    headers: { 'content-type': body.contentType },
    body: body.body
  })
}

async function download(id) {
  const response = await fetch(urlFor(api, id, { alt: 'media' }), {
    headers: { authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error(`Drive download ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function cleanupStale() {
  const q = `trashed = false and appProperties has { key='tsuzuneAcceptance' and value='${acceptance}' }`
  const listed = await request(urlFor(api, null, { q, spaces: 'drive', fields: 'files(id)' }))
  for (const file of listed.files ?? []) await patchMetadata(file.id, { trashed: true })
  return listed.files?.length ?? 0
}

async function run() {
  const staleObjectsTrashed = await cleanupStale()
  const oldPath = '00_inbox/Live Acceptance.md'
  const newPath = '10_notes/Live Acceptance.md'
  const noteBytes = Buffer.from('# Live acceptance\n\nDisposable fixture only.\n')
  const aliasBefore = Buffer.from('{"version":1,"aliases":{}}\n')
  const aliasAfter = Buffer.from(
    `${JSON.stringify({ version: 1, aliases: { [oldPath]: newPath } })}\n`
  )
  const owned = { tsuzuneVaultId: vaultId, tsuzuneAcceptance: acceptance }

  const root = await createMetadata({
    name: `TSUZUNE Live Acceptance ${new Date().toISOString()}`,
    mimeType: 'application/vnd.google-apps.folder',
    appProperties: { ...owned, tsuzuneRole: 'vaultRoot' }
  })
  const note = await createFile(
    {
      name: 'Live Acceptance.md',
      mimeType: 'text/markdown',
      parents: [root.id],
      appProperties: { ...owned, tsuzunePath: oldPath }
    },
    noteBytes,
    'text/markdown; charset=UTF-8'
  )
  const alias = await createFile(
    {
      name: 'path-aliases.json',
      mimeType: 'application/json',
      parents: [root.id],
      appProperties: { ...owned, tsuzuneRole: 'pathAliases' }
    },
    aliasBefore,
    'application/json; charset=UTF-8'
  )

  const moved = await patchMetadata(note.id, {
    name: 'Live Acceptance.md',
    appProperties: { tsuzunePath: newPath }
  })
  const aliasMoved = await replaceContent(
    alias.id,
    { appProperties: { tsuzuneRole: 'pathAliases' } },
    aliasAfter,
    'application/json; charset=UTF-8'
  )

  assert.equal(moved.id, note.id)
  assert.deepEqual(moved.parents, note.parents)
  assert.equal(moved.appProperties.tsuzunePath, newPath)
  assert.notEqual(moved.version, note.version)
  assert.equal(moved.md5Checksum, note.md5Checksum)
  assert.deepEqual(await download(note.id), noteBytes)
  assert.equal(aliasMoved.id, alias.id)
  assert.notEqual(aliasMoved.version, alias.version)
  assert.deepEqual(await download(alias.id), aliasAfter)

  const restored = await patchMetadata(note.id, {
    name: 'Live Acceptance.md',
    appProperties: { tsuzunePath: oldPath }
  })
  const aliasRestored = await replaceContent(
    alias.id,
    { appProperties: { tsuzuneRole: 'pathAliases' } },
    aliasBefore,
    'application/json; charset=UTF-8'
  )

  assert.equal(restored.id, note.id)
  assert.deepEqual(restored.parents, note.parents)
  assert.equal(restored.appProperties.tsuzunePath, oldPath)
  assert.notEqual(restored.version, moved.version)
  assert.equal(restored.md5Checksum, note.md5Checksum)
  assert.deepEqual(await download(note.id), noteBytes)
  assert.equal(aliasRestored.id, alias.id)
  assert.deepEqual(await download(alias.id), aliasBefore)

  return {
    result: 'pass',
    staleObjectsTrashed,
    sameMarkdownFileId: true,
    parentPreserved: true,
    privatePathMetadataRoundtrip: true,
    versionAdvanced: true,
    markdownBytesPreserved: true,
    sameAliasFileId: true,
    aliasBytesRoundtrip: true
  }
}

let result
try {
  result = await run()
} finally {
  const cleanup = []
  for (const id of [...createdIds].reverse()) {
    try {
      const trashed = await patchMetadata(id, { trashed: true })
      cleanup.push(trashed.trashed === true)
    } catch {
      cleanup.push(false)
    }
  }
  if (result) result.cleanupComplete = cleanup.every(Boolean)
}

assert.equal(result.cleanupComplete, true)
console.log(JSON.stringify(result, null, 2))
