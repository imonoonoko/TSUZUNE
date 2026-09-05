import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createMarkdown,
  createPathAliasObject,
  downloadMarkdown,
  downloadVaultFile,
  DriveChangeTokenInvalidError,
  ensureVaultRoot,
  getDriveStartPageToken,
  listDriveChanges,
  listPathAliasObjects,
  listVaultFiles,
  listVaultRoots,
  moveMarkdown,
  trashMarkdown,
  trashPathAliasObject,
  updateMarkdown
} from '../src/main/google-drive'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('listVaultFiles', () => {
  it('pages through the dedicated vault files and returns Markdown and attachment metadata', async () => {
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
          },
          {
            id: 'attachment-1',
            name: '資料.pdf',
            mimeType: 'application/octet-stream',
            parents: ['root-1'],
            version: '3',
            md5Checksum: 'md5-pdf',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: 'attachments/資料.pdf'
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
        kind: 'markdown',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: '00_入口/入口.md'
        }
      },
      {
        id: 'not-markdown',
        name: '画像.png',
        path: '画像.png',
        parentIds: ['root-1'],
        version: '2',
        md5Checksum: 'md5-image',
        kind: 'attachment',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: '画像.png'
        }
      },
      {
        id: 'attachment-1',
        name: '資料.pdf',
        path: 'attachments/資料.pdf',
        parentIds: ['root-1'],
        version: '3',
        md5Checksum: 'md5-pdf',
        kind: 'attachment',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: 'attachments/資料.pdf'
        }
      },
      {
        id: 'note-2',
        name: 'ONOKO.md',
        path: '10_プロジェクト/ONOKO.md',
        parentIds: ['folder-2'],
        version: '12',
        md5Checksum: 'md5-b',
        kind: 'markdown',
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
    expect(requests[0].url.searchParams.get('q')).not.toContain('mimeType =')
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

describe('remote trash response verification', () => {
  const markdownMetadata = {
    id: 'note-1', name: '削除.md', mimeType: 'text/markdown', version: '3',
    appProperties: { tsuzuneVaultId: 'vault-alpha', tsuzunePath: 'Inbox/削除.md' }
  }

  for (const response of [
    { id: 'note-1', trashed: false },
    { id: 'other-note', trashed: true }
  ]) {
    it(`rejects a Markdown trash response of ${JSON.stringify(response)}`, async () => {
      let calls = 0
      const fetchImpl: typeof fetch = async (_input) => {
        calls += 1
        return calls === 1
          ? jsonResponse(markdownMetadata)
          : jsonResponse(response)
      }
      await expect(trashMarkdown('access-token', {
        fileId: 'note-1', vaultId: 'vault-alpha', path: 'Inbox/削除.md', expectedVersion: '3'
      }, fetchImpl)).rejects.toThrow(/削除応答/)
      expect(calls).toBe(2)
    })
  }

  for (const response of [
    { id: 'alias-1', trashed: false },
    { id: 'other-alias', trashed: true }
  ]) {
    it(`rejects a Path Alias trash response of ${JSON.stringify(response)}`, async () => {
      const bytes = Buffer.from('{"version":1}')
      let calls = 0
      const fetchImpl: typeof fetch = async (_input, init) => {
        calls += 1
        if (calls === 1) return jsonResponse({ files: [{ id: 'alias-1', parents: ['root-1'], version: '4', appProperties: { tsuzuneVaultId: 'vault-alpha', tsuzuneRole: 'pathAliases' } }] })
        if (calls === 2) return new Response(bytes, { status: 200 })
        return jsonResponse(response)
      }
      await expect(trashPathAliasObject('access-token', {
        fileId: 'alias-1', vaultId: 'vault-alpha', parentId: 'root-1', expectedVersion: '4',
        expectedContentHash: createHash('sha256').update(bytes).digest('hex')
      }, fetchImpl)).rejects.toThrow(/削除応答/)
      expect(calls).toBe(3)
    })
  }
})

describe('path alias adapter', () => {
  it('pages through all active aliases before returning objects', async () => {
    const requests: URL[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input))
      requests.push(url)
      if (url.searchParams.get('alt') === 'media') {
        return new Response(url.pathname.endsWith('alias-1') ? '{"aliases":[]}' : '{"aliases":[{"path":"x"}]}')
      }
      return requests.length === 1
        ? jsonResponse({
            nextPageToken: 'next-aliases',
            files: [{ id: 'alias-1', parents: ['vault-root'], version: '1', appProperties: { tsuzuneVaultId: 'vault-a', tsuzuneRole: 'pathAliases' } }]
          })
        : jsonResponse({
            files: [{ id: 'alias-2', parents: ['vault-root'], version: '2', appProperties: { tsuzuneVaultId: 'vault-a', tsuzuneRole: 'pathAliases' } }]
          })
    }

    await expect(listPathAliasObjects('token', 'vault-a', fetchImpl)).resolves.toHaveLength(2)
    expect(requests.find((url) => !url.searchParams.has('alt') && url.searchParams.has('pageToken'))?.searchParams.get('pageToken')).toBe('next-aliases')
  })

  it('creates an alias only from an absent baseline', async () => {
    const requests: Request[] = []
    const bytes = Buffer.from('{"aliases":[]}')
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init))
      return requests.length === 1
        ? jsonResponse({ files: [] })
        : jsonResponse({ id: 'alias-1', parents: ['vault-root'], version: '1', md5Checksum: null, appProperties: { tsuzuneVaultId: 'vault-a', tsuzuneRole: 'pathAliases' } })
    }
    const created = await createPathAliasObject('token', { vaultId: 'vault-a', parentId: 'vault-root', bytes }, fetchImpl)
    expect(created).toMatchObject({ id: 'alias-1', parentId: 'vault-root', version: '1', md5Checksum: null })
    expect(created.contentHash).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(requests[1].method).toBe('POST')
  })

  it('rejects creation when an active alias already exists', async () => {
    let call = 0
    const fetchImpl: typeof fetch = async () => call++ === 0
      ? jsonResponse({ files: [{ id: 'alias-1', parents: ['vault-root'], version: '1', md5Checksum: null, appProperties: { tsuzuneVaultId: 'vault-a', tsuzuneRole: 'pathAliases' } }] })
      : new Response('{}')
    await expect(createPathAliasObject('token', { vaultId: 'vault-a', parentId: 'vault-root', bytes: Buffer.from('{}') }, fetchImpl)).rejects.toThrow('already exists')
  })
})

