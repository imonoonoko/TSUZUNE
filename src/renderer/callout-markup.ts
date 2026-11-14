import type { Element, ElementContent, Root } from 'hast'
import type { VFile } from 'vfile'

const aliases: Record<string, string> = {
  summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip', check: 'success', done: 'success',
  help: 'question', faq: 'question', caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure',
  error: 'danger', cite: 'quote'
}
const icons: Record<string, string> = {
  note: '✎', abstract: '≡', info: 'ⓘ', todo: '☐', tip: '◇', success: '✓', question: '?',
  warning: '⚠', failure: '✕', danger: 'ϟ', bug: '⊗', example: '☷', quote: '❝'
}
const element = (tagName: string, className: string, children: ElementContent[]): Element =>
  ({ type: 'element', tagName, properties: { className: [className] }, children })

// Split at Markdown line breaks, including hard breaks and nested formatting.
// Inline code retains Markdown's own normalization of embedded newlines.
function firstLine(children: ElementContent[]): [ElementContent[], ElementContent[], boolean] {
  const title: ElementContent[] = []
  for (const [index, child] of children.entries()) {
    if (child.type === 'text') {
      const newline = child.value.indexOf('\n')
      if (newline >= 0) return [
        [...title, { ...child, value: child.value.slice(0, newline) }],
        [{ ...child, value: child.value.slice(newline + 1) }, ...children.slice(index + 1)], true
      ]
    } else if (child.type === 'element') {
      if (child.tagName === 'br') return [title, children.slice(index + 1), true]
      const [before, after, split] = firstLine(child.children)
      if (split) return [
        [...title, ...(before.length ? [{ ...child, children: before }] : [])],
        [...(after.length ? [{ ...child, children: after }] : []), ...children.slice(index + 1)], true
      ]
    }
    title.push(child)
  }
  return [title, [], false]
}

export function calloutMarkup(): (tree: Root, file: VFile) => void {
  return (tree, file) => {
    const source = String(file)
    const visit = (node: Root | Element): void => {
      node.children.forEach(child => { if (child.type === 'element') visit(child) })
      if (node.type !== 'element' || node.tagName !== 'blockquote') return
      const index = node.children.findIndex(child => child.type === 'element')
      const paragraph = node.children[index]
      if (paragraph?.type !== 'element' || paragraph.tagName !== 'p') return
      const first = paragraph.children[0]
      if (first?.type !== 'text') return
      // HAST text unescapes Markdown; consult source to keep \[!note] literal.
      const offset = paragraph.position?.start.offset
      if (offset === undefined || !source.slice(offset).startsWith('[!')) return
      const match = /^\[!([a-z\d_-]+)\]([+-])?(?:[ \t]+|(?=\n|$))/i.exec(first.value)
      if (!match) return
      const name = match[1].toLowerCase()
      const canonical = aliases[name] ?? name
      const kind = Object.hasOwn(icons, canonical) ? canonical : 'note'
      const [title, rest] = firstLine([{ ...first, value: first.value.slice(match[0].length) }, ...paragraph.children.slice(1)])
      const titleContent = title.some(child => child.type !== 'text' || child.value.trim())
        ? title : [{ type: 'text' as const, value: name[0].toUpperCase() + name.slice(1) }]
      const icon = element('span', 'callout-icon', [{ type: 'text', value: icons[kind] }])
      icon.properties.ariaHidden = 'true'
      const heading = element(match[2] ? 'summary' : 'div', 'callout-title', [icon, ...titleContent])
      const body = element('div', 'callout-content', [
        ...(rest.some(child => child.type !== 'text' || child.value.trim()) ? [{ ...paragraph, children: rest }] : []),
        ...node.children.slice(index + 1)
      ])
      node.tagName = match[2] ? 'details' : 'aside'
      node.properties = { className: ['callout'], 'data-callout': kind, ...(match[2] === '+' ? { open: true } : {}) }
      node.children = [heading, body]
    }
    visit(tree)
  }
}
