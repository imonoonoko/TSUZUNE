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
