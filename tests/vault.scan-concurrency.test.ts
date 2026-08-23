import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const reads = vi.hoisted(() => ({ active: 0, max: 0 }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(async (...args: Parameters<typeof actual.readFile>) => {
      if (!String(args[0]).toLocaleLowerCase().endsWith('.md')) {
        return actual.readFile(...args)
      }

      reads.active += 1
      reads.max = Math.max(reads.max, reads.active)
      try {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return await actual.readFile(...args)
      } finally {
        reads.active -= 1
      }
    })
  }
})

import { VaultService } from '../src/main/vault'

const roots: string[] = []

afterEach(async () => {
  reads.active = 0
  reads.max = 0
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('VaultService scan concurrency', () => {
  it('bounds simultaneous Markdown reads while preserving every note', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-scan-concurrency-'))
    roots.push(root)
    await Promise.all(
      Array.from({ length: 96 }, (_, index) =>
        writeFile(join(root, `Note-${String(index).padStart(3, '0')}.md`), `# Note ${index}`, 'utf8')
      )
    )

    const vault = new VaultService()
    await vault.setRootPath(root)
    const snapshot = await vault.scan()

    expect(snapshot.notes).toHaveLength(96)
    expect(reads.max).toBeGreaterThan(1)
    expect(reads.max).toBeLessThanOrEqual(16)
  })
})