describe('Drive changes', () => {
  it('gets a start token and pages changed Markdown metadata', async () => {
    const requests: URL[] = []
    const responses = [
      { startPageToken: '10' },
      {
        nextPageToken: '11',
        changes: [
          {
            fileId: 'note-1',
            file: {
              id: 'note-1',
              name: 'A.md',
              mimeType: 'text/markdown',
              version: '2',
              appProperties: {
                tsuzuneVaultId: 'vault-alpha',
                tsuzunePath: 'A.md'
              }
            }
          },
          {
            fileId: 'other-vault-note',
            file: {
              id: 'other-vault-note',
              name: 'Outside.md',
              mimeType: 'text/markdown',
              version: '1',
              appProperties: {
                tsuzuneVaultId: 'vault-other',
                tsuzunePath: '../outside.md'
              }
            }
          }
        ]
      },
      {
        newStartPageToken: '12',
        changes: [{ fileId: 'note-2', removed: true }]
      }
    ]
    const fetchImpl: typeof fetch = async (input) => {
      requests.push(new URL(String(input)))
      return jsonResponse(responses[requests.length - 1])
    }

    await expect(
      getDriveStartPageToken('access-token', fetchImpl)
    ).resolves.toBe('10')
    await expect(
      listDriveChanges('access-token', '10', 'vault-alpha', fetchImpl)
    ).resolves.toEqual({
      changes: [
        {
          fileId: 'note-1',
          removed: false,
          file: expect.objectContaining({ path: 'A.md', version: '2' })
        },
        { fileId: 'other-vault-note', removed: false, file: null },
        { fileId: 'note-2', removed: true, file: null }
      ],
      newStartPageToken: '12'
    })
    expect(requests[0].pathname).toBe('/drive/v3/changes/startPageToken')
    expect(requests[0].searchParams.has('spaces')).toBe(false)
    expect(requests[1].searchParams.get('pageToken')).toBe('10')
    expect(requests[2].searchParams.get('pageToken')).toBe('11')
  })

  it('reports a rejected change token for safe full-scan fallback', async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({}, 410)

    await expect(
      listDriveChanges('access-token', 'invalid', 'vault-alpha', fetchImpl)
    ).rejects.toBeInstanceOf(DriveChangeTokenInvalidError)
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
  it('downloads an attachment without text conversion', async () => {
    const bytes = Uint8Array.from([0, 255, 17, 128])
    const fetchImpl: typeof fetch = async () => new Response(bytes)

    await expect(
      downloadVaultFile('access-token', 'file-id', fetchImpl)
    ).resolves.toEqual(Buffer.from(bytes))
  })

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

  it('uploads attachment bytes without UTF-8 conversion', async () => {
    const bytes = Buffer.from([0, 255, 17, 128])
    let body = Buffer.alloc(0)
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = Buffer.from(await new Response(init?.body).arrayBuffer())
      return jsonResponse({
        id: 'created-attachment',
        name: 'image.png',
        mimeType: 'application/octet-stream',
        parents: ['folder-id'],
        version: '1',
        md5Checksum: 'created-md5',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: 'attachments/image.png'
        }
      })
    }

    await expect(
      createMarkdown(
        'access-token',
        {
          vaultId: 'vault-alpha',
          path: 'attachments/image.png',
          parentId: 'folder-id',
          content: bytes
        },
        fetchImpl
      )
    ).resolves.toMatchObject({ kind: 'attachment' })
    expect(body.includes(bytes)).toBe(true)
  })

  it('accepts the actual Drive MIME type for a long-path attachment', async () => {
    const path =
      '40_情報源/TSUZUNE開発資料/repo/docs/reports/assets/graph-edge-viewport-2026-08-03/00-before-user-report.png'
    let body = ''
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = String(init?.body)
      return jsonResponse({
        id: 'created-long-path-attachment',
        name: '00-before-user-report.png',
        mimeType: 'image/png',
        parents: ['folder-id'],
        version: '1',
        md5Checksum: 'created-md5',
        description: `TSUZUNE path: ${path}`,
        appProperties: { tsuzuneVaultId: 'vault-alpha' }
      })
    }

    await expect(
      createMarkdown(
        'access-token',
        {
          vaultId: 'vault-alpha',
          path,
          parentId: 'folder-id',
          content: Buffer.from([0, 255, 17, 128])
        },
        fetchImpl
      )
    ).resolves.toMatchObject({ path, kind: 'attachment' })

    expect(body).toContain(`"description":"TSUZUNE path: ${path}"`)
    expect(body).not.toContain('"tsuzunePath"')
  })

  it('stores a long UTF-8 path outside appProperties', async () => {
    const path = `30_知識/${'長い日本語フォルダー/'.repeat(5)}ノート.md`
    let body = ''
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = String(init?.body)
      return jsonResponse({
        id: 'long-path-note',
        name: 'ノート.md',
        mimeType: 'text/markdown',
        parents: ['folder-id'],
        version: '1',
        description: `TSUZUNE path: ${path}`,
        appProperties: { tsuzuneVaultId: 'vault-alpha' }
      })
    }

    await expect(
      createMarkdown(
        'access-token',
        {
          vaultId: 'vault-alpha',
          path,
          parentId: 'folder-id',
          content: '本文'
        },
        fetchImpl
      )
    ).resolves.toMatchObject({ path })

    expect(body).toContain(`"description":"TSUZUNE path: ${path}"`)
    expect(body).not.toContain('"tsuzunePath"')
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

  it('moves Markdown metadata without uploading content or changing parents', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      if (requests.length === 1) {
        return jsonResponse({
          id: 'existing-note',
          name: '旧.md',
          mimeType: 'text/markdown',
          parents: ['unchanged-parent'],
          version: '8',
          appProperties: {
            tsuzuneVaultId: 'vault-alpha',
            tsuzunePath: 'Inbox/旧.md'
          }
        })
      }
      return jsonResponse({
        id: 'existing-note',
        name: '新.md',
        mimeType: 'text/markdown',
        parents: ['unchanged-parent'],
        version: '9',
        appProperties: {
          tsuzuneVaultId: 'vault-alpha',
          tsuzunePath: 'Archive/新.md'
        }
      })
    }

    const note = await moveMarkdown(
      'access-token',
      {
        fileId: 'existing-note',
        vaultId: 'vault-alpha',
        oldPath: 'Inbox/旧.md',
        path: 'Archive/新.md',
        expectedVersion: '8'
      },
      fetchImpl
    )

    expect(note).toMatchObject({ id: 'existing-note', path: 'Archive/新.md' })
    expect(requests).toHaveLength(2)
    expect(requests[1].url.pathname).toBe('/drive/v3/files/existing-note')
    expect(requests[1].url.searchParams.get('uploadType')).toBeNull()
    expect(requests[1].init?.method).toBe('PATCH')
    const body = String(requests[1].init?.body)
    expect(body).toContain('"name":"新.md"')
    expect(body).toContain('"tsuzunePath":"Archive/新.md"')
    expect(body).toContain('"description":null')
    expect(body).not.toContain('parents')
  })

  it('clears the short path property when moving to a long UTF-8 path', async () => {
    const longPath = `Archive/${'長い/'.repeat(30)}新.md`
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      return requests.length === 1
        ? jsonResponse({
            id: 'existing-note',
            name: '旧.md',
            mimeType: 'text/markdown',
            version: '8',
            appProperties: {
              tsuzuneVaultId: 'vault-alpha',
              tsuzunePath: 'Inbox/旧.md'
            }
          })
        : jsonResponse({
            id: 'existing-note',
            name: '新.md',
            mimeType: 'text/markdown',
            version: '9',
            description: `TSUZUNE path: ${longPath}`,
            appProperties: { tsuzuneVaultId: 'vault-alpha' }
          })
    }

    await moveMarkdown(
      'access-token',
      {
        fileId: 'existing-note',
        vaultId: 'vault-alpha',
        oldPath: 'Inbox/旧.md',
        path: longPath,
        expectedVersion: '8'
      },
      fetchImpl
    )

    const body = String(requests[1].init?.body)
    expect(body).toContain('"tsuzunePath":null')
    expect(body).toContain(`"description":"TSUZUNE path: ${longPath}"`)
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

  it('accepts an invisible Drive version change when the remote content is unchanged', async () => {
    const content = '更新前'
    const md5Checksum = createHash('md5').update(content).digest('hex')
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), init })
      if (requests.length === 1) {
        return jsonResponse({
          id: 'existing-note',
          name: '更新.md',
          mimeType: 'text/markdown',
          parents: ['root-1'],
          version: '9',
          md5Checksum,
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
        parents: ['root-1'],
        version: '10',
        md5Checksum: createHash('md5').update('更新後').digest('hex'),
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
        expectedMd5Checksum: md5Checksum,
        expectedContentHash: createHash('sha256').update(content).digest('hex'),
        content: '更新後'
      },
      fetchImpl
    )

    expect(note.version).toBe('10')
    expect(requests).toHaveLength(2)
    expect(requests[1].url.searchParams.get('alt')).toBeNull()
    expect(requests[1].init?.method).toBe('PATCH')
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
