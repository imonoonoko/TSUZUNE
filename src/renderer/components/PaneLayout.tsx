import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { resizePaneSplit } from '../../shared/pane-layout'
import type { PaneLayoutNode } from '../../shared/workspace-state'

export interface PaneLayoutProps {
  layout: PaneLayoutNode
  activePaneId: string
  renderPane: (paneId: string) => React.ReactNode
  renderPaneActions?: (paneId: string) => React.ReactNode
  renderPaneTabs?: (paneId: string) => React.ReactNode
  onLayoutChange: (layout: PaneLayoutNode) => void
  onActivePaneChange: (paneId: string) => void
  getScroll?: (paneId: string) => { top: number; left: number } | undefined
  onPaneScroll?: (paneId: string, scroll: { top: number; left: number }) => void
}

const minimumPaneSize = 180
const scrollSelector = '.cm-scroller, .markdown-preview, .pane-scroll-content, [data-pane-scroll]'

function PaneShell({ paneId, active, children, actions, tabs, onActivePaneChange, getScroll, onPaneScroll }: {
  paneId: string; active: boolean; children: React.ReactNode
  actions?: React.ReactNode
  tabs?: React.ReactNode
  onActivePaneChange: PaneLayoutProps['onActivePaneChange']
  getScroll: PaneLayoutProps['getScroll']; onPaneScroll: PaneLayoutProps['onPaneScroll']
}): React.JSX.Element {
  const root = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const latest = useRef(getScroll)
  latest.current = getScroll
  const restore = (): void => {
    const target = root.current?.querySelector<HTMLElement>(scrollSelector) ?? null
    if (!target || scroller.current === target) return
    scroller.current = target
    const saved = latest.current?.(paneId)
    if (saved) { target.scrollTop = saved.top; target.scrollLeft = saved.left }
  }
  // Restore newly mounted views only; ordinary draft/scroll renders must not rewind the view.
  useLayoutEffect(restore)
  useEffect(() => {
    const observer = new MutationObserver(restore)
    if (root.current) observer.observe(root.current, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [paneId])
  return <section ref={root} data-pane-id={paneId} className={`workspace-pane${active ? ' is-active' : ''}`}
    id={`workspace-pane-${paneId}`} aria-label={`ペイン ${paneId}`}
    onFocusCapture={event => { if (!(event.target as HTMLElement).closest('.workspace-tabs-shell, .workspace-tabs-menu')) onActivePaneChange(paneId) }}
    onPointerDownCapture={event => { if (!(event.target as HTMLElement).closest('.workspace-tabs-shell, .workspace-tabs-menu')) onActivePaneChange(paneId) }}
    onScrollCapture={event => {
      const target = event.target
      if (target instanceof HTMLElement && target.matches(scrollSelector)) {
        onPaneScroll?.(paneId, { top: target.scrollTop, left: target.scrollLeft })
      }
    }}
    style={{ position: 'relative', minWidth: minimumPaneSize, minHeight: minimumPaneSize, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {actions && <div className="pane-menu-slot">{actions}</div>}
    {tabs}
    {children}
  </section>
}

function layoutMinimum(node: PaneLayoutNode): { width: number; height: number } {
  if (node.kind === 'pane') return { width: minimumPaneSize, height: minimumPaneSize }
  const first = layoutMinimum(node.first)
  const second = layoutMinimum(node.second)
  return node.direction === 'horizontal'
    ? { width: first.width + second.width + 6, height: Math.max(first.height, second.height) }
    : { width: Math.max(first.width, second.width), height: first.height + second.height + 6 }
}

export default function PaneLayout({ layout, activePaneId, renderPane, renderPaneActions, renderPaneTabs, onLayoutChange, onActivePaneChange, getScroll, onPaneScroll }: PaneLayoutProps): React.JSX.Element {
  const latest = useRef(layout)
  latest.current = layout
  const minimum = layoutMinimum(layout)
  const renderNode = (node: PaneLayoutNode, path: ('first' | 'second')[]): React.ReactNode => {
    if (node.kind === 'pane') return <PaneShell key={node.paneId} paneId={node.paneId} active={activePaneId === node.paneId}
      actions={renderPaneActions?.(node.paneId)} tabs={renderPaneTabs?.(node.paneId)} onActivePaneChange={onActivePaneChange} getScroll={getScroll} onPaneScroll={onPaneScroll}>
      {renderPane(node.paneId)}
    </PaneShell>
    const horizontal = node.direction === 'horizontal'
    const firstMin = layoutMinimum(node.first)
    const secondMin = layoutMinimum(node.second)
    const change = (ratio: number): void => onLayoutChange(resizePaneSplit(latest.current, path, ratio))
    return <div key={path.join('-') || 'root'} className="workspace-pane-split" style={{ display: 'grid', width: '100%', height: '100%',
      gridTemplateColumns: horizontal ? `minmax(${firstMin.width}px, ${node.ratio}fr) 6px minmax(${secondMin.width}px, ${1 - node.ratio}fr)` : 'minmax(0, 1fr)',
      gridTemplateRows: horizontal ? 'minmax(0, 1fr)' : `minmax(${firstMin.height}px, ${node.ratio}fr) 6px minmax(${secondMin.height}px, ${1 - node.ratio}fr)` }}>
      {renderNode(node.first, [...path, 'first'])}
      <div role="separator" tabIndex={0} aria-label={horizontal ? '左右のペイン幅を調整' : '上下のペイン高さを調整'}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'} aria-valuemin={10} aria-valuemax={90} aria-valuenow={Math.round(node.ratio * 100)}
        style={{ cursor: horizontal ? 'col-resize' : 'row-resize', touchAction: 'none', background: 'transparent' }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp'
          const increase = horizontal ? 'ArrowRight' : 'ArrowDown'
          if (![decrease, increase, 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          change(event.key === 'Home' ? 0.1 : event.key === 'End' ? 0.9 : node.ratio + (event.key === decrease ? -0.05 : 0.05))
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const separator = event.currentTarget
          const parent = separator.parentElement
          if (!parent) return
          event.preventDefault()
          separator.focus()
          separator.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          const rect = event.currentTarget.parentElement!.getBoundingClientRect()
          const size = horizontal ? rect.width : rect.height
          if (size > 0) change((horizontal ? event.clientX - rect.left : event.clientY - rect.top) / size)
        }}
        onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
      {renderNode(node.second, [...path, 'second'])}
    </div>
  }
  return <div className={`workspace-pane-layout${layout.kind === 'pane' ? ' is-single-pane' : ' is-multiple-panes'}`} style={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'auto' }}>
    <div style={{ minWidth: minimum.width, minHeight: minimum.height, height: '100%' }}>{renderNode(layout, [])}</div>
  </div>
}
