import type { ImportDraft, ImportFile, ImportFormat } from '../shared/importer'
import { normalizeChatGptExport, sha256 } from '../core/chatgpt-export'
import { decodeString } from 'micromark-util-decode-string'

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const MAX_FILE = 128 * 1024 * 1024
const MAX_TOTAL = 256 * 1024 * 1024

function validate(files: ImportFile[]): void {
  if (!files.length || files.length > 5000) throw new Error('取り込みファイル数は1〜5000件です。')
  let total = 0
  const paths = new Set<string>()
  for (const file of files) {
    const parts = file.path.split('/')
    if (parts.some(p => !p || p === '..' || p === '.' || /[\\<>:"|?*\u0000-\u001f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error(`安全でないパス: ${file.path}`)
    const key = file.path.normalize('NFC').toLowerCase()
    if (paths.has(key)) throw new Error(`同名パスの衝突: ${file.path}`)
    paths.add(key)
    total += file.bytes.length
    if (file.bytes.length > MAX_FILE || total > MAX_TOTAL) throw new Error('取り込み容量の上限を超えています。')
  }
}

function addFile(files: ImportFile[], path: string, bytes: Uint8Array): string {
  const used = new Set(files.map(f => f.path.normalize('NFC').toLowerCase()))
  const extension = path.lastIndexOf('.')
  const dot = extension > path.lastIndexOf('/') ? extension : path.length
  let candidate = path
  for (let n = 2; used.has(candidate.normalize('NFC').toLowerCase()); n++) {
    candidate = `${path.slice(0, dot)} (${n})${path.slice(dot)}`
  }
  files.push({ path: candidate, bytes })
  return candidate
}

function csvMarkdown(value: string, budget: number): string {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (quoted) {
      if (c === '"' && value[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else field += c
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false
      if (c !== ',') {
        rows.push(row); row = []
        if (c === '\r' && value[i + 1] === '\n') i++
      }
    } else if (c === '"' && !field && !closed) quoted = true
    else {
      if (closed || c === '"') throw new Error('不正なCSV引用符です。')
      field += c
    }
  }
  if (quoted) throw new Error('CSV引用符が閉じていません。')
  if (field || row.length || closed) rows.push([...row, field])
  if (!rows.length) throw new Error('CSVが空です。')
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
  // Count padded cells and escaping before constructing any output rows. A small
  // ragged CSV can otherwise expand quadratically to hundreds of megabytes.
  let bytes = rows.length * (width * 3 + 2) + width * 6 + 2
  const checkBudget = () => { if (bytes > budget) throw new Error('CSV変換後の取り込み容量が上限を超えています。') }
  checkBudget()
  for (const row of rows) for (const cell of row) {
    bytes += encoder.encode(cell).length
    checkBudget()
    for (const match of cell.matchAll(/&|[<>]|\||\r\n|\r|\n/g)) {
      bytes += match[0] === '&' ? 4 : match[0] === '|' ? 1 : match[0] === '\r\n' ? 2 : 3
      checkBudget()
    }
  }
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => (r[i] ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>')).join(' | ')} |`
  return [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n') + '\n'
}

function safeName(title: string): string {
  const name = title.normalize('NFC').replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '') || '無題'
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name
}

function link(path: string): string { return path.split('/').map(encodeURIComponent).join('/') }
function date(seconds: number | null): string {
  if (seconds === null) return 'unknown'
  const value = new Date(seconds * 1000)
  return Number.isNaN(value.getTime()) ? 'unknown' : value.toISOString()
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function chatgpt(files: ImportFile[], warnings: string[]): ImportFile[] {
  const sources = files.filter(f => /(?:^|\/)conversations(?:[-_]\d+)?\.json$/i.test(f.path))
  if (!sources.length) throw new Error('conversations.json または番号付きJSONがありません。')
  const output = [...sources]
  let count = 0
  for (const source of sources) {
    const raw = decoder.decode(source.bytes)
    const parsed: unknown = JSON.parse(raw)
    const normalized = normalizeChatGptExport(parsed, { sourceId: source.path, sourceSha256: sha256(raw), entryPath: source.path })
    for (const conversation of parsed as unknown[]) {
      for (const [nodeId, node] of Object.entries(record(record(conversation).mapping))) {
        const parts = record(record(record(node).message).content).parts
        if (Array.isArray(parts) && parts.some(p => typeof p !== 'string')) warnings.push(`${source.path}: 非テキストpart (${nodeId})。原文JSONと添付を確認してください。`)
      }
    }
    warnings.push(...normalized.warnings.map(w => `${source.path}: ${w.code}: ${w.message}`))
    for (const conversation of normalized.conversations) {
      count++
      const body = [`# ${conversation.title ?? '無題'}`, '', `原文: [JSON](${link(source.path)})`, `Conversation ID: ${conversation.conversationId}`, `Created: ${date(conversation.createdAtUnixSeconds)}`, `Updated: ${date(conversation.updatedAtUnixSeconds)}`, `Archived: ${conversation.isArchived}`, '']
      for (const message of conversation.messages) {
        body.push(`## ${message.role} / ${message.branch} / ${date(message.createdAtUnixSeconds)}`, `Message ID: ${message.messageId}`, `Parent node: ${message.parentNodeId ?? 'none'}`, `Content type: ${message.contentKind}`, '')
        if (message.contentKind !== 'text' || message.text === null) warnings.push(`${source.path}: 未対応/非テキスト内容 ${message.contentKind} (${message.messageId})。原文JSONを確認してください。`)
        body.push(message.text ?? '[非テキスト内容: 原文JSONを確認]', '')
        for (const ref of message.attachmentRefs) {
          const path = ref.replace(/^file-service:\/\//, '')
          const matches = files.filter(f => f.path === path || f.path.split('/').at(-1) === path)
          if (matches.length === 1 && !sources.includes(matches[0])) {
            if (!output.includes(matches[0])) output.push(matches[0])
            body.push(`[添付](${link(matches[0].path)})`, '')
          } else warnings.push(`添付参照を対応付けできません: ${ref}`)
        }
      }
      addFile(output, `${safeName(conversation.title ?? '無題')}.md`, encoder.encode(body.join('\n')))
    }
  }
  if (!count) throw new Error('取り込めるChatGPT会話がありません。')
  validate(output)
  return output
}

// ENML identifies raw resources by MD5; WebCrypto deliberately has no MD5 algorithm.
function md5(bytes: Uint8Array): string {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64)
  padded.set(bytes); padded[bytes.length] = 128
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, (bytes.length * 8) >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(bytes.length / 0x20000000), true)
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]
  const shifts = [[7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21]]
  for (let offset = 0; offset < padded.length; offset += 64) {
    let [a, b, c, d] = state
    for (let i = 0; i < 64; i++) {
      const round = i >>> 4
      const f = round === 0 ? (b & c) | (~b & d) : round === 1 ? (d & b) | (~d & c) : round === 2 ? b ^ c ^ d : c ^ (b | ~d)
      const g = round === 0 ? i : round === 1 ? (5 * i + 1) % 16 : round === 2 ? (3 * i + 5) % 16 : (7 * i) % 16
      const sum = (a + f + Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) + view.getUint32(offset + g * 4, true)) | 0
      const shift = shifts[round][i % 4]
      const next = (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0
      a = d; d = c; c = b; b = next
    }
    state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0
    state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0
  }
  return state.flatMap(word => [0, 8, 16, 24].map(shift => ((word >>> shift) & 255).toString(16).padStart(2, '0'))).join('')
}

function xml(value: string, root: 'en-export' | 'en-note'): Element {
  if (/<!ENTITY/i.test(value)) throw new Error('XML ENTITY定義は取り込めません。')
  let clean = value.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[\s\S]*?>/gi, declaration => {
    if (declaration.startsWith('<![CDATA[')) return declaration
    const expected = root === 'en-note' ? 'enml2' : 'evernote-export[1-4]'
    const pattern = new RegExp(`^<!DOCTYPE\\s+${root}\\s+(?:SYSTEM\\s+|PUBLIC\\s+["'][^"'<>\\[\\]]+["']\\s+)["']https?:\\/\\/xml\\.evernote\\.com\\/pub\\/${expected}\\.dtd["']\\s*>$`, 'i')
    if (!pattern.test(declaration)) throw new Error('未対応のXML DOCTYPEです。')
    return ''
  })
  // The removed ENML DTD supplies XHTML entities. Decode only known names into
  // numeric XML references, so entity text can never become markup or a DTD.
  if (root === 'en-note') clean = clean.replace(/<!\[CDATA\[[\s\S]*?\]\]>|&[A-Za-z][A-Za-z0-9]+;/g, entity => {
    if (entity.startsWith('<![CDATA[')) return entity
    const decoded = decodeString(entity)
    return decoded === entity ? entity : Array.from(decoded, c => `&#${c.codePointAt(0)};`).join('')
  })
  const doc = new DOMParser().parseFromString(clean, 'application/xml')
  if (doc.querySelector('parsererror') || doc.documentElement.tagName !== root) throw new Error('不正なXMLです。')
  return doc.documentElement
}

function children(el: Element, name: string): Element[] { return Array.from(el.children).filter(c => c.tagName === name) }
function childText(el: Element, name: string): string { return children(el, name)[0]?.textContent ?? '' }
function plain(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function enml(root: Element, resources: Map<string, string>, warnings: string[]): string {
  const walk = (node: Node, depth = 0): string => {
    if (depth > 100) throw new Error('ENMLの入れ子が深すぎます。')
    if (node.nodeType === 3) return plain(node.textContent ?? '')
    if (node.nodeType !== 1) return ''
    const el = node as Element, tag = el.tagName.toLowerCase()
    const content = () => Array.from(el.childNodes).map(n => walk(n, depth + 1)).join('')
    if (tag === 'en-media') {
      const hash = (el.getAttribute('hash') ?? '').toLowerCase()
      const path = resources.get(hash)
      if (!path) { warnings.push(`ENML添付が見つかりません: ${hash}`); return `[添付欠落: ${hash}]` }
      return `[添付](${link(path)})`
    }
    if (tag === 'en-todo') return `${el.parentElement?.tagName === 'li' ? '' : '- '}${el.getAttribute('checked') === 'true' ? '[x]' : '[ ]'} `
    if (tag === 'br') return '\n'
    if (tag === 'pre' || el.getAttribute('style')?.includes('-en-codeblock')) {
      const code = el.textContent ?? ''
      const fence = '`'.repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), m => m[0].length + 1)))
      return `\n${fence}\n${code}\n${fence}\n\n`
    }
    if (tag === 'code') return `\`${content().replace(/`/g, '&#96;')}\``
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? ''
      if (!/^(https?:|mailto:|evernote:|#)/i.test(href)) { warnings.push(`未対応リンク: ${href}`); return content() }
      return `[${content().replace(/\]/g, '\\]')}](${href.replace(/[\s()<>]/g, c => encodeURIComponent(c))})`
    }
    if (tag === 'b' || tag === 'strong') return `**${content()}**`
    if (tag === 'i' || tag === 'em') return `*${content()}*`
    if (tag === 's' || tag === 'strike' || tag === 'del') return `~~${content()}~~`
    if (/^h[1-6]$/.test(tag)) return `\n${'#'.repeat(Number(tag[1]))} ${content()}\n\n`
    if (tag === 'ul' || tag === 'ol') return '\n' + Array.from(el.children).map((li, i) => `${tag === 'ol' ? `${i + 1}.` : '-'} ${walk(li, depth + 1).trim().replace(/\n/g, '\n  ')}\n`).join('') + '\n'
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => walk(td, depth + 1).trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>')))
      if (!rows.length) return ''
      const line = (row: string[]) => `| ${row.join(' | ')} |`
      return '\n' + [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n') + '\n\n'
    }
    if (tag === 'hr') return '\n---\n'
    if (tag === 'blockquote') return '\n' + content().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n'
    const known = ['en-note', 'div', 'p', 'span', 'li', 'td', 'th', 'tbody', 'thead', 'tr', 'u', 'font']
    if (!known.includes(tag)) warnings.push(`未対応ENML要素: ${tag}。本文は保持します。`)
    return ['div', 'p'].includes(tag) ? `${content()}\n\n` : content()
  }
  return walk(root).trim() + '\n'
}

