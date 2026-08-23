import { createHash, randomUUID } from 'node:crypto'
import { validateRelativePath } from '../core/paths'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_CHANGES_URL = 'https://www.googleapis.com/drive/v3/changes'
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files'
const MARKDOWN_MIME_TYPE = 'text/markdown'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const DRIVE_PROPERTY_LIMIT_BYTES = 124
const PATH_PROPERTY = 'tsuzunePath'
const PATH_DESCRIPTION_PREFIX = 'TSUZUNE path: '

const MARKDOWN_FIELDS =
  'id,name,mimeType,parents,version,md5Checksum,description,appProperties,trashed'
const ROOT_FIELDS = 'id,name,mimeType,parents,version,appProperties'

export interface DriveMarkdownFile {
  id: string
  name: string
  path: string
  parentIds: string[]
  version: string | null
  md5Checksum: string | null
  appProperties: {
    tsuzuneVaultId: string
    tsuzunePath: string
  }
}

export interface DriveVaultRoot {
  id: string
  name: string
  parentIds: string[]
  version: string | null
  appProperties: {
    tsuzuneVaultId: string
    tsuzuneRole: 'vaultRoot'
  }
}

export interface DriveChange {
  fileId: string
  removed: boolean
  file: DriveMarkdownFile | null
}

export interface DriveChangePage {
  changes: DriveChange[]
  newStartPageToken: string
}

export class DriveChangeTokenInvalidError extends Error {}

export interface CreateMarkdownInput {
  vaultId: string
  path: string
  parentId: string
  content: string
}

export interface UpdateMarkdownInput {
  fileId: string
  vaultId: string
  path: string
  expectedVersion: string
  expectedMd5Checksum?: string | null
  expectedContentHash?: string
  content: string
}

export interface MoveMarkdownInput {
  fileId: string
  vaultId: string
  oldPath: string
  path: string
  expectedVersion: string
  expectedMd5Checksum?: string | null
  expectedContentHash?: string
}

export interface TrashMarkdownInput {
  fileId: string
  vaultId: string
  path: string
  expectedVersion: string
  expectedMd5Checksum?: string | null
  expectedContentHash?: string
}

export interface DrivePathAliasObject {
  id: string
  vaultId: string
  role: 'pathAliases'
  parentId: string
  version: string
  md5Checksum: string | null
  contentHash: string
  bytes: Buffer
}

export interface CreatePathAliasInput {
  vaultId: string
  parentId: string
  bytes: Buffer
}

export interface GuardedPathAliasInput {
  fileId: string
  vaultId: string
  parentId: string
  expectedVersion: string
  expectedMd5Checksum?: string | null
  expectedContentHash?: string
}

