import { describe, expect, it } from 'vitest'
import {
  createMarkdown,
  downloadMarkdown,
  ensureVaultRoot,
  listVaultFiles,
  listVaultRoots,
  updateMarkdown
} from '../src/main/google-drive'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('listVaultFiles', () => {
  it('pages through the dedicated vault files and returns Markdown metadata only', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const responses = [
      {
        nextPageToken: 'next-page',
        files: [
          {
            id: 'note-1',
            name: '入口.md',
            mimeType: 'text/markdown',
            parents: ['root-1'],
            version: '7',
            md5Checksum: 'md5-a',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: '00_入口/入口.md'
            }
          },
          {
            id: 'not-markdown',
            name: '画像.png',
            mimeType: 'image/png',
            parents: ['root-1'],
            version: '2',
            md5Checksum: 'md5-image',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: '画像.png'
            }
          }
        ]
      },
      {
        files: [
          {
            id: 'note-2',
            name: 'ONOKO.md',
            mimeType: 'text/markdown',
            parents: ['folder-2'],
            version: '12',
            md5Checksum: 'md5-b',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: '10_プロジェクト/ONOKO.md'
            }
          }
        ]
      }
    ]
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      return jsonResponse(responses[requests.length - 1])
    }

    await expect(
      listVaultFiles('access-token', 'vault-alpha', fetchImpl)
    ).resolves.toEqual([
      {
        id: 'note-1',
        name: '入口.md',
        path: '00_入口/入口.md',
        parentIds: ['root-1'],
        version: '7',
        md5Checksum: 'md5-a',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: '00_入口/入口.md'
        }
      },
      {
        id: 'note-2',
        name: 'ONOKO.md',
        path: '10_プロジェクト/ONOKO.md',
        parentIds: ['folder-2'],
        version: '12',
        md5Checksum: 'md5-b',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: '10_プロジェクト/ONOKO.md'
        }
      }
    ])

    expect(requests).toHaveLength(2)
    expect(requests[0].url.origin).toBe('https://www.googleapis.com')
    expect(requests[0].url.pathname).toBe('/drive/v3/files')
    expect(requests[0].url.searchParams.get('q')).toContain('trashed = false')
    expect(requests[0].url.searchParams.get('q')).toContain(
      "appProperties has { key='tsuzuneVaultId' and value='vault-alpha' }"
    )
    expect(requests[0].url.searchParams.get('q')).toContain(
      "mimeType = 'text/markdown'"
    )
    expect(requests[1].url.searchParams.get('pageToken')).toBe('next-page')
    expect(new Headers(requests[0].init?.headers).get('authorization')).toBe(
      'Bearer access-token'
    )
  })

  it('rejects an app-owned Markdown file with an unsafe TSUZUNE path', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        files: [
          {
            id: 'unsafe-note',
            name: 'outside.md',
            mimeType: 'text/markdown',
            parents: ['root-1'],
            version: '1',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: '../outside.md'
            }
          }
        ]
      })

    await expect(
      listVaultFiles('access-token', 'vault-alpha', fetchImpl)
    ).rejects.toThrow(/パス/)
  })
})

