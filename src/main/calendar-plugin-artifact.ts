import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

export const CALENDAR_PLUGIN_CONTRACT = Object.freeze({
  id: 'calendar',
  version: '1.5.10',
  mainSha256: '7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125',
  manifestSha256: 'f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b',
  maxMainBytes: 8 * 1024 * 1024,
  maxManifestBytes: 64 * 1024,
})
export type CalendarArtifactContract = Readonly<{
  id: string
  version: string
  mainSha256: string
  manifestSha256: string
  maxMainBytes: number
  maxManifestBytes: number
}>

export type CalendarArtifactFailure =
  | 'invalid-vault-root' | 'missing-plugin-directory' | 'plugin-directory-symlink' | 'path-escape'
  | 'missing-main' | 'main-file-symlink' | 'main-too-large' | 'main-hash-mismatch'
  | 'missing-manifest' | 'manifest-file-symlink' | 'manifest-too-large' | 'manifest-hash-mismatch'
  | 'invalid-manifest' | 'manifest-contract-mismatch'

export type CalendarArtifactVerification =
  | { ok: true; id: string; version: string; mainPath: string; manifestPath: string; mainSha256: string; manifestSha256: string; mainSource: Uint8Array }
  | { ok: false; reason: CalendarArtifactFailure }

function digest(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex') }
function inside(root: string, target: string) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export async function verifyCalendarPluginArtifact(vaultRoot: string, contract: CalendarArtifactContract = CALENDAR_PLUGIN_CONTRACT): Promise<CalendarArtifactVerification> {
  const root = resolve(vaultRoot)
  let rootStat
  try { rootStat = await lstat(root) } catch { return { ok: false, reason: 'invalid-vault-root' } }
  if (!rootStat.isDirectory()) return { ok: false, reason: 'invalid-vault-root' }
  const dir = join(root, '.obsidian', 'plugins', 'calendar')
  try {
    const stat = await lstat(dir)
    if (stat.isSymbolicLink()) return { ok: false, reason: 'plugin-directory-symlink' }
    let resolvedDir: string
    try { resolvedDir = await realpath(dir) } catch { return { ok: false, reason: 'path-escape' } }
    if (!stat.isDirectory() || !inside(root, resolvedDir)) return { ok: false, reason: 'path-escape' }
  } catch { return { ok: false, reason: 'missing-plugin-directory' } }
  const mainPath = join(dir, 'main.js'), manifestPath = join(dir, 'manifest.json')
  let main: Buffer, manifest: Buffer
  try { if ((await lstat(mainPath)).isSymbolicLink()) return { ok: false, reason: 'main-file-symlink' }; main = await readFile(mainPath) } catch { return { ok: false, reason: 'missing-main' } }
  try { if (!inside(root, await realpath(mainPath))) return { ok: false, reason: 'path-escape' } } catch { return { ok: false, reason: 'path-escape' } }
  if (main.byteLength > contract.maxMainBytes) return { ok: false, reason: 'main-too-large' }
  const mainSha256 = digest(main)
  if (mainSha256 !== contract.mainSha256) return { ok: false, reason: 'main-hash-mismatch' }
  try { if ((await lstat(manifestPath)).isSymbolicLink()) return { ok: false, reason: 'manifest-file-symlink' }; manifest = await readFile(manifestPath) } catch { return { ok: false, reason: 'missing-manifest' } }
  try { if (!inside(root, await realpath(manifestPath))) return { ok: false, reason: 'path-escape' } } catch { return { ok: false, reason: 'path-escape' } }
  if (manifest.byteLength > contract.maxManifestBytes) return { ok: false, reason: 'manifest-too-large' }
  const manifestSha256 = digest(manifest)
  if (manifestSha256 !== contract.manifestSha256) return { ok: false, reason: 'manifest-hash-mismatch' }
  let parsed: unknown
  try { parsed = JSON.parse(manifest.toString('utf8')) } catch { return { ok: false, reason: 'invalid-manifest' } }
  if (!parsed || typeof parsed !== 'object' || (parsed as Record<string, unknown>).id !== contract.id || (parsed as Record<string, unknown>).version !== contract.version) return { ok: false, reason: 'manifest-contract-mismatch' }
  return { ok: true, id: contract.id, version: contract.version, mainPath, manifestPath, mainSha256, manifestSha256, mainSource: main }
}