/** Full-list adapter used by the production classification coordinator. */
export async function listPathAliasObjects(accessToken: string, vaultId: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<DrivePathAliasObject[]> {
  const result: DrivePathAliasObject[] = []
  let pageToken: string | undefined
  do {
    const url = new URL(DRIVE_FILES_URL)
    url.searchParams.set('q', `trashed = false and appProperties has { key='tsuzuneVaultId' and value='${queryLiteral(vaultId)}' } and appProperties has { key='tsuzuneRole' and value='pathAliases' }`)
    url.searchParams.set('fields', 'nextPageToken,files(id,parents,version,md5Checksum,appProperties,description,trashed)')
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const payload = asRecord(await requestJson(fetchImpl, url, { headers: authorizationHeaders(accessToken) }))
    const files = Array.isArray(payload?.files) ? payload.files : []
    for (const raw of files) {
      const file = asRecord(raw); const props = asProperties(file?.appProperties)
      const id = asString(file?.id); const version = asString(file?.version)
      if (!id || !version || props.tsuzuneVaultId !== vaultId || props.tsuzuneRole !== 'pathAliases') continue
      const parentId = asStringArray(file?.parents)[0]; if (!parentId) continue
      const bytes = await downloadMarkdown(accessToken, id, fetchImpl)
      const buffer = Buffer.from(bytes)
      result.push({ id, vaultId, role: 'pathAliases', parentId, version, md5Checksum: asString(file?.md5Checksum), contentHash: sha256(buffer), bytes: buffer })
    }
    pageToken = asString(payload?.nextPageToken) ?? undefined
  } while (pageToken)
  return result
}

export async function updatePathAliasObject(accessToken: string, input: GuardedPathAliasInput & { bytes: Buffer }, fetchImpl: typeof fetch = globalThis.fetch): Promise<DrivePathAliasObject> {
  const current = (await listPathAliasObjects(accessToken, input.vaultId, fetchImpl)).find((entry) => entry.id === input.fileId)
  if (!current || current.parentId !== input.parentId || current.version !== input.expectedVersion || !matchesHash(current, input)) throw new Error('Google Drive Path Alias object changed.')
  const url = new URL(`${DRIVE_UPLOAD_URL}/${encodeURIComponent(input.fileId)}`); url.searchParams.set('uploadType', 'media'); url.searchParams.set('fields', 'id,parents,version,appProperties')
  const raw = await requestJson(fetchImpl, url, { method: 'PATCH', headers: authorizationHeaders(accessToken, { 'content-type': 'application/json' }), body: new Uint8Array(input.bytes) })
  const file = asRecord(raw); return { ...current, version: asString(file?.version) ?? current.version, md5Checksum: asString(file?.md5Checksum), contentHash: sha256(input.bytes), bytes: input.bytes }
}

/** Create only when the vault has no active path-alias object. */
export async function createPathAliasObject(accessToken: string, input: CreatePathAliasInput, fetchImpl: typeof fetch = globalThis.fetch): Promise<DrivePathAliasObject> {
  const existing = await listPathAliasObjects(accessToken, input.vaultId, fetchImpl)
  if (existing.length !== 0) throw new Error('Google Drive Path Alias object already exists.')
  const url = new URL(DRIVE_UPLOAD_URL)
  url.searchParams.set('uploadType', 'multipart')
  url.searchParams.set('fields', 'id,parents,version,md5Checksum,appProperties,description,trashed')
  const multipart = multipartBytes({ name: 'path-aliases.json', mimeType: 'application/json', parents: [input.parentId], appProperties: { tsuzuneVaultId: input.vaultId, tsuzuneRole: 'pathAliases' } }, input.bytes)
  const raw = await requestJson(fetchImpl, url, { method: 'POST', headers: authorizationHeaders(accessToken, { 'content-type': multipart.contentType }), body: Buffer.from(multipart.body) })
  const file = asRecord(raw)
  const id = asString(file?.id); const version = asString(file?.version); const parentId = asStringArray(file?.parents)[0]
  const props = asProperties(file?.appProperties)
  if (!id || !version || parentId !== input.parentId || props.tsuzuneVaultId !== input.vaultId || props.tsuzuneRole !== 'pathAliases' || file?.trashed === true) throw new Error('Google Drive Path Alias object creation was not verified.')
  const bytes = Buffer.from(input.bytes)
  return { id, vaultId: input.vaultId, role: 'pathAliases', parentId, version, md5Checksum: asString(file?.md5Checksum), contentHash: sha256(bytes), bytes }
}

/** Trash an alias only if its identity and content still match the preimage. */
export async function trashPathAliasObject(accessToken: string, input: GuardedPathAliasInput, fetchImpl: typeof fetch = globalThis.fetch): Promise<void> {
  const current = (await listPathAliasObjects(accessToken, input.vaultId, fetchImpl)).find((entry) => entry.id === input.fileId)
  if (!current || current.parentId !== input.parentId || current.version !== input.expectedVersion || !matchesHash(current, input)) throw new Error('Google Drive Path Alias object changed.')
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}`)
  url.searchParams.set('fields', 'id,parents,version,appProperties,trashed')
  const raw = await requestJson(fetchImpl, url, { method: 'PATCH', headers: authorizationHeaders(accessToken, { 'content-type': 'application/json' }), body: JSON.stringify({ trashed: true }) })
  verifyTrashResponse(raw, input.fileId)
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function asProperties(value: unknown): Record<string, string> {
  const record = asRecord(value)
  if (!record) return {}

  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

function parseMarkdownFile(value: unknown): DriveMarkdownFile | null {
  const record = asRecord(value)
  if (
    !record ||
    record.mimeType !== MARKDOWN_MIME_TYPE ||
    record.trashed === true
  ) return null

  const id = asString(record.id)
  const name = asString(record.name)
  const properties = asProperties(record.appProperties)
  const vaultId = properties.tsuzuneVaultId
  const description = asString(record.description)
  const rawPath =
    properties.tsuzunePath ??
    (description?.startsWith(PATH_DESCRIPTION_PREFIX)
      ? description.slice(PATH_DESCRIPTION_PREFIX.length)
      : null)
  if (!id || !name || !vaultId || !rawPath) return null
  const path = normalizedMarkdownPath(rawPath)

  return {
    id,
    name,
    path,
    parentIds: asStringArray(record.parents),
    version: asString(record.version),
    md5Checksum: asString(record.md5Checksum),
    appProperties: {
      tsuzuneVaultId: vaultId,
      tsuzunePath: path
    }
  }
}

function parseVaultRoot(value: unknown): DriveVaultRoot | null {
  const record = asRecord(value)
  if (!record || record.mimeType !== FOLDER_MIME_TYPE) return null

  const id = asString(record.id)
  const name = asString(record.name)
  const properties = asProperties(record.appProperties)
  const vaultId = properties.tsuzuneVaultId
  if (
    !id ||
    !name ||
    !vaultId ||
    properties.tsuzuneRole !== 'vaultRoot'
  ) {
    return null
  }

  return {
    id,
    name,
    parentIds: asStringArray(record.parents),
    version: asString(record.version),
    appProperties: {
      tsuzuneVaultId: vaultId,
      tsuzuneRole: 'vaultRoot'
    }
  }
}

function queryLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function authorizationHeaders(
  accessToken: string,
  extra?: HeadersInit
): Headers {
  const headers = new Headers(extra)
  headers.set('authorization', `Bearer ${accessToken}`)
  return headers
}

async function assertDriveResponse(response: Response): Promise<void> {
  if (response.ok) return

  const detail = (await response.text()).trim()
  throw new Error(
    detail
      ? `Google Drive API error (${response.status}): ${detail}`
      : `Google Drive API error (${response.status})`
  )
}

async function requestJson(
  fetchImpl: typeof fetch,
  input: string | URL,
  init: RequestInit
): Promise<unknown> {
  const response = await fetchImpl(input, init)
  await assertDriveResponse(response)
  return response.json()
}

function normalizedMarkdownPath(path: string): string {
  const validation = validateRelativePath(path)
  if (!validation.valid || !validation.normalized) {
    throw new Error(
      `Google Driveへ同期するパスが不正です。${validation.reason ?? ''}`
    )
  }
  const name = validation.normalized.split('/').at(-1)
  if (!name?.toLowerCase().endsWith('.md')) {
    throw new Error('Google Driveへ同期するパスは.mdノートに限られます。')
  }
  return validation.normalized
}

function multipartBody(
  metadata: UnknownRecord,
  content: string
): { contentType: string; body: string } {
  const boundary = `tsuzune_${randomUUID()}`
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${MARKDOWN_MIME_TYPE}; charset=UTF-8`,
      '',
      content,
      `--${boundary}--`,
      ''
    ].join('\r\n')
  }
}