describe('listVaultRoots', () => {
  it('pages through nontrashed app-created TSUZUNE vault folders', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const responses = [
      {
        nextPageToken: 'next-roots',
        files: [
          {
            id: 'root-alpha',
            name: 'TSUZUNE - Alpha',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [],
            version: '4',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzuneRole: 'vaultRoot'
            }
          },
          {
            id: 'not-a-vault',
            name: 'Ordinary folder',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [],
            version: '1',
            appProperties: {}
          }
        ]
      },
      {
        files: [
          {
            id: 'root-beta',
            name: 'TSUZUNE - Beta',
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['drive-parent'],
            version: '9',
            appProperties: {
              tsuzuneVaultId: 'vault-beta',
              tsuzuneRole: 'vaultRoot'
            }
          }
        ]
      }
    ]
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      return jsonResponse(responses[requests.length - 1])
    }

    await expect(
      listVaultRoots('access-token', fetchImpl)
    ).resolves.toEqual([
      {
        id: 'root-alpha',
        name: 'TSUZUNE - Alpha',
        parentIds: [],
        version: '4',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzuneRole: 'vaultRoot'
        }
      },
      {
        id: 'root-beta',
        name: 'TSUZUNE - Beta',
        parentIds: ['drive-parent'],
        version: '9',
        appProperties: {
          tsuzuneVaultId: 'vault-beta',
          tsuzuneRole: 'vaultRoot'
        }
      }
    ])

    expect(requests).toHaveLength(2)
    const query = requests[0].url.searchParams.get('q')
    expect(query).toContain('trashed = false')
    expect(query).toContain(
      "mimeType = 'application/vnd.google-apps.folder'"
    )
    expect(query).toContain(
      "appProperties has { key='tsuzuneRole' and value='vaultRoot' }"
    )
    expect(requests[0].url.searchParams.get('pageSize')).toBe('1000')
    expect(requests[1].url.searchParams.get('pageToken')).toBe('next-roots')
    expect(new Headers(requests[0].init?.headers).get('authorization')).toBe(
      'Bearer access-token'
    )
  })
})

describe('ensureVaultRoot', () => {
  it('reuses the existing app-owned vault folder', async () => {
    const methods: string[] = []
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET')
      return jsonResponse({
        files: [
          {
            id: 'root-existing',
            name: 'TSUZUNE - My Vault',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [],
            version: '4',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzuneRole: 'vaultRoot'
            }
          }
        ]
      })
    }

    await expect(
      ensureVaultRoot(
        'access-token',
        'vault-alpha',
        'TSUZUNE - My Vault',
        fetchImpl
      )
    ).resolves.toEqual({
      id: 'root-existing',
      name: 'TSUZUNE - My Vault',
      parentIds: [],
      version: '4',
      appProperties: {
        tsuzuneVaultId: 'vault-alpha',
        tsuzuneRole: 'vaultRoot'
      }
    })
    expect(methods).toEqual(['GET'])
  })

  it('creates a marked folder when the vault root does not exist', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      if (requests.length === 1) {
        return jsonResponse({ files: [] })
      }
      return jsonResponse({
        id: 'root-created',
        name: 'TSUZUNE - My Vault',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [],
        version: '1',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzuneRole: 'vaultRoot'
        }
      })
    }

    const root = await ensureVaultRoot(
      'access-token',
      'vault-alpha',
      'TSUZUNE - My Vault',
      fetchImpl
    )

    expect(root.id).toBe('root-created')
    expect(requests[1].url.pathname).toBe('/drive/v3/files')
    expect(requests[1].init?.method).toBe('POST')
    expect(JSON.parse(String(requests[1].init?.body))).toEqual({
      name: 'TSUZUNE - My Vault',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        tsuzuneVaultId: 'vault-alpha',
        tsuzuneRole: 'vaultRoot'
      }
    })
  })
})