function enex(files: ImportFile[], warnings: string[]): ImportFile[] {
  const sources = files.filter(f => /\.enex$/i.test(f.path))
  if (!sources.length) throw new Error('ENEXファイルがありません。')
  const output = [...sources]
  let count = 0
  for (const source of sources) {
    const root = xml(decoder.decode(source.bytes), 'en-export')
    for (const note of children(root, 'note')) {
      count++
      const resources = new Map<string, string>()
      for (const resource of children(note, 'resource')) {
        const data = children(resource, 'data')[0]
        const encoded = (data?.textContent ?? '').replace(/\s/g, '')
        if (data?.getAttribute('encoding') !== 'base64' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('不正なresource base64です。')
        const raw = atob(encoded)
        const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
        if (btoa(raw) !== encoded) throw new Error('不正なresource base64です。')
        const hash = md5(bytes)
        const attrs = children(resource, 'resource-attributes')[0]
        const filename = attrs ? childText(attrs, 'file-name') : ''
        const extensions: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'application/pdf': '.pdf', 'text/plain': '.txt' }
        const path = addFile(output, `attachments/${count}-${safeName(filename || hash + (extensions[childText(resource, 'mime')] ?? '.bin'))}`, bytes)
        resources.set(hash, path)
      }
      const title = childText(note, 'title') || '無題'
      const body = [`# ${plain(title)}`, '', `原文: [ENEX](${link(source.path)})`, `Created: ${childText(note, 'created') || 'unknown'}`, `Updated: ${childText(note, 'updated') || 'unknown'}`, `Tags: ${children(note, 'tag').map(t => t.textContent ?? '').join(', ')}`, '', enml(xml(childText(note, 'content'), 'en-note'), resources, warnings)]
      addFile(output, `${safeName(title)}.md`, encoder.encode(body.join('\n')))
    }
  }
  if (!count) throw new Error('ENEXにノートがありません。')
  validate(output)
  return output
}

