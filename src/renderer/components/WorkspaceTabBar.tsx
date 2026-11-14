import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import PaneActionsMenu from './PaneActionsMenu'
import Icon from './Icon'
import {
  basenameRelative,
  withoutMarkdownExtension
} from '../../core/paths'

export type WorkspaceTab =
  | {
      id: number
      kind: 'note'
      path: string
      pinned?: boolean
    }
  | { id: number; kind: 'attachment'; path: string }
  | {
      id: number
      kind: 'linked-view'
      path: string
    }
  | {
      id: number
      kind: 'base'
      path: string
    }
  | {
      id: number
      kind: 'canvas'
      path: string
    }
  | {
      id: number
      kind: 'global-graph'
    }
  | {
      id: number
      kind: 'global-properties'
    }

export const WORKSPACE_TAB_PANEL_ID = 'workspace-tabpanel'

export function workspaceTabDomId(tabId: number): string {
  return `workspace-tab-${tabId}`
}

function withoutFileExtension(value: string): string {
  const name = basenameRelative(value)
  const separator = name.lastIndexOf('.')
  return separator > 0 ? name.slice(0, separator) : name
}

export function workspaceTabLabel(tab: WorkspaceTab): string {
  if (tab.kind === 'global-graph') {
    return 'グラフビュー'
  }
  if (tab.kind === 'global-properties') {
    return 'プロパティ一覧'
  }
  if (tab.kind === 'linked-view') {
    return `${withoutFileExtension(tab.path)} へのバックリンク`
  }
  return tab.kind === 'note'
    ? withoutMarkdownExtension(basenameRelative(tab.path))
    : basenameRelative(tab.path)
}

type WorkspaceTabBarProps = {
  peerTabs?: WorkspaceTab[]
  idPrefix?: string
  panelId?: string
  tabs: WorkspaceTab[]
  activeTabId: number | null
  focusTabId?: number | null
  tabRefs?: RefObject<Map<number, HTMLButtonElement>>
  onActivate: (tab: WorkspaceTab) => void
  onClose: (tabId: number) => void
  onTogglePin?: (tabId: number) => void
  onFocus?: (tabId: number) => void
  onKeyDown?: (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: WorkspaceTab
  ) => void
}

export default function WorkspaceTabBar({
  peerTabs,
  idPrefix = '',
  panelId = WORKSPACE_TAB_PANEL_ID,
  tabs,
  activeTabId,
  focusTabId,
  tabRefs,
  onActivate,
  onClose,
  onTogglePin,
  onFocus,
  onKeyDown
}: WorkspaceTabBarProps): React.JSX.Element | null {
  const localRefs = useRef(new Map<number, HTMLButtonElement>())
  const strip = useRef<HTMLDivElement>(null)
  const refs = tabRefs ?? localRefs
  const [localFocusId, setLocalFocusId] = useState<number | null>(activeTabId)
  const requestedFocus = focusTabId ?? localFocusId
  const focusedId = tabs.some(tab => tab.id === requestedFocus) ? requestedFocus : activeTabId
  const focus = (id: number): void => {
    setLocalFocusId(id)
    onFocus?.(id)
    refs.current.get(id)?.focus()
  }
  useLayoutEffect(() => {
    const reveal = (): void => refs.current.get(activeTabId ?? -1)?.parentElement?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    reveal()
    if (typeof ResizeObserver === 'undefined' || !strip.current) return
    const observer = new ResizeObserver(reveal)
    observer.observe(strip.current)
    return () => observer.disconnect()
  }, [activeTabId, refs, tabs.length])
  const labelFor = (tab: WorkspaceTab): string => {
    const label = workspaceTabLabel(tab)
    if (!('path' in tab)) return label
    const paths = new Set((peerTabs ?? tabs).filter(item => 'path' in item && workspaceTabLabel(item).toLocaleLowerCase() === label.toLocaleLowerCase())
      .map(item => 'path' in item ? item.path.toLocaleLowerCase() : ''))
    const parent = tab.path.slice(0, tab.path.lastIndexOf('/'))
    return paths.size > 1 ? `${label} · ${tab.path.includes('/') ? parent : 'Vault直下'}` : label
  }
  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="workspace-tabs-shell">
    <div ref={strip} className="workspace-tabs" role="tablist" aria-label="開いているタブ">
      {tabs.map((tab) => {
        const label = labelFor(tab)
        const pinned = tab.kind === 'note' && tab.pinned === true
        const pinLabel = pinned ? `${label}の固定を解除` : `${label}を固定`
        return (
          <div className={`workspace-tab${tab.id === activeTabId ? ' is-selected' : ''}`} key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`${idPrefix}${workspaceTabDomId(tab.id)}`}
              ref={(element) => {
                if (element) refs.current.set(tab.id, element)
                else refs.current.delete(tab.id)
              }}
              aria-controls={panelId}
              aria-selected={tab.id === activeTabId}
              aria-label={pinned ? `${label}（固定）` : label}
              title={'path' in tab ? `${workspaceTabLabel(tab)}\n${tab.path}${pinned ? '\n固定' : ''}` : label}
              tabIndex={tab.id === focusedId ? 0 : -1}
              className={tab.id === activeTabId ? 'is-active' : ''}
              onClick={() => onActivate(tab)}
              onFocus={() => { setLocalFocusId(tab.id); onFocus?.(tab.id) }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return
                const index = tabs.findIndex(item => item.id === tab.id)
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault()
                  focus(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].id)
                } else if (event.key === 'Delete') { event.preventDefault(); onClose(tab.id) }
                else if (onKeyDown) onKeyDown(event, tab)
                else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onActivate(tab) }
              }}
            >
              {pinned && <span aria-hidden="true">📌 </span>}{label}
            </button>
            {tab.kind === 'note' && onTogglePin && <button type="button" className="workspace-tab-pin"
              aria-label={pinLabel} title={pinLabel} aria-pressed={pinned}
              tabIndex={tab.id === focusedId ? 0 : -1} onClick={() => onTogglePin(tab.id)}>
              <Icon name="pin" size={14} />
            </button>}
            <button
              type="button"
              className="workspace-tab-close"
              aria-label={`${label}を閉じる`}
              tabIndex={tab.id === focusedId ? 0 : -1}
              onClick={() => onClose(tab.id)}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
    <PaneActionsMenu label="開いているタブの一覧" triggerClassName="tabs-list-trigger" menuClassName="workspace-tabs-menu" symbol="▾"
      actions={tabs.map((tab, index) => ({ label: `${index + 1}. ${labelFor(tab)}${tab.kind === 'note' && tab.pinned ? '（固定）' : ''}`, detail: 'path' in tab ? tab.path : undefined,
        selected: tab.id === activeTabId, onSelect: () => onActivate(tab) }))} />
    </div>
  )
}
