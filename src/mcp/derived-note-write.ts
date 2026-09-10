import { mkdir, open, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export async function withDerivedNoteWriteLock<T>(
  settingsPath: string,
  operation: () => Promise<T>
): Promise<T> {
  // Reuse the old lock path so an older MCP process cannot stage a conflicting write.
  const lockPath = join(dirname(settingsPath), 'ai-write-review-proposals.json.lock')
  await mkdir(dirname(lockPath), { recursive: true })
  // ponytail: one local writer; use per-Vault locks if independent Vault writes contend.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let handle
    try {
      handle = await open(lockPath, 'wx')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise((resolve) => setTimeout(resolve, 25))
      continue
    }
    try {
      return await operation()
    } finally {
      await handle.close()
      await unlink(lockPath)
    }
  }
  throw new Error('派生ノートを作成中です。少し待ってから再試行してください。')
}
