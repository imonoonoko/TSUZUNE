import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

const sourcePath = resolve('work/m5-benchmark-2026-08-09/C-temporal.md')
const targetPath = resolve('work/x1-t1-desktop-fixture-2026-08-09-v2')
const supplements = new Map([
  ['40_情報源/TSUZUNE-Git-checkpoints-2026-07-31.md', `# TSUZUNE Git checkpoints 2026-07-31

確認日: 2026-07-31
種類: ローカルGitリポジトリの検証記録
対象: \`C:\\Users\\Humin\\Documents\\Codex\\TSUZUNE\`

## 確認できた公開済みチェックポイント

| 時刻 | Commit | 内容 |
|---|---|---|
| 2026-07-30T13:19:28+09:00 | \`cf24860888179965d92a93b6efd98e78783c924b\` | TSUZUNE v0.1.0完成 |
| 2026-07-30T14:34:08+09:00 | \`0c66af80511ef3b393017e4336319f903b6cee5e\` | Codex・ChatGPT向けMCP連携を追加 |
| 2026-07-31T01:56:13+09:00 | \`4b3576564af896f0bbf3291f21c08ababed57687\` | Temporal Memory M0〜M4を追加 |

\`4b35765\`では、任意時点のContext、履歴選択、時間状態、採用理由、警告、Temporal Inspectorまでが含まれる。コミット時の回帰確認は13ファイル・102テスト、MCP smoke、型検査、ビルドが成功した。

## 証拠の境界

- 上表は各コミット時点でGitへ保存された内容を示す。
- 2026-07-31に始めたM5 dogfoodの未コミット作業まで、\`4b35765\`へ含まれるとは扱わない。
- リポジトリはprivate remoteで管理されている。

関連プロジェクト: [[10_プロジェクト/TSUZUNE]]
`]
])

try {
  await access(targetPath)
  throw new Error(`復元先が既に存在します: ${targetPath}`)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const captured = await readFile(sourcePath, 'utf8')
const entries = new Map()
const blockPattern = /TSUZUNE_SOURCE_BEGIN\r?\n## Source: [^\r\n]+\r?\nPath: ([^\r\n]+)[\s\S]*?Updated: [^\r\n]+\r?\n([\s\S]*?)\r?\nTSUZUNE_SOURCE_END/g

for (const match of captured.matchAll(blockPattern)) {
  const [, path, content] = match
  if (content.startsWith('[時間範囲が不明な通常ノート本文')) continue
  const existing = entries.get(path)
  if (existing && existing !== content) {
    throw new Error(`同一pathの復元本文が一致しません: ${path}`)
  }
  entries.set(path, content)
}
for (const [path, content] of supplements) entries.set(path, content)

if (entries.size < 20) throw new Error(`復元ノート数が不足しています: ${entries.size}`)

for (const [path, content] of entries) {
  const destination = resolve(targetPath, path)
  if (relative(targetPath, destination).startsWith('..')) throw new Error(`不正なpathです: ${path}`)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, content, 'utf8')
}

const files = [...entries]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') }))
const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex')
const manifest = {
  kind: 'reconstructed-fixture',
  source: 'work/m5-benchmark-2026-08-09/C-temporal.md',
  source_sha256: createHash('sha256').update(captured).digest('hex'),
  note_count: files.length,
  content_sha256: digest,
  boundary: 'Reconstructed from captured Context blocks; not the original 247-file Vault snapshot.',
  files
}
await writeFile(resolve(targetPath, 'FIXTURE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ targetPath, noteCount: files.length, contentSha256: digest }))
