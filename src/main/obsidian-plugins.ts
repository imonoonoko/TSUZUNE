import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ObsidianPluginCandidate,
  ObsidianPluginCandidateStatus
} from '../shared/obsidian-plugins'

const MAX_MANIFEST_BYTES = 64 * 1024
const MAX_PLUGINS = 200

function emptyCandidate(
  id: string,
  status: ObsidianPluginCandidateStatus,
  reason: string
): ObsidianPluginCandidate {
  return {
    id,
    name: '',
    version: '',
    description: '',
    author: '',
    minAppVersion: '',
    isDesktopOnly: false,
    hasMain: false,
    hasStyles: false,
    status,
    reason
  }
}

async function isPlainDirectory(path: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    return info.isDirectory() && !info.isSymbolicLink()
  } catch {
    return false
  }
}

async function isPlainFile(path: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    return info.isFile() && !info.isSymbolicLink()
  } catch {
    return false
  }
}

export async function listObsidianPluginCandidates(
  rootPath: string | null
): Promise<ObsidianPluginCandidate[]> {
  if (!rootPath || !(await isPlainDirectory(rootPath))) {
    return []
  }

  const obsidianPath = join(rootPath, '.obsidian')
  const pluginsPath = join(obsidianPath, 'plugins')
  if (
    !(await isPlainDirectory(obsidianPath)) ||
    !(await isPlainDirectory(pluginsPath))
  ) {
    return []
  }

  let entries
  try {
    entries = await readdir(pluginsPath, { withFileTypes: true })
  } catch {
    return []
  }

  const pluginEntries = entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, MAX_PLUGINS)
  const candidates: ObsidianPluginCandidate[] = []

  for (const entry of pluginEntries) {
    const pluginPath = join(pluginsPath, entry.name)
    let pluginInfo
    try {
      pluginInfo = await lstat(pluginPath)
    } catch {
      continue
    }
    if (pluginInfo.isSymbolicLink()) {
      candidates.push(
        emptyCandidate(
          entry.name,
          'invalid',
          'プラグインフォルダーがシンボリックリンクです'
        )
      )
      continue
    }
    if (!pluginInfo.isDirectory()) {
      continue
    }

    const manifestPath = join(pluginPath, 'manifest.json')
    let manifestInfo
    try {
      manifestInfo = await lstat(manifestPath)
    } catch {
      candidates.push(
        emptyCandidate(entry.name, 'incomplete', 'manifest.jsonがありません')
      )
      continue
    }
    if (manifestInfo.isSymbolicLink()) {
      candidates.push(
        emptyCandidate(
          entry.name,
          'invalid',
          'manifest.jsonがシンボリックリンクです'
        )
      )
      continue
    }
    if (!manifestInfo.isFile()) {
      candidates.push(
        emptyCandidate(entry.name, 'invalid', 'manifest.jsonが通常ファイルではありません')
      )
      continue
    }
    if (manifestInfo.size > MAX_MANIFEST_BYTES) {
      candidates.push(
        emptyCandidate(entry.name, 'invalid', 'manifest.jsonが大きすぎます')
      )
      continue
    }

    let rawManifest: string
    try {
      rawManifest = await readFile(manifestPath, 'utf8')
    } catch {
      candidates.push(
        emptyCandidate(entry.name, 'invalid', 'manifest.jsonを読み込めません')
      )
      continue
    }

    let manifest: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(rawManifest)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Manifest must be an object')
      }
      manifest = parsed as Record<string, unknown>
    } catch {
      candidates.push(
        emptyCandidate(entry.name, 'invalid', 'manifest.jsonの形式が不正です')
      )
      continue
    }

    const requiredStrings = [
      'id',
      'name',
      'version',
      'description',
      'author',
      'minAppVersion'
    ]
    const invalidFields = requiredStrings.filter(
      (key) => typeof manifest[key] !== 'string' || manifest[key] === ''
    )
    const id = typeof manifest.id === 'string' ? manifest.id : entry.name
    if (invalidFields.length > 0) {
      candidates.push({
        ...emptyCandidate(
          id,
          'invalid',
          `必須項目が不正です: ${invalidFields.join(', ')}`
        ),
        name: typeof manifest.name === 'string' ? manifest.name : '',
        version: typeof manifest.version === 'string' ? manifest.version : ''
      })
      continue
    }
    if (id !== entry.name) {
      candidates.push({
        ...emptyCandidate(id, 'invalid', 'フォルダー名とidが一致しません'),
        name: manifest.name as string,
        version: manifest.version as string
      })
      continue
    }
    if (typeof manifest.isDesktopOnly !== 'boolean') {
      candidates.push({
        ...emptyCandidate(id, 'invalid', 'isDesktopOnlyが不正です'),
        name: manifest.name as string,
        version: manifest.version as string
      })
      continue
    }

    const hasMain = await isPlainFile(join(pluginPath, 'main.js'))
    const hasStyles = await isPlainFile(join(pluginPath, 'styles.css'))
    candidates.push({
      id,
      name: manifest.name as string,
      version: manifest.version as string,
      description: manifest.description as string,
      author: manifest.author as string,
      minAppVersion: manifest.minAppVersion as string,
      isDesktopOnly: manifest.isDesktopOnly,
      hasMain,
      hasStyles,
      status: hasMain ? 'detected' : 'incomplete',
      reason: hasMain ? null : 'main.jsがありません'
    })
  }

  return candidates
}
