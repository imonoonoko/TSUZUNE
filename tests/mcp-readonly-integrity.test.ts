import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
// @ts-expect-error The integrity check is an executable JavaScript module tested at runtime.
import { assertExactReadOnlyCoverage, assertNoTreeMutation } from '../scripts/mcp-readonly-integrity.mjs'

async function createScopes() {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-readonly-integrity-'))
  const vault = join(root, 'vault')
  const profile = join(root, 'profile')
  await mkdir(vault)
  await mkdir(profile)
  await writeFile(join(vault, 'Home.md'), '# Home\n', 'utf8')
  return {
    root,
    scopes: [
      { name: 'vault', path: vault },
      { name: 'profile', path: profile }
    ]
  }
}

it('returns the operation result when Vault and profile stay unchanged', async () => {
  const { root, scopes } = await createScopes()
  try {
    await expect(
      assertNoTreeMutation(scopes, async () => 'ok', 'search')
    ).resolves.toBe('ok')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  ['vault', 'Changed.md'],
  ['profile', 'settings.json']
])('rejects a %s mutation by a read-only operation', async (scopeName, fileName) => {
  const { root, scopes } = await createScopes()
  try {
    const scope = scopes.find((candidate) => candidate.name === scopeName)
    await expect(
      assertNoTreeMutation(
        scopes,
        async () => writeFile(join(scope!.path, fileName), 'changed', 'utf8'),
        'read-only fixture'
      )
    ).rejects.toThrow(`read-only fixture mutated scope: ${scopeName}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('fails closed when a declared read-only tool was not exercised', () => {
  expect(() =>
    assertExactReadOnlyCoverage(
      ['search', 'fetch', 'build_context'],
      new Set(['search', 'fetch'])
    )
  ).toThrow('read-only MCP coverage is incomplete: build_context')
})
