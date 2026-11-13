import type { Element, ElementContent, Root, RootContent } from 'hast'
import { isSupportedAttachmentPath } from '../shared/attachments'

// Lift block embeds out of phrasing containers, retaining the text on both sides.
// Returning an article from an image renderer would nest block content inside <p>.
export function noteEmbedMarkup({ budget = 64 }: { budget?: number } = {}): (tree: Root) => void {
  const phrasingContainers = /^(?:p|h[1-6]|em|strong|del|a)$/
  function expand(node: ElementContent): ElementContent[] {
    if (node.type !== 'element') return [node]
    if (node.tagName === 'img' && typeof node.properties.src === 'string' && node.properties.src.startsWith('#/vault-asset/')) {
      let target: string
      try { target = decodeURIComponent(node.properties.src.slice('#/vault-asset/'.length)) } catch { return [node] }
      if (!isSupportedAttachmentPath(target.split('#')[0])) {
        return [{ type: 'element', tagName: 'div', properties: { 'data-note-embed': target, 'data-embed-label': node.properties.alt ?? target }, children: [] }]
      }
    }
    const children = node.children.flatMap(expand)
    if (!phrasingContainers.test(node.tagName) || !children.some(child => child.type === 'element' && 'data-note-embed' in child.properties)) {
      return [{ ...node, children }]
    }
    const result: ElementContent[] = []
    let part: ElementContent[] = []
    const flush = (): void => { if (part.length) result.push({ ...node, children: part }); part = [] }
    for (const child of children) {
      if (child.type === 'element' && 'data-note-embed' in child.properties) { flush(); result.push(child) }
      else part.push(child)
    }
    flush()
    return result
  }
  return tree => {
    tree.children = tree.children.flatMap<RootContent>(node => node.type === 'doctype' ? [node] : expand(node))
    const embeds: Element[] = []
    const collect = (node: Root | RootContent): void => {
      if (node.type === 'element' && 'data-note-embed' in node.properties) embeds.push(node)
      if ('children' in node) node.children.forEach(collect)
    }
    collect(tree)
    // Divide a finite allowance among siblings; no shared mutable render counter.
    const childBudget = Math.max(0, Math.floor((budget - embeds.length) / Math.max(1, embeds.length)))
    embeds.forEach((node, index) => { node.properties['data-embed-budget'] = index < budget ? childBudget : -1 })
  }
}
