export function cycleDialogTab(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  focusable: ArrayLike<HTMLElement> | null | undefined
): void {
  if (event.key !== 'Tab' || !focusable?.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
