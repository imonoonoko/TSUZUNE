import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteFrontmatterProperty, deleteFrontmatterScalar, inspectFrontmatterProperty, setFrontmatterProperty, setFrontmatterScalar, type FrontmatterEditResult } from '../src/core/frontmatter'
import { VaultService } from '../src/main/vault'

let root: string
let vault: VaultService
const original = '\uFEFF---\r\nkind: state\r\n# preserve\r\nunknown: "[[Note]]"\r\n---\r\n# 本文\r\n'

function edited(result: FrontmatterEditResult): string {
  if (!result.ok) throw new Error(result.message)
  return result.markdown
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tsuzune-properties-test-'))
  vault = new VaultService()
  await vault.setRootPath(root)
  await writeFile(join(root, 'Note.md'), original, 'utf8')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('property authoring through the revision-checked Vault save', () => {
  it('persists checkbox types through add, toggle, fresh reload and deletion without rewriting surrounding bytes', async () => {
    const source = original.replace('kind: state', 'kind: state\r\nquoted: "true"\r\ndone: FALSE  # flag')
    await writeFile(join(root, 'Note.md'), source, 'utf8')
    const toggled = source.replace('done: FALSE', 'done: true')
    const added = toggled.replace('---\r\n# 本文', 'favorite: false\r\n---\r\n# 本文')
    const deleted = added.replace('done: true  # flag', '# flag')
    for (const [mutation, expected] of [
      [(content: string) => setFrontmatterProperty(content, 'done', { type: 'checkbox', value: false }), source],
      [(content: string) => setFrontmatterProperty(content, 'done', { type: 'checkbox', value: true }), toggled],
      [(content: string) => setFrontmatterProperty(content, 'favorite', { type: 'checkbox', value: false }), added],
      [(content: string) => deleteFrontmatterProperty(content, 'done'), deleted]
    ] as const) {
      const note = await vault.readNote('Note.md')
      await vault.saveNote({ path: note.path, content: edited(mutation(note.content)), expectedModifiedAt: note.modifiedAt, expectedContent: note.content, force: false })
      vault = new VaultService()
      await vault.setRootPath(root)
      expect((await vault.readNote('Note.md')).content).toBe(expected)
      expect(await readFile(join(root, 'Note.md'))).toEqual(Buffer.from(expected, 'utf8'))
    }
    expect(inspectFrontmatterProperty((await vault.readNote('Note.md')).content, 'favorite')).toEqual({ ok: true, property: { type: 'checkbox', value: false } })
  })

  it('preserves list item types and surrounding comments through real-file save, reload, clear and delete', async () => {
    const source = original.replace('unknown: "[[Note]]"\r\n', 'unknown: "[[Note]]"\r\nitems: ["42", -2.5, "[[Note]]"] # list\r\n# next field\r\nnext: unchanged\r\n')
    await writeFile(join(root, 'Note.md'), source, 'utf8')
    const changed = source.replace('items: ["42", -2.5, "[[Note]]"] # list\r\n', 'items: # list\r\n  - "43"\r\n  - -3.50\r\n  - "[[Note]]"\r\n')
    const empty = changed.replace('items: # list\r\n  - "43"\r\n  - -3.50\r\n  - "[[Note]]"\r\n', 'items: [] # list\r\n')
    const deleted = empty.replace('items: [] # list\r\n', '# list\r\n')
    for (const [mutation, expected] of [
      [(content: string) => setFrontmatterProperty(content, 'items', { type: 'list', value: [{ type: 'text', value: '43' }, { type: 'number', value: '-3.50' }, { type: 'text', value: '[[Note]]' }] }), changed],
      [(content: string) => setFrontmatterProperty(content, 'items', { type: 'list', value: [] }), empty],
      [(content: string) => deleteFrontmatterProperty(content, 'items'), deleted]
    ] as const) {
      const note = await vault.readNote('Note.md')
      await vault.saveNote({ path: note.path, content: edited(mutation(note.content)), expectedModifiedAt: note.modifiedAt, expectedContent: note.content, force: false })
      vault = new VaultService()
      await vault.setRootPath(root)
      expect((await vault.readNote('Note.md')).content).toBe(expected)
      expect(await readFile(join(root, 'Note.md'))).toEqual(Buffer.from(expected, 'utf8'))
    }
  })

  it('persists a precise decimal as a number through add, edit, fresh reload and delete', async () => {
    const added = original.replace('unknown: "[[Note]]"\r\n', 'unknown: "[[Note]]"\r\namount: 9007199254740993.1200\r\n')
    const changed = added.replace('9007199254740993.1200', '-0.50')
    for (const [mutation, expected, property] of [
      [(source: string) => setFrontmatterProperty(source, 'amount', { type: 'number', value: '9007199254740993.1200' }), added, { type: 'number', value: '9007199254740993.1200' }],
      [(source: string) => setFrontmatterProperty(source, 'amount', { type: 'number', value: '-0.50' }), changed, { type: 'number', value: '-0.50' }],
      [(source: string) => deleteFrontmatterProperty(source, 'amount'), original, null]
    ] as const) {
      const note = await vault.readNote('Note.md')
      await vault.saveNote({ path: note.path, content: edited(mutation(note.content)), expectedModifiedAt: note.modifiedAt, expectedContent: note.content, force: false })
      vault = new VaultService()
      await vault.setRootPath(root)
      const reloaded = await vault.readNote('Note.md')
      expect(reloaded.content).toBe(expected)
      expect(await readFile(join(root, 'Note.md'))).toEqual(Buffer.from(expected, 'utf8'))
      expect(inspectFrontmatterProperty(reloaded.content, 'amount')).toEqual({ ok: true, property })
    }
  })

  it('persists add, edit and delete byte-for-byte across fresh VaultService reads', async () => {
    const added = original.replace('unknown: "[[Note]]"\r\n', 'unknown: "[[Note]]"\r\nstatus: "active"\r\n')
    const changed = added.replace('status: "active"', 'status: "complete"')
    for (const [mutation, expected] of [
      [(source: string) => setFrontmatterScalar(source, 'status', 'active'), added],
      [(source: string) => setFrontmatterScalar(source, 'status', 'complete'), changed],
      [(source: string) => deleteFrontmatterScalar(source, 'status'), original]
    ] as const) {
      const note = await vault.readNote('Note.md')
      await vault.saveNote({
        path: note.path,
        content: edited(mutation(note.content)),
        expectedModifiedAt: note.modifiedAt,
        expectedContent: note.content,
        force: false
      })
      vault = new VaultService()
      await vault.setRootPath(root)
      expect((await vault.readNote('Note.md')).content).toBe(expected)
      expect(await readFile(join(root, 'Note.md'))).toEqual(Buffer.from(expected, 'utf8'))
    }
  })

  it.each([
    ['checkbox', (source: string) => setFrontmatterProperty(source, 'done', { type: 'checkbox', value: true })],
    ['text', (source: string) => setFrontmatterScalar(source, 'status', 'active')],
    ['number', (source: string) => setFrontmatterProperty(source, 'amount', { type: 'number', value: '9007199254740993' })],
    ['list', (source: string) => setFrontmatterProperty(source, 'items', { type: 'list', value: [{ type: 'text', value: '42' }, { type: 'number', value: '42' }] })]
  ] as const)('rejects a stale %s property edit without changing external bytes', async (_kind, mutate) => {
    const note = await vault.readNote('Note.md')
    const external = original.replace('kind: state', 'kind: external')
    await writeFile(join(root, 'Note.md'), external, 'utf8')
    await expect(vault.saveNote({
      path: note.path,
      content: edited(mutate(note.content)),
      expectedModifiedAt: note.modifiedAt,
      expectedContent: note.content,
      force: false
    })).rejects.toMatchObject({ appError: { code: 'FILE_CHANGED' } })
    expect(await readFile(join(root, 'Note.md'))).toEqual(Buffer.from(external, 'utf8'))
  })
})