function markdownMetadata(
  vaultId: string,
  path: string,
  parentId?: string,
  clearStalePathFields = false
): UnknownRecord {
  const appProperties: Record<string, string | null> = {
    tsuzuneVaultId: vaultId
  }
  const metadata: UnknownRecord = {
    name: path.split('/').at(-1),
    mimeType: MARKDOWN_MIME_TYPE,
    appProperties
  }
  if (
    new TextEncoder().encode(PATH_PROPERTY + path).byteLength <=
    DRIVE_PROPERTY_LIMIT_BYTES
  ) {
    appProperties.tsuzunePath = path
    if (clearStalePathFields) metadata.description = null
  } else {
    if (clearStalePathFields) appProperties.tsuzunePath = null
    metadata.description = `${PATH_DESCRIPTION_PREFIX}${path}`
  }
  if (parentId) metadata.parents = [parentId]
  return metadata
}

function requireMarkdownFile(value: unknown): DriveMarkdownFile {
  const file = parseMarkdownFile(value)
  if (!file) {
    throw new Error('Google DriveからMarkdownメタデータを取得できませんでした。')
  }
  return file
}

async function getMarkdownMetadata(
  accessToken: string,
  fileId: string,
  fetchImpl: typeof fetch
): Promise<DriveMarkdownFile> {
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`)
  url.searchParams.set('fields', MARKDOWN_FIELDS)
  return requireMarkdownFile(
    await requestJson(fetchImpl, url, {
      headers: authorizationHeaders(accessToken)
    })
  )
}

export async function listVaultFiles(
  accessToken: string,
  vaultId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveMarkdownFile[]> {
  const files: DriveMarkdownFile[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(DRIVE_FILES_URL)
    url.searchParams.set(
      'q',
      [
        'trashed = false',
        `mimeType = '${MARKDOWN_MIME_TYPE}'`,
        `appProperties has { key='tsuzuneVaultId' and value='${queryLiteral(vaultId)}' }`
      ].join(' and ')
    )
    url.searchParams.set('spaces', 'drive')
    url.searchParams.set(
      'fields',
      `nextPageToken,files(${MARKDOWN_FIELDS})`
    )
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = asRecord(
      await requestJson(fetchImpl, url, {
        headers: authorizationHeaders(accessToken)
      })
    )
    const pageFiles = Array.isArray(payload?.files) ? payload.files : []
    for (const value of pageFiles) {
      const file = parseMarkdownFile(value)
      if (file) files.push(file)
    }
    pageToken = asString(payload?.nextPageToken) ?? undefined
  } while (pageToken)

  return files
}

export async function getDriveStartPageToken(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<string> {
  const url = new URL(`${DRIVE_CHANGES_URL}/startPageToken`)
  const payload = asRecord(
    await requestJson(fetchImpl, url, {
      headers: authorizationHeaders(accessToken)
    })
  )
  const token = asString(payload?.startPageToken)
  if (!token) throw new Error('Google Driveの変更トークンを取得できませんでした。')
  return token
}

export async function listDriveChanges(
  accessToken: string,
  startPageToken: string,
  vaultId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveChangePage> {
  const changes: DriveChange[] = []
  let pageToken = startPageToken
  let newStartPageToken: string | null = null

  do {
    const url = new URL(DRIVE_CHANGES_URL)
    url.searchParams.set('pageToken', pageToken)
    url.searchParams.set('spaces', 'drive')
    url.searchParams.set('includeRemoved', 'true')
    url.searchParams.set('pageSize', '1000')
    url.searchParams.set(
      'fields',
      `nextPageToken,newStartPageToken,changes(fileId,removed,file(${MARKDOWN_FIELDS}))`
    )
    const response = await fetchImpl(url, {
      headers: authorizationHeaders(accessToken)
    })
    if (response.status === 410) {
      throw new DriveChangeTokenInvalidError(
        'Google Driveの変更トークンを利用できません。'
      )
    }
    await assertDriveResponse(response)
    const payload = asRecord(await response.json())
    const values = Array.isArray(payload?.changes) ? payload.changes : []
    for (const value of values) {
      const record = asRecord(value)
      const fileId = asString(record?.fileId)
      if (!fileId) continue
      const rawFile = asRecord(record?.file)
      const belongsToVault =
        asProperties(rawFile?.appProperties).tsuzuneVaultId === vaultId
      changes.push({
        fileId,
        removed: record?.removed === true,
        file: belongsToVault ? parseMarkdownFile(rawFile) : null
      })
    }
    pageToken = asString(payload?.nextPageToken) ?? ''
    newStartPageToken = asString(payload?.newStartPageToken)
  } while (pageToken)

  if (!newStartPageToken) {
    throw new Error('Google Driveの次の変更トークンを取得できませんでした。')
  }
  return { changes, newStartPageToken }
}

export async function listVaultRoots(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveVaultRoot[]> {
  const roots: DriveVaultRoot[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(DRIVE_FILES_URL)
    url.searchParams.set(
      'q',
      [
        'trashed = false',
        `mimeType = '${FOLDER_MIME_TYPE}'`,
        "appProperties has { key='tsuzuneRole' and value='vaultRoot' }"
      ].join(' and ')
    )
    url.searchParams.set('spaces', 'drive')
    url.searchParams.set('fields', `nextPageToken,files(${ROOT_FIELDS})`)
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = asRecord(
      await requestJson(fetchImpl, url, {
        headers: authorizationHeaders(accessToken)
      })
    )
    const pageRoots = Array.isArray(payload?.files) ? payload.files : []
    for (const value of pageRoots) {
      const root = parseVaultRoot(value)
      if (root) roots.push(root)
    }
    pageToken = asString(payload?.nextPageToken) ?? undefined
  } while (pageToken)

  return roots
}

export async function ensureVaultRoot(
  accessToken: string,
  vaultId: string,
  rootName: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveVaultRoot> {
  const listUrl = new URL(DRIVE_FILES_URL)
  listUrl.searchParams.set(
    'q',
    [
      'trashed = false',
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      `appProperties has { key='tsuzuneVaultId' and value='${queryLiteral(vaultId)}' }`,
      "appProperties has { key='tsuzuneRole' and value='vaultRoot' }"
    ].join(' and ')
  )
  listUrl.searchParams.set('spaces', 'drive')
  listUrl.searchParams.set('fields', `files(${ROOT_FIELDS})`)
  listUrl.searchParams.set('pageSize', '10')

  const listed = asRecord(
    await requestJson(fetchImpl, listUrl, {
      headers: authorizationHeaders(accessToken)
    })
  )
  const existingValues = Array.isArray(listed?.files) ? listed.files : []
  for (const value of existingValues) {
    const existing = parseVaultRoot(value)
    if (existing) return existing
  }

  const createUrl = new URL(DRIVE_FILES_URL)
  createUrl.searchParams.set('fields', ROOT_FIELDS)
  const created = await requestJson(fetchImpl, createUrl, {
    method: 'POST',
    headers: authorizationHeaders(accessToken, {
      'content-type': 'application/json; charset=UTF-8'
    }),
    body: JSON.stringify({
      name: rootName,
      mimeType: FOLDER_MIME_TYPE,
      appProperties: {
        tsuzuneVaultId: vaultId,
        tsuzuneRole: 'vaultRoot'
      }
    })
  })
  const root = parseVaultRoot(created)
  if (!root) {
    throw new Error('Google DriveにVault同期フォルダーを作成できませんでした。')
  }
  return root
}

export async function downloadMarkdown(
  accessToken: string,
  fileId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<string> {
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`)
  url.searchParams.set('alt', 'media')
  const response = await fetchImpl(url, {
    headers: authorizationHeaders(accessToken)
  })
  await assertDriveResponse(response)
  return response.text()
}

