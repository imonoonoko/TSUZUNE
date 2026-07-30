const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

export interface PathValidation {
  valid: boolean
  normalized?: string
  reason?: string
}

export function validateEntryName(name: string): PathValidation {
  if (name.length === 0) {
    return { valid: false, reason: '名前を入力してください。' }
  }

  if (name !== name.trim()) {
    return { valid: false, reason: '名前の先頭や末尾に空白は使えません。' }
  }

  if (name.startsWith('.')) {
    return { valid: false, reason: 'ドットで始まる名前はTSUZUNEの管理対象にできません。' }
  }

  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name)) {
    return { valid: false, reason: 'Windowsで使えない文字が含まれています。' }
  }

  if (name.endsWith('.') || name.endsWith(' ')) {
    return { valid: false, reason: '名前の末尾にピリオドや空白は使えません。' }
  }

  const baseName = name.split('.')[0].toUpperCase()
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return { valid: false, reason: 'Windowsの予約名は使えません。' }
  }

  return { valid: true, normalized: name }
}

export function validateRelativePath(value: string): PathValidation {
  if (!value) {
    return { valid: true, normalized: '' }
  }

  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\')) {
    return { valid: false, reason: '絶対パスは使えません。' }
  }

  const normalized = value.replaceAll('\\', '/')
  const parts = normalized.split('/')

  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') {
      return { valid: false, reason: '空の階層、.、.. は使えません。' }
    }

    const entryValidation = validateEntryName(part)
    if (!entryValidation.valid) {
      return entryValidation
    }
  }

  return { valid: true, normalized: parts.join('/') }
}

export function joinRelative(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((part) => part.replaceAll('\\', '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

export function dirnameRelative(value: string): string {
  const normalized = value.replaceAll('\\', '/')
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? '' : normalized.slice(0, separator)
}

export function basenameRelative(value: string): string {
  const normalized = value.replaceAll('\\', '/')
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? normalized : normalized.slice(separator + 1)
}

export function withoutMarkdownExtension(value: string): string {
  return value.toLowerCase().endsWith('.md') ? value.slice(0, -3) : value
}

export function withMarkdownExtension(value: string): string {
  return value.toLowerCase().endsWith('.md') ? value : `${value}.md`
}

export function isPathInsideOrEqual(path: string, parent: string): boolean {
  const normalizedPath = path.replaceAll('\\', '/')
  const normalizedParent = parent.replaceAll('\\', '/').replace(/\/+$/, '')
  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`)
}
