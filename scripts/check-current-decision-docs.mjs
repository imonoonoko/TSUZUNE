import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const repositoryRoot = resolve(process.argv[2] ?? process.cwd())

const contracts = [
  {
    path: 'docs/INDEX.md',
    heading: '## 現在の開発',
    expected:
      '- [改善・未達成項目 実行台帳](reports/tsuzune-improvement-ledger-2026-08-23.md) — する／しない／条件成立時だけを確定した判断索引。現在のPrimary／Nextは[PLAN.mdのCurrent Decision](../PLAN.md#current-decision)を正本とし、ここでは可変状態を複製しない。'
  },
  {
    path: 'PROJECT_STATUS.md',
    heading: '## 優先キュー',
    expected:
      '現在のPrimary／Nextは[PLAN.mdのCurrent Decision](PLAN.md#current-decision)を正本とします。候補の評価履歴は[改善・未達成項目 実行台帳](docs/reports/tsuzune-improvement-ledger-2026-08-23.md)を参照し、この節では可変なNextを複製しません。'
  }
]

const plan = (await readFile(join(repositoryRoot, 'PLAN.md'), 'utf8')).replaceAll(
  '\r\n',
  '\n'
)
assert(plan.includes('\n### Current Decision\n'), 'PLAN.md must contain Current Decision.')

const readme = (await readFile(join(repositoryRoot, 'README.md'), 'utf8')).replaceAll(
  '\r\n',
  '\n'
)
assert.equal(
  readme.split('\n').find((line) => line.startsWith('| 現在の開発slice |')),
  '| 現在の開発slice | [Product Plan](PLAN.md#current-decision)のCurrent Decisionを参照 |',
  'README.md must point to PLAN.md Current Decision for the current development slice.'
)
assert(
  readme.includes(
    '本番commit、検証済み範囲、未証明境界は[PROJECT_STATUS.md](PROJECT_STATUS.md)を正本とします。現在のPrimary／Nextと実行順は[PLAN.mdのCurrent Decision](PLAN.md#current-decision)、資料とEvidenceは[docs/INDEX.md](docs/INDEX.md)から辿れます。'
  ),
  'README.md must separate status evidence from Current Decision ownership.'
)

for (const contract of contracts) {
  const markdown = (
    await readFile(join(repositoryRoot, contract.path), 'utf8')
  ).replaceAll('\r\n', '\n')
  const section = markdown.split(`${contract.heading}\n`, 2)[1]
  assert(section, `${contract.path} must contain ${contract.heading}.`)
  const firstContent = section.split('\n').find((line) => line.trim())?.trim()
  assert.equal(
    firstContent,
    contract.expected,
    `${contract.path} must only point to PLAN.md for dynamic Primary and Next state.`
  )
}

console.log('Current Decision docs check passed: PLAN.md owns dynamic Primary and Next state.')
