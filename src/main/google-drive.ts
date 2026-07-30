import { randomUUID } from 'node:crypto'
import { validateRelativePath } from '../core/paths'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files'
const MARKDOWN_MIME_TYPE = 'text/markdown'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const MARKDOWN_FIELDS =
  'id,name,mimeType,parents,version,md5Checksum,appProperties'
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
  content: string
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
  if (!record || record.mimeType !== MARKDOWN_MIME_TYPE) return null

  const id = asString(record.id)
  const name = asString(record.name)
  const properties = asProperties(record.appProperties)
  const vaultId = properties.tsuzuneVaultId
  const rawPath = properties.tsuzunePath
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
  parentId?: string
): UnknownRecord {
  const metadata: UnknownRecord = {
    name: path.split('/').at(-1),
    mimeType: MARKDOWN_MIME_TYPE,
    appProperties: {
      tsuzuneVaultId: vaultId,
      tsuzunePath: path
    }
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
    current.path !== path ||
    current.version !== input.expectedVersion
  ) {
    throw new Error(
      'Google Drive側の版が変わりました。同期内容を確認し直してください。'
    )
  }
  const multipart = multipartBody(
    markdownMetadata(input.vaultId, path),
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
