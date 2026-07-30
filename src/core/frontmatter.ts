export interface FrontmatterWarning {
  code: 'MALFORMED_FRONTMATTER'
  message: string
  line?: number
}

export interface FrontmatterParseResult {
  found: boolean
  attributes: Record<string, string | null>
  body: string
  raw: string | null
  warnings: FrontmatterWarning[]
}

const FRONTMATTER_PATTERN =
  /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function parseScalar(value: string): string | null {
  if (value === '' || value === 'null' || value === '~') {
    return null
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }

  return value
}

export function parseFrontmatter(markdown: string): FrontmatterParseResult {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match) {
    if (/^(?:\uFEFF)?---(?:\r?\n|$)/.test(markdown)) {
      return {
        found: true,
        attributes: {},
        body: markdown,
        raw: null,
        warnings: [
          {
            code: 'MALFORMED_FRONTMATTER',
            message: 'Frontmatter closing delimiter is missing.'
          }
        ]
      }
    }

    return {
      found: false,
      attributes: {},
      body: markdown,
      raw: null,
      warnings: []
    }
  }

  const attributes: Record<string, string | null> = {}
  const warnings: FrontmatterWarning[] = []
  const lines = match[1].split(/\r?\n/)

  for (const [index, line] of lines.entries()) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue
    }

    const field = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line)
    if (!field) {
      warnings.push({
        code: 'MALFORMED_FRONTMATTER',
        message: 'Top-level key and scalar value are required.',
        line: index + 2
      })
      continue
    }

    attributes[field[1]] = parseScalar(field[2] ?? '')
  }

  return {
    found: true,
    attributes,
    body: markdown.slice(match[0].length),
    raw: match[0].replace(/\r?\n$/, ''),
    warnings
  }
}
