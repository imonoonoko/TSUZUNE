const TAG_NAME_PATTERN = /^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u
const BODY_TAG_PATTERN =
  /(^|[^\p{L}\p{N}_/-])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu

function normalizeTag(value: string): string | null {
  let tag = value.trim()
  if (
    tag.length >= 2 &&
    ((tag.startsWith('"') && tag.endsWith('"')) ||
      (tag.startsWith("'") && tag.endsWith("'")))
  ) {
    tag = tag.slice(1, -1).trim()
  }
  if (tag.startsWith('#')) {
    tag = tag.slice(1)
  }
  return TAG_NAME_PATTERN.test(tag) ? `#${tag}` : null
}

function extractFrontmatterTags(lines: string[]): string[] {
  const tags: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^\s*tags\s*:\s*(.*)$/i)
    if (!field) {
      continue
    }

    const value = field[1].trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      for (const item of value.slice(1, -1).split(',')) {
        const tag = normalizeTag(item)
        if (tag) {
          tags.push(tag)
        }
      }
      continue
    }

    if (value !== '') {
      const tag = normalizeTag(value)
      if (tag) {
        tags.push(tag)
      }
      continue
    }

    for (let itemIndex = index + 1; itemIndex < lines.length; itemIndex += 1) {
      if (lines[itemIndex].trim() === '') {
        continue
      }
      const listItem = lines[itemIndex].match(/^\s+-\s*(.+?)\s*$/)
      if (!listItem) {
        break
      }
      const tag = normalizeTag(listItem[1])
      if (tag) {
        tags.push(tag)
      }
      index = itemIndex
    }
  }

  return tags
}

function stripInlineCode(line: string): string {
  let result = ''
  let index = 0

  while (index < line.length) {
    if (line[index] !== '`') {
      result += line[index]
      index += 1
      continue
    }

    let delimiterLength = 1
    while (line[index + delimiterLength] === '`') {
      delimiterLength += 1
    }
    const delimiter = '`'.repeat(delimiterLength)
    const closingIndex = line.indexOf(delimiter, index + delimiterLength)
    if (closingIndex === -1) {
      result += delimiter
      index += delimiterLength
      continue
    }

    result += ' '.repeat(closingIndex + delimiterLength - index)
    index = closingIndex + delimiterLength
  }

  return result
}

function extractBodyTags(lines: string[]): string[] {
  const tags: string[] = []
  let fenceMarker: '`' | '~' | null = null
  let fenceLength = 0

  for (const originalLine of lines) {
    const fence = originalLine.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      const marker = fence[1][0] as '`' | '~'
      if (!fenceMarker) {
        fenceMarker = marker
        fenceLength = fence[1].length
      } else if (marker === fenceMarker && fence[1].length >= fenceLength) {
        fenceMarker = null
        fenceLength = 0
      }
      continue
    }
    if (fenceMarker || /^\s{0,3}#{1,6}(?:\s|$)/.test(originalLine)) {
      continue
    }

    const line = stripInlineCode(originalLine).replace(
      /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi,
      ''
    )
    for (const match of line.matchAll(BODY_TAG_PATTERN)) {
      tags.push(`#${match[2]}`)
    }
  }

  return tags
}

export function extractMarkdownTags(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  let frontmatterTags: string[] = []
  let bodyLines = lines

  if (lines[0]?.trim() === '---') {
    const closingIndex = lines.findIndex(
      (line, index) => index > 0 && line.trim() === '---'
    )
    if (closingIndex > 0) {
      frontmatterTags = extractFrontmatterTags(lines.slice(1, closingIndex))
      bodyLines = lines.slice(closingIndex + 1)
    }
  }

  const result: string[] = []
  const seen = new Set<string>()
  for (const tag of [...frontmatterTags, ...extractBodyTags(bodyLines)]) {
    if (!seen.has(tag)) {
      seen.add(tag)
      result.push(tag)
    }
  }
  return result
}
