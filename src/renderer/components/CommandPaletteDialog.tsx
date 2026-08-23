import React, { useEffect, useMemo, useRef, useState } from 'react'

export interface CommandPaletteCommand {
  id: string
  label: string
  keywords: string[]
  shortcut?: string
  state?: string
  disabledReason?: string
}

export interface CommandPaletteDialogProps {
  commands: CommandPaletteCommand[]
  onExecute: (id: string) => void
  onClose: () => void
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase()
}

function optionId(id: string): string {
  return `command-palette-option-${encodeURIComponent(id)}`
}

export default function CommandPaletteDialog({
  commands,
  onExecute,
  onClose
}: CommandPaletteDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean)
    return commands
      .filter((command) => {
        if (tokens.length === 0) return true
        const haystack = normalize([command.label, ...command.keywords, command.shortcut ?? ''].join(' '))
        return tokens.every((token) => haystack.includes(token))
      })
      .slice(0, 50)
  }, [commands, query])

  const activeCommand = results[selectedIndex]
  const activeId = activeCommand ? optionId(activeCommand.id) : undefined

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(Math.max(0, results.length - 1))
  }, [results.length, selectedIndex])

  useEffect(() => {
    if (!activeId) return
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  const execute = (command: CommandPaletteCommand | undefined) => {
    if (!command || command.disabledReason) return
    onExecute(command.id)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (results.length) setSelectedIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length) setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      if (results.length) setSelectedIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      if (results.length) setSelectedIndex(results.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      execute(activeCommand)
    }
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
    if (!focusable?.length) return
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

  return (
    <div className="modal-backdrop command-palette-backdrop">
      <section
        ref={dialogRef}
        className="modal command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="command-palette-title" className="command-palette-title">操作を実行</h2>
        <input
          ref={inputRef}
          className="command-palette-input"
          type="search"
          role="combobox"
          aria-label="コマンドを検索"
          aria-controls="command-palette-list"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          value={query}
          placeholder="コマンドを検索"
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        <div ref={listRef} id="command-palette-list" className="command-palette-list" role="listbox" aria-label="コマンド候補">
          {results.map((command, index) => (
            <div
              key={command.id}
              id={optionId(command.id)}
              className={`command-palette-option${index === selectedIndex ? ' is-selected' : ''}`}
              role="option"
              tabIndex={-1}
              data-command-id={command.id}
              aria-selected={index === selectedIndex}
              aria-disabled={command.disabledReason ? 'true' : undefined}
              title={command.disabledReason ? `利用不可: ${command.disabledReason}` : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => execute(command)}
            >
              <span className="command-palette-option-label">{command.label}</span>
              {command.shortcut && <span className="command-palette-option-shortcut">{command.shortcut}</span>}
              {command.state && <span className="command-palette-option-state">現在: {command.state}</span>}
              {command.disabledReason && <span className="command-palette-option-disabled">利用不可: {command.disabledReason}</span>}
            </div>
          ))}
          {results.length === 0 && <div className="command-palette-empty" role="status">一致するコマンドはありません</div>}
        </div>
      </section>
    </div>
  )
}
