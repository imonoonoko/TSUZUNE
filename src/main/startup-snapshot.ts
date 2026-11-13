import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import type { StartupSnapshot, VaultSnapshot } from '../shared/types'

const compress = promisify(gzip)
const minBodyCharacters = 256 * 1024

export async function packStartupSnapshot(snapshot: VaultSnapshot): Promise<StartupSnapshot> {
  let characters = 0
  for (const note of snapshot.notes) characters += note.content.length
  if (characters < minBodyCharacters) return snapshot

  const json = JSON.stringify(snapshot)
  const compressed = await compress(json, { level: 1 }).catch(() => null)
  if (!compressed || Math.ceil(compressed.length / 3) * 4 >= Buffer.byteLength(json)) return snapshot
  return { encoding: 'gzip-base64', data: compressed.toString('base64') }
}