export async function createMarkdown(
  accessToken: string,
  input: CreateMarkdownInput,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveMarkdownFile> {
  const path = normalizedMarkdownPath(input.path)
  const multipart = multipartBody(
    markdownMetadata(input.vaultId, path, input.parentId),
    input.content
  )
  const url = new URL(DRIVE_UPLOAD_URL)
  url.searchParams.set('uploadType', 'multipart')
  url.searchParams.set('fields', MARKDOWN_FIELDS)

  return requireMarkdownFile(
    await requestJson(fetchImpl, url, {
      method: 'POST',
      headers: authorizationHeaders(accessToken, {
        'content-type': multipart.contentType
      }),
      body: multipart.body
    })
  )
}

export async function updateMarkdown(
  accessToken: string,
  input: UpdateMarkdownInput,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveMarkdownFile> {
  const path = normalizedMarkdownPath(input.path)
  const current = await getMarkdownMetadata(
    accessToken,
    input.fileId,
    fetchImpl
  )
  if (
    current.id !== input.fileId ||
    current.appProperties.tsuzuneVaultId !== input.vaultId ||
    current.path !== path
  ) {
    throw new Error(
      `Google Drive側のノートまたは場所が変わりました。同期内容を確認し直してください: ${path}`
    )
  }
  if (current.version !== input.expectedVersion) {
    const md5Matches =
      Boolean(input.expectedMd5Checksum) &&
      current.md5Checksum === input.expectedMd5Checksum
    if (!md5Matches) {
      const currentContent = input.expectedContentHash
        ? await downloadMarkdown(accessToken, input.fileId, fetchImpl)
        : null
      if (
        currentContent === null ||
        createHash('sha256').update(currentContent).digest('hex') !==
          input.expectedContentHash
      ) {
        throw new Error(
          `Google Drive側の内容が変わりました。同期内容を確認し直してください: ${path}`
        )
      }
    }
  }
  const multipart = multipartBody(
    markdownMetadata(input.vaultId, path, undefined, true),
    input.content
  )
  const url = new URL(
    `${DRIVE_UPLOAD_URL}/${encodeURIComponent(input.fileId)}`
  )
  url.searchParams.set('uploadType', 'multipart')
  url.searchParams.set('fields', MARKDOWN_FIELDS)

  return requireMarkdownFile(
    await requestJson(fetchImpl, url, {
      method: 'PATCH',
      headers: authorizationHeaders(accessToken, {
        'content-type': multipart.contentType
      }),
      body: multipart.body
    })
  )
}

export async function moveMarkdown(
  accessToken: string,
  input: MoveMarkdownInput,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<DriveMarkdownFile> {
  const oldPath = normalizedMarkdownPath(input.oldPath)
  const path = normalizedMarkdownPath(input.path)
  const current = await getMarkdownMetadata(accessToken, input.fileId, fetchImpl)
  if (
    current.id !== input.fileId ||
    current.appProperties.tsuzuneVaultId !== input.vaultId ||
    current.path !== oldPath
  ) {
    throw new Error(
      'Google Drive側の版または場所が変わりました。同期内容を確認し直してください。'
    )
  }
  if (current.version !== input.expectedVersion) {
    const md5Matches =
      Boolean(input.expectedMd5Checksum) &&
      current.md5Checksum === input.expectedMd5Checksum
    if (!md5Matches) {
      const currentContent = input.expectedContentHash
        ? await downloadMarkdown(accessToken, input.fileId, fetchImpl)
        : null
      if (
        currentContent === null ||
        createHash('sha256').update(currentContent).digest('hex') !==
          input.expectedContentHash
      ) {
        throw new Error(
          `Google Drive側の内容が変わりました。同期内容を確認し直してください: ${oldPath}`
        )
      }
    }
  }

  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}`)
  url.searchParams.set('fields', MARKDOWN_FIELDS)
  return requireMarkdownFile(
    await requestJson(fetchImpl, url, {
      method: 'PATCH',
      headers: authorizationHeaders(accessToken, {
        'content-type': 'application/json; charset=UTF-8'
      }),
      body: JSON.stringify(markdownMetadata(input.vaultId, path, undefined, true))
    })
  )
}

function multipartBytes(metadata: UnknownRecord, bytes: Buffer): { contentType: string; body: Uint8Array } {
  const boundary = `tsuzune_${randomUUID()}`
  const head = [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata), `--${boundary}`, 'Content-Type: application/json', '', '']
  const prefix = new TextEncoder().encode(head.join('\r\n'))
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(prefix.byteLength + bytes.byteLength + suffix.byteLength)
  body.set(prefix); body.set(bytes, prefix.byteLength); body.set(suffix, prefix.byteLength + bytes.byteLength)
  return { contentType: `multipart/related; boundary=${boundary}`, body }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function matchesHash(current: DrivePathAliasObject, input: GuardedPathAliasInput): boolean {
  if (input.expectedMd5Checksum !== undefined && current.md5Checksum !== input.expectedMd5Checksum) return false
  return input.expectedContentHash === undefined || current.contentHash === input.expectedContentHash
}

function verifyTrashResponse(value: unknown, expectedId: string): void {
  const response = asRecord(value)
  if (response?.id !== expectedId || response.trashed !== true) {
    throw new Error('Google Drive側の削除応答を検証できませんでした。')
  }
}

export async function trashMarkdown(
  accessToken: string,
  input: TrashMarkdownInput,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const current = await getMarkdownMetadata(accessToken, input.fileId, fetchImpl)
  if (
    current.id !== input.fileId ||
    current.appProperties.tsuzuneVaultId !== input.vaultId ||
    current.path !== normalizedMarkdownPath(input.path)
  ) {
    throw new Error('Google Drive側の削除対象または場所が変わりました。同期内容を確認し直してください。')
  }
  if (current.version !== input.expectedVersion) {
    const md5Matches = Boolean(input.expectedMd5Checksum) &&
      current.md5Checksum === input.expectedMd5Checksum
    if (!md5Matches) {
      const currentContent = input.expectedContentHash
        ? await downloadMarkdown(accessToken, input.fileId, fetchImpl)
        : null
      const contentMatches = currentContent !== null &&
        createHash('sha256').update(currentContent).digest('hex') === input.expectedContentHash
      if (!contentMatches) {
        throw new Error('Google Drive側の削除対象が変わりました。同期内容を確認し直してください。')
      }
    }
  }
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}`)
  url.searchParams.set('fields', 'id,trashed')
  const raw = await requestJson(fetchImpl, url, {
    method: 'PATCH',
    headers: authorizationHeaders(accessToken, {
      'content-type': 'application/json; charset=UTF-8'
    }),
    body: JSON.stringify({ trashed: true })
  })
  verifyTrashResponse(raw, input.fileId)
}
