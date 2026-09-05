import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
// @ts-expect-error The production gate is an executable JavaScript module tested at runtime.
import { snapshotSourceTree } from '../scripts/source-fingerprint.mjs'

it('archives exact dirty and untracked source bytes while excluding private inputs and keeping checkout LF', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-source-archive-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const put = async (path: string, content: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  try {
    git('init', '--quiet')
    git('config', 'core.autocrlf', 'true')
    await copyFile('.gitignore', join(root, '.gitignore'))
    await copyFile('.gitattributes', join(root, '.gitattributes'))
    await put('note.md', '# baseline\r\n')
    git('add', '.gitignore', '.gitattributes', 'note.md')
    await rm(join(root, 'note.md'))
    git('checkout-index', '--force', '--all')
    expect(await readFile(join(root, 'note.md'), 'utf8')).toBe('# baseline\n')

    const dirty = '\uFEFF# dirty\r\nsecond\n'
    await put('note.md', dirty)
    await put('new.md', 'untracked\r\n')
    for (const path of [
      'index.js', 'index-example.js',
      '.agent/requirements/20260902-vault-inbox-taxonomy/private.md',
      '.workflow/tsuzune-full-knowledge-reorganization-2026-09-02/private.md'
    ]) await put(path, 'synthetic private input')
    const stagedCandidates = git('add', '--all', '--dry-run')
    expect(stagedCandidates).toContain('new.md')
    expect(stagedCandidates).not.toMatch(/index.*\.js|private\.md/)

    const archive = join(root, 'work', 'archive')
    const before = await snapshotSourceTree(root, archive)
    expect(before.fileCount).toBe(4)
    expect(await readFile(join(archive, 'note.md'), 'utf8')).toBe(dirty)
    expect(await readFile(join(archive, 'new.md'), 'utf8')).toBe('untracked\r\n')
    expect(await snapshotSourceTree(root)).toEqual(before)
    await expect(snapshotSourceTree(root, archive)).rejects.toMatchObject({ code: 'EEXIST' })
    await put('note.md', '# later\n')
    expect((await snapshotSourceTree(root)).digest).not.toBe(before.digest)
    expect(await readFile(join(archive, 'note.md'), 'utf8')).toBe(dirty)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
