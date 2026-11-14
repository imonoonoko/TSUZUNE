export const SUPPORTED_ATTACHMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.svg',
  '.webp',
  '.avif',
  '.pdf',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.weba',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv'
])

export function isSupportedAttachmentPath(path: string): boolean {
  const fileName = path.replaceAll('\\', '/').split('/').at(-1) ?? ''
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return false
  }
  return SUPPORTED_ATTACHMENT_EXTENSIONS.has(
    fileName.slice(dotIndex).toLocaleLowerCase()
  )
}

const MEDIA_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', weba: 'audio/webm',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska'
}

export function mediaMimeType(path: string): string | null {
  const name = path.split(/[\\/]/).at(-1) ?? ''
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return Object.hasOwn(MEDIA_TYPES, extension) ? MEDIA_TYPES[extension] : null
}
