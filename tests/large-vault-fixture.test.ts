import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '..')
const generator = resolve(repoRoot, 'scripts/generate-large-vault-fixture.mjs')
const temporaryRoots: string[] = []

async function markdownFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relative(root, path).replaceAll('\\', '/'))
      }
    }
  }

  await visit(root)
  return files.sort((left, right) => left.localeCompare(right, 'ja'))
}

async function markdownDigest(root: string): Promise<string> {
  const hash = createHash('sha256')
  for (const path of await markdownFiles(root)) {
    hash.update(path)
    hash.update('\0')
    hash.update(await readFile(resolve(root, path)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function runGenerator(count: number, output: string) {
  return spawnSync(
    process.execPath,
    [generator, '--count', String(count), '--output', output],
    { cwd: repoRoot, encoding: 'utf8' }
  )
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  )
})

describe('large Vault fixture generator', () => {
  it('creates a deterministic, fully resolved Markdown graph without rewriting an existing fixture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-large-vault-'))
    temporaryRoots.push(root)
    const first = resolve(root, 'first')
    const second = resolve(root, 'second')

    const firstRun = runGenerator(12, first)
    expect(firstRun.status, firstRun.stderr).toBe(0)

    const files = await markdownFiles(first)
    expect(files).toHaveLength(12)
    expect(files[0]).toBe('00_Home.md')

    const manifest = JSON.parse(
      await readFile(resolve(first, '.tsuzune-performance-fixture.json'), 'utf8')
    ) as {
      schemaVersion: number
      noteCount: number
      directedLinkCount: number
      renderedUndirectedPairCount: number
      markdownSha256: string
      homePath: string
    }
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      noteCount: 12,
      directedLinkCount: 24,
      renderedUndirectedPairCount: 24,
      homePath: '00_Home.md'
    })
    expect(manifest.markdownSha256).toBe(await markdownDigest(first))

    const paths = new Set(files.map((path) => path.replace(/\.md$/i, '')))
    for (const path of files) {
      const content = await readFile(resolve(first, path), 'utf8')
      for (const match of content.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
        expect(paths.has(match[1]), `${path} -> ${match[1]}`).toBe(true)
      }
    }

    const initialDigest = await markdownDigest(first)
    const reuseRun = runGenerator(12, first)
    expect(reuseRun.status, reuseRun.stderr).toBe(0)
    expect(await markdownDigest(first)).toBe(initialDigest)

    await writeFile(
      resolve(first, '.tsuzune-performance-fixture.json'),
      `${JSON.stringify({ ...manifest, homePath: 'wrong.md' }, null, 2)}\n`,
      'utf8'
    )
    const tamperedReuseRun = runGenerator(12, first)
    expect(tamperedReuseRun.status).not.toBe(0)

    const secondRun = runGenerator(12, second)
    expect(secondRun.status, secondRun.stderr).toBe(0)
    expect(await markdownDigest(second)).toBe(initialDigest)
  })
})
