import { basenameRelative, dirnameRelative, validateRelativePath } from './paths'
import type { VaultAttachment } from '../shared/types'

export interface PdfLocation { path: string; page: number; search: string }

export function resolvePdfLink(target: string, kind: 'wiki' | 'markdown', notePath: string, attachments: readonly VaultAttachment[]): PdfLocation | null {
  if (!target || target.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(target) || target.includes('?')) return null
  const hash = target.indexOf('#')
  let path = hash < 0 ? target : target.slice(0, hash)
  if (kind === 'markdown') { try { path = decodeURIComponent(path) } catch { return null } }
  if (!/\.pdf$/i.test(path) || path.includes('#') || path.includes('?') || path.startsWith('//')) return null
  const params = new URLSearchParams(hash < 0 ? '' : target.slice(hash + 1))
  if ([...params.keys()].some(key => !['page', 'search'].includes(key) || params.getAll(key).length !== 1)) return null
  const pageText = params.get('page') ?? '1'
  const page = Number(pageText), search = params.get('search') ?? ''
  if (!/^[1-9]\d*$/.test(pageText) || !Number.isSafeInteger(page) || search.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(search)) return null
  path = path.replaceAll('\\', '/')
  const parts = path.startsWith('/') || kind === 'wiki' ? [] : dirnameRelative(notePath).split('/').filter(Boolean)
  for (const part of path.replace(/^\//, '').split('/')) {
    if (part === '.') continue
    if (part === '..') { if (!parts.length) return null; parts.pop() }
    else if (part) parts.push(part)
    else return null
  }
  const resolved = parts.join('/')
  if (!validateRelativePath(resolved).valid) return null
  const candidates = [resolved]
  if (kind === 'wiki' && !path.startsWith('/')) candidates.push([dirnameRelative(notePath), resolved].filter(Boolean).join('/'))
  let attachment = candidates.map(candidate => attachments.find(item => item.path.toLocaleLowerCase() === candidate.toLocaleLowerCase())).find(Boolean)
  if (!attachment && kind === 'wiki' && !path.includes('/')) {
    const matches = attachments.filter(item => basenameRelative(item.path).toLocaleLowerCase() === path.toLocaleLowerCase())
    if (matches.length === 1) attachment = matches[0]
  }
  return attachment ? { path: attachment.path, page, search } : null
}

export function createPdfCitation(location: PdfLocation, quote = ''): string {
  const selected = quote.trim()
  const search = selected.replace(/\s+/g, ' ').slice(0, 500) || location.search
  const path = location.path.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
  const label = `${basenameRelative(location.path)} · p.${location.page}`.replace(/[\\[\]()]/g, '\\$&')
  const link = `[${label}](/${path}#page=${location.page}${search ? `&search=${encodeURIComponent(search).replace(/[()]/g, char => `%${char.charCodeAt(0).toString(16)}`)}` : ''})`
  return selected ? `${selected.split(/\r?\n/).map(line => `> ${line}`).join('\n')}\n\n${link}` : link
}
