import type { KeyboardEvent, RefObject } from 'react'
import {
  basenameRelative,
  withoutMarkdownExtension
} from '../../core/paths'

export type WorkspaceTab =
  | {
      id: number
      kind: 'note' | 'attachment'
      path: string
    }
  | {
      id: number
      kind: 'linked-view'
      path: string
    }
  | {
      id: number
      kind: 'global-graph'
    }
  | {
      id: number
      kind: 'observatory'
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
  if (tab.kind === 'observatory') {
    return '観測宙域'
  }
  if (tab.kind === 'linked-view') {
    return `${withoutFileExtension(tab.path)} へのバックリンク`
  }
  return tab.kind === 'note'
    ? withoutMarkdownExtension(basenameRelative(tab.path))
    : basenameRelative(tab.path)
}

type WorkspaceTabBarProps = {
  tabs: WorkspaceTab[]
  activeTabId: number | null
  focusTabId: number | null
  tabRefs: RefObject<Map<number, HTMLButtonElement>>
  onActivate: (tab: WorkspaceTab) => void
  onClose: (tabId: number) => void
  onFocus: (tabId: number) => void
  onKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: WorkspaceTab
  ) => void
}

export default function WorkspaceTabBar({
  tabs,
  activeTabId,
  focusTabId,
  tabRefs,
  onActivate,
  onClose,
  onFocus,
  onKeyDown
}: WorkspaceTabBarProps): React.JSX.Element | null {
  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="workspace-tabs" role="tablist" aria-label="開いているタブ">
      {tabs.map((tab) => {
        const label = workspaceTabLabel(tab)
        return (
          <div className="workspace-tab" key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={workspaceTabDomId(tab.id)}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element)
                else tabRefs.current.delete(tab.id)
              }}
              aria-controls={WORKSPACE_TAB_PANEL_ID}
              aria-selected={tab.id === activeTabId}
              aria-label={label}
              title={label}
              tabIndex={tab.id === focusTabId ? 0 : -1}
              className={tab.id === activeTabId ? 'is-active' : ''}
              onClick={() => onActivate(tab)}
              onFocus={() => onFocus(tab.id)}
              onKeyDown={(event) => onKeyDown(event, tab)}
            >
              {label}
            </button>
            <button
              type="button"
              className="workspace-tab-close"
              aria-label={`${label}を閉じる`}
              tabIndex={-1}
              onClick={() => onClose(tab.id)}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