describe('Markdown transfer', () => {
  it('downloads one Markdown file as text', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      return new Response('# Drive note\n')
    }

    await expect(
      downloadMarkdown('access-token', 'file-id', fetchImpl)
    ).resolves.toBe('# Drive note\n')
    expect(requests[0].url.pathname).toBe('/drive/v3/files/file-id')
    expect(requests[0].url.searchParams.get('alt')).toBe('media')
  })

  it('creates Markdown with path metadata using multipart upload', async () => {
    let request: { url: URL; init?: RequestInit } | undefined
    const fetchImpl: typeof fetch = async (input, init) => {
      request = { url: new URL(String(input)), init }
      return jsonResponse({
        id: 'created-note',
        name: '企画.md',
        mimeType: 'text/markdown',
        parents: ['folder-id'],
        version: '1',
        md5Checksum: 'created-md5',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: '10_プロジェクト/企画.md'
        }
      })
    }

    const note = await createMarkdown(
      'access-token',
      {
        vaultId: 'vault-alpha',
        path: '10_プロジェクト/企画.md',
        parentId: 'folder-id',
        content: '# 企画\n本文'
      },
      fetchImpl
    )

    expect(note.id).toBe('created-note')
    expect(note.version).toBe('1')
    expect(note.md5Checksum).toBe('created-md5')
    expect(request?.url.pathname).toBe('/upload/drive/v3/files')
    expect(request?.url.searchParams.get('uploadType')).toBe('multipart')
    expect(request?.init?.method).toBe('POST')
    const body = String(request?.init?.body)
    expect(body).toContain('"name":"企画.md"')
    expect(body).toContain('"parents":["folder-id"]')
    expect(body).toContain('"tsuzuneVaultId":"vault-alpha"')
    expect(body).toContain('"tsuzunePath":"10_プロジェクト/企画.md"')
    expect(body).toContain('# 企画\n本文')
  })

  it('updates Markdown content and metadata without changing parents', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = { url: new URL(String(input)), init }
      requests.push(request)
      if (requests.length === 1) {
        return jsonResponse({
          id: 'existing-note',
          name: '更新.md',
          mimeType: 'text/markdown',
          parents: ['unchanged-parent'],
          version: '8',
          md5Checksum: 'before-md5',
          appProperties: {
            tsuzuneVaultId: 'vault-alpha',
            tsuzunePath: 'Inbox/更新.md'
          }
        })
      }
      return jsonResponse({
        id: 'existing-note',
        name: '更新.md',
        mimeType: 'text/markdown',
        parents: ['unchanged-parent'],
        version: '9',
        md5Checksum: 'updated-md5',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: 'Inbox/更新.md'
        }
      })
    }

    const note = await updateMarkdown(
      'access-token',
      {
        fileId: 'existing-note',
        vaultId: 'vault-alpha',
        path: 'Inbox/更新.md',
        expectedVersion: '8',
        content: '更新後'
      },
      fetchImpl
    )

    expect(note.version).toBe('9')
    expect(note.md5Checksum).toBe('updated-md5')
    expect(requests).toHaveLength(2)
    expect(requests[0].url.pathname).toBe('/drive/v3/files/existing-note')
    expect(requests[0].url.searchParams.get('fields')).toContain('version')
    expect(requests[1].url.pathname).toBe(
      '/upload/drive/v3/files/existing-note'
    )
    expect(requests[1].init?.method).toBe('PATCH')
    const body = String(requests[1].init?.body)
    expect(body).not.toContain('"parents"')
    expect(body).toContain('"name":"更新.md"')
    expect(body).toContain('更新後')
  })

  it('refuses an update when the Drive version changed before upload', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      return jsonResponse({
        id: 'existing-note',
        name: '更新.md',
        mimeType: 'text/markdown',
        parents: ['root-1'],
        version: '9',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: 'Inbox/更新.md'
        }
      })
    }

    await expect(
      updateMarkdown(
        'access-token',
        {
          fileId: 'existing-note',
          vaultId: 'vault-alpha',
          path: 'Inbox/更新.md',
          expectedVersion: '8',
          content: '更新後'
        },
        fetchImpl
      )
    ).rejects.toThrow(/確認し直/)
    expect(requests).toHaveLength(1)
    expect(requests[0].init?.method ?? 'GET').toBe('GET')
  })

  it('rejects traversal paths before sending an upload request', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => {
      called = true
      return jsonResponse({})
    }

    await expect(
      createMarkdown(
        'access-token',
        {
          vaultId: 'vault-alpha',
          path: '../outside.md',
          parentId: 'root-1',
          content: 'unsafe'
        },
        fetchImpl
      )
    ).rejects.toThrow(/パス/)
    expect(called).toBe(false)
  })
})
