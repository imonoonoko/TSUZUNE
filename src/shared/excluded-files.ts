function escapeRegularExpression(value: string): string {
  return value.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&')
}

function compilePattern(value: string): RegExp | null {
  const pattern = value.trim()
  if (!pattern) {
    return null
  }

  try {
    return pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')
      ? new RegExp(pattern.slice(1, -1), 'i')
      : new RegExp(`^${escapeRegularExpression(pattern)}`, 'i')
  } catch {
    return null
  }
}

export function parseUserIgnoreFilters(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function createExcludedFileMatcher(
  patterns: readonly string[]
): (path: string) => boolean {
  const compiled = patterns
    .map(compilePattern)
    .filter((pattern): pattern is RegExp => pattern !== null)
  return (path) => compiled.some((pattern) => pattern.test(path))
}

export function isExcludedFilePath(
  path: string,
  patterns: readonly string[]
): boolean {
  return createExcludedFileMatcher(patterns)(path)
}