export function buildImportDraft(format: ImportFormat, files: ImportFile[]): ImportDraft {
  validate(files)
  const warnings: string[] = []
  const visible = files.filter(file => {
    const hidden = file.path.split('/').some(p => p.startsWith('.'))
    if (hidden) warnings.push(`隠しファイル/設定を除外: ${file.path}`)
    return !hidden
  })
  if (format === 'chatgpt') return { files: chatgpt(visible, warnings), warnings }
  if (format === 'enex') return { files: enex(visible, warnings), warnings }
  if (format === 'notion') {
    if (!visible.some(f => /\.(md|csv)$/i.test(f.path))) throw new Error('NotionのMarkdown & CSV exportを選択してください。')
    const output = [...visible]
    let remaining = MAX_TOTAL - visible.reduce((sum, f) => sum + f.bytes.length, 0)
    for (const f of visible.filter(f => /\.csv$/i.test(f.path))) {
      const bytes = encoder.encode(csvMarkdown(decoder.decode(f.bytes), Math.min(MAX_FILE, remaining)))
      addFile(output, `${f.path}.md`, bytes)
      remaining -= bytes.length
    }
    warnings.push('NotionのDBビュー・relation・権限等は再現されません。CSV原本を保持します。')
    validate(output)
    return { files: output, warnings }
  }
  if (format !== 'markdown') throw new Error('未対応の取り込み形式です。')
  if (!visible.some(f => /\.md$/i.test(f.path))) throw new Error('Markdownファイルがありません。')
  return { files: visible, warnings }
}
