import { execFile as execFileCallback } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFile = promisify(execFileCallback)
const script = join(process.cwd(), 'scripts', 'check-current-decision-docs.mjs')

it('keeps dynamic Primary and Next state owned by PLAN.md', async () => {
  await expect(execFile(process.execPath, [script])).resolves.toMatchObject({
    stdout: expect.stringContaining('Current Decision docs check passed')
  })

  const root = await mkdtemp(join(tmpdir(), 'tsuzune-current-decision-'))
  try {
    await mkdir(join(root, 'docs'))
    await Promise.all([
      cp(join(process.cwd(), 'README.md'), join(root, 'README.md')),
      cp(join(process.cwd(), 'PLAN.md'), join(root, 'PLAN.md')),
      cp(join(process.cwd(), 'PROJECT_STATUS.md'), join(root, 'PROJECT_STATUS.md')),
      cp(join(process.cwd(), 'docs', 'INDEX.md'), join(root, 'docs', 'INDEX.md'))
    ])
    const indexPath = join(root, 'docs', 'INDEX.md')
    const index = await readFile(indexPath, 'utf8')
    await writeFile(
      indexPath,
      index.replace('ここでは可変状態を複製しない。', '次作業は完了済みlaneを再開する。')
    )

    await expect(execFile(process.execPath, [script, root])).rejects.toMatchObject({
      stderr: expect.stringContaining('docs/INDEX.md must only point to PLAN.md')
    })

    await writeFile(indexPath, index)
    const readmePath = join(root, 'README.md')
    const readme = await readFile(readmePath, 'utf8')
    await writeFile(
      readmePath,
      readme.replace(
        '[Product Plan](PLAN.md#current-decision)のCurrent Decisionを参照',
        '[Product Plan](PLAN.md)のActive Trackを参照'
      )
    )
    await expect(execFile(process.execPath, [script, root])).rejects.toMatchObject({
      stderr: expect.stringContaining('README.md must point to PLAN.md Current Decision')
    })

    await writeFile(
      readmePath,
      readme.replace(
        '本番commit、検証済み範囲、未証明境界は[PROJECT_STATUS.md](PROJECT_STATUS.md)を正本とします。現在のPrimary／Nextと実行順は[PLAN.mdのCurrent Decision](PLAN.md#current-decision)、資料とEvidenceは[docs/INDEX.md](docs/INDEX.md)から辿れます。',
        '本番commit、検証済み範囲、未証明境界、次の一手は[PROJECT_STATUS.md](PROJECT_STATUS.md)を正本とします。実行順は[PLAN.md](PLAN.md)、資料とEvidenceは[docs/INDEX.md](docs/INDEX.md)から辿れます。'
      )
    )
    await expect(execFile(process.execPath, [script, root])).rejects.toMatchObject({
      stderr: expect.stringContaining('README.md must separate status evidence from Current Decision')
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
