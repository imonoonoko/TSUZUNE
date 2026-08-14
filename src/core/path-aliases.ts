import { validateRelativePath } from './paths'

export interface CompiledPathAliases {
  /** Keys are normalized, case-folded paths; values are terminal canonical paths. */
  readonly flattened: ReadonlyMap<string, string>
}

function pathKey(path: string): string {
  return path.toLocaleLowerCase()
}

function markdownPath(value: unknown, role: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${role}は文字列で指定してください。`)
  }

  const validation = validateRelativePath(value)
  if (
    !validation.valid ||
    !validation.normalized ||
    !validation.normalized.toLocaleLowerCase().endsWith('.md')
  ) {
    throw new Error(
      `${role}は安全なVault相対Markdownパスで指定してください: ${value}`
    )
  }
  return validation.normalized
}

/**
 * Compiles an old-path -> new-path JSON object.
 *
 * This core accepts bare `.md` paths only. Wiki-link callers must split and
 * retain `#heading`, `#^block`, and `|display alias` before resolving the path.
 */
export function compilePathAliases(value: unknown): CompiledPathAliases {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('パスalias設定は旧パスと新パスのJSON objectで指定してください。')
  }

  const direct = new Map<string, string>()
  const sourcePaths = new Map<string, string>()

  for (const [rawSource, rawTarget] of Object.entries(value)) {
    const source = markdownPath(rawSource, '旧パス')
    const target = markdownPath(rawTarget, '新パス')
    const sourceKey = pathKey(source)
    const previousSource = sourcePaths.get(sourceKey)

    if (previousSource) {
      throw new Error(
        `大文字小文字を区別しない旧パスが衝突しています: ${previousSource}, ${source}`
      )
    }

    sourcePaths.set(sourceKey, source)
    direct.set(sourceKey, target)
  }

  const terminalPaths = new Map<string, string>()
  for (const target of direct.values()) {
    const targetKey = pathKey(target)
    if (direct.has(targetKey)) {
      continue
    }

    const previousTarget = terminalPaths.get(targetKey)
    if (previousTarget && previousTarget !== target) {
      throw new Error(
        `大文字小文字を区別しないcanonical pathが衝突しています: ${previousTarget}, ${target}`
      )
    }
    terminalPaths.set(targetKey, target)
  }

  const flattened = new Map<string, string>()
  const visiting = new Set<string>()

  const flatten = (sourceKey: string): string => {
    const resolved = flattened.get(sourceKey)
    if (resolved) {
      return resolved
    }
    if (visiting.has(sourceKey)) {
      throw new Error(
        `パスaliasに循環があります: ${sourcePaths.get(sourceKey) ?? sourceKey}`
      )
    }

    visiting.add(sourceKey)
    const target = direct.get(sourceKey)!
    const targetKey = pathKey(target)
    const canonical = direct.has(targetKey) ? flatten(targetKey) : target
    visiting.delete(sourceKey)
    flattened.set(sourceKey, canonical)
    return canonical
  }

  for (const sourceKey of direct.keys()) {
    flatten(sourceKey)
  }

  return { flattened }
}

/** Resolves one bare Vault-relative `.md` path and preserves canonical casing. */
export function resolvePathAlias(
  aliases: CompiledPathAliases,
  rawPath: string
): string {
  const path = markdownPath(rawPath, '解決対象パス')
  return aliases.flattened.get(pathKey(path)) ?? path
}
