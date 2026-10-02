import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PaneAction {
  label: string
  disabled?: boolean
  onSelect: () => void
  selected?: boolean
  detail?: string
}

export default function PaneActionsMenu({ actions, label = 'ペイン操作', triggerClassName = 'pane-menu-trigger', menuClassName = '', symbol = '…' }: {
  actions: PaneAction[]; label?: string; triggerClassName?: string; menuClassName?: string; symbol?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const close = (restoreFocus = false): void => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return
    const rect = trigger.current.getBoundingClientRect()
    const size = menu.current.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(rect.right - size.width, window.innerWidth - size.width - 8)),
      top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - size.height - 8)) })
    menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) close()
    }
    const resize = (): void => close()
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', resize)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', resize) }
  }, [open])
  return <>
    <button ref={trigger} type="button" className={triggerClassName} aria-label={label}
      title={label} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(!open)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
      }}>{symbol}</button>
    {open && createPortal(<div ref={menu} className={`pane-menu ${menuClassName}`} role="menu" aria-label={label}
      style={{ top: position.top, left: position.left }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close() }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
        if (event.key === 'Enter' || event.key === ' ') {
          const item = event.target
          if (item instanceof HTMLButtonElement && !item.disabled) { event.preventDefault(); item.click() }
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }}>
      {actions.map(action => <button key={action.label} type="button" role={action.selected === undefined ? 'menuitem' : 'menuitemradio'}
        aria-checked={action.selected} className={action.selected ? 'is-selected' : undefined} disabled={action.disabled}
        title={action.detail} onClick={() => { close(true); action.onSelect() }}>
        <span>{action.label}</span>{action.detail && <span className="menu-item-detail">{action.detail}</span>}
      </button>)}
    </div>, document.body)}
  </>
}
