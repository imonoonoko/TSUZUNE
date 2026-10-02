import React, { useEffect, useRef } from 'react'

export interface SidebarResizerProps {
  side: 'left' | 'right'
  width: number
  onChange: (width: number) => void
}

const minimumWidth = 120
const maximumWidth = 640
const clampWidth = (width: number): number => Math.min(maximumWidth, Math.max(minimumWidth, Math.round(width)))

export default function SidebarResizer({ side, width, onChange }: SidebarResizerProps): React.JSX.Element {
  const cleanupRef = useRef<(() => void) | null>(null)
  const latest = useRef({ side, width, onChange })
  latest.current = { side, width, onChange }
  useEffect(() => () => cleanupRef.current?.(), [])

  const startDrag = (clientX: number, kind: 'pointer' | 'mouse', pointerId?: number): void => {
    if (cleanupRef.current) return
    const origin = latest.current
    const move = (event: Event): void => {
      if (kind === 'pointer' && (event as PointerEvent).pointerId !== pointerId) return
      const delta = (event as MouseEvent).clientX - clientX
      latest.current.onChange(clampWidth(origin.width + (origin.side === 'left' ? delta : -delta)))
    }
    const finish = (event?: Event): void => {
      if (kind === 'pointer' && event?.type !== 'blur' && event && (event as PointerEvent).pointerId !== pointerId) return
      window.removeEventListener(`${kind}move`, move)
      window.removeEventListener(`${kind}up`, finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
      cleanupRef.current = null
    }
    cleanupRef.current = finish
    window.addEventListener(`${kind}move`, move)
    window.addEventListener(`${kind}up`, finish)
    if (kind === 'pointer') window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish)
  }

  return <div role="separator" tabIndex={0} className={`sidebar-resizer sidebar-resizer-${side}`}
    aria-label={side === 'left' ? '左サイドバーの幅を調整' : '右サイドバーの幅を調整'} aria-orientation="vertical"
    aria-valuemin={minimumWidth} aria-valuemax={maximumWidth} aria-valuenow={Math.round(width)} aria-valuetext={`${Math.round(width)}px`}
    style={{ cursor: 'col-resize', touchAction: 'none' }}
    onPointerDown={(event) => {
      if (event.button !== 0 || event.isPrimary === false) return
      event.preventDefault()
      event.currentTarget.focus()
      startDrag(event.clientX, 'pointer', event.pointerId)
    }}
    onMouseDown={(event) => {
      if (event.button !== 0 || typeof window.PointerEvent === 'function') return
      event.preventDefault()
      event.currentTarget.focus()
      startDrag(event.clientX, 'mouse')
    }}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
      const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
      const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
      let next: number
      if (event.key === 'Home') next = minimumWidth
      else if (event.key === 'End') next = maximumWidth
      else if (event.key === grow || event.key === '+' || event.key === '=') next = width + 16
      else if (event.key === shrink || event.key === '-') next = width - 16
      else return
      event.preventDefault()
      onChange(clampWidth(next))
    }} />
}
