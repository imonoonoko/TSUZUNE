import { createHash } from 'node:crypto'
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

const MANIFEST_NAME = '.tsuzune-performance-fixture.json'

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function listMarkdownFiles(root) {
  const files = []

  async function visit(directory) {
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

async function markdownDigest(root) {
  const hash = createHash('sha256')
  for (const path of await listMarkdownFiles(root)) {
    hash.update(path)
    hash.update('\0')
    hash.update(await readFile(resolve(root, path)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function notePaths(count) {
  const paths = ['00_Home.md']
  for (let index = 1; index < count; index += 1) {
    const group = String(Math.floor((index - 1) / 100) + 1).padStart(2, '0')
    paths.push(`10_Notes/Group-${group}/Note-${String(index).padStart(4, '0')}.md`)
  }
  return paths
}

function withoutExtension(path) {
  return path.replace(/\.md$/i, '')
}

function noteContent(paths, index) {
  const count = paths.length
  const farOffset = Math.floor(count / 2) + 1
  const next = withoutExtension(paths[(index + 1) % count])
  const far = withoutExtension(paths[(index + farOffset) % count])
  const id = String(index).padStart(4, '0')
  const title = index === 0 ? 'Performance Fixture Home' : `Performance Note ${id}`

  return `# ${title}\n\n` +
    `TSUZUNEの大規模Vault性能を同じ条件で測定するための決定的fixtureです。\n\n` +
    `- fixture_id: ${id}\n` +
    `- next: [[${next}]]\n` +
    `- far: [[${far}]]\n\n` +
    `この本文は検索、Markdown読込、Wikiリンク解析、グラフ描画の負荷を再現します。\n`
}

async function reuseExistingFixture(output, count) {
  const manifestPath = resolve(output, MANIFEST_NAME)
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Output already exists without ${MANIFEST_NAME}: ${output}`)
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const digest = await markdownDigest(output)
  if (
    manifest.schemaVersion !== 1 ||
    manifest.noteCount !== count ||
    manifest.directedLinkCount !== count * 2 ||
    manifest.renderedUndirectedPairCount !== count * 2 ||
    manifest.homePath !== '00_Home.md' ||
    manifest.markdownSha256 !== digest
  ) {
    throw new Error(`Existing fixture does not match the requested deterministic fixture: ${output}`)
  }

  process.stdout.write(`${JSON.stringify(manifest)}\n`)
}

async function main() {
  const count = Number.parseInt(readArgument('--count') ?? '', 10)
  const outputArgument = readArgument('--output')
  if (!Number.isInteger(count) || count < 3 || !outputArgument) {
    throw new Error('Usage: node scripts/generate-large-vault-fixture.mjs --count <3+> --output <directory>')
  }

  const output = resolve(outputArgument)
  if (await pathExists(output)) {
    await reuseExistingFixture(output, count)
    return
  }

  const paths = notePaths(count)
  for (let index = 0; index < paths.length; index += 1) {
    const path = resolve(output, paths[index])
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, noteContent(paths, index), 'utf8')
  }

  const manifest = {
    schemaVersion: 1,
    noteCount: count,
    directedLinkCount: count * 2,
    renderedUndirectedPairCount: count * 2,
    homePath: '00_Home.md',
    markdownSha256: await markdownDigest(output)
  }
  await writeFile(
    resolve(output, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
  process.stdout.write(`${JSON.stringify(manifest)}\n`)
}

await main()
