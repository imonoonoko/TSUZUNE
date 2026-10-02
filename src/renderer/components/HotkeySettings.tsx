import { useState } from 'react'
import {
  ariaKeyshortcuts,
  DEFAULT_HOTKEYS,
  HOTKEY_COMMANDS,
  hotkeyLabel,
  normalizeHotkey,
  parseHotkeySettings,
  type HotkeyBinding,
  type HotkeyCommandId,
  type HotkeySettings
} from '../../shared/hotkeys'

interface HotkeySettingsProps {
  value: HotkeySettings
  onChange: (value: HotkeySettings) => void | Promise<void>
  busy?: boolean
}

export default function HotkeySettings({ value, onChange, busy = false }: HotkeySettingsProps) {
  const [capturing, setCapturing] = useState<HotkeyCommandId | null>(null)
  const [error, setError] = useState('')
  const assigned = (command: HotkeyCommandId) => value.filter((item) => item.command === command)

  const commit = async (next: HotkeySettings) => {
    try {
      await onChange(parseHotkeySettings(next))
      setError('')
      setCapturing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ホットキーを保存できませんでした')
    }
  }

  const capture = (event: React.KeyboardEvent, command: HotkeyCommandId) => {
    if (event.key === 'Escape') { event.preventDefault(); setCapturing(null); return }
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    const candidate: HotkeyBinding = normalizeHotkey({ command, key: event.key, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, shift: event.shiftKey })
    const next = [...value.filter((item) => item.command !== command), candidate]
    void awaitCommit(next)
  }

  const awaitCommit = (next: HotkeySettings) => {
    try { return commit(parseHotkeySettings(next)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'そのキーは使用できません'); return Promise.resolve() }
  }

  return <section aria-labelledby="hotkey-settings-title">
    <h3 id="hotkey-settings-title">キーボードショートカット</h3>
    <p>キーをクリックして新しい組み合わせを入力します。Escでキャンセルできます。</p>
    <ul>
      {HOTKEY_COMMANDS.map(({ id, label }) => {
        const shortcuts = assigned(id)
        return <li key={id}>
          <span>{label}</span>
          <button type="button" aria-label={`${label}のキー`} aria-keyshortcuts={shortcuts.length ? shortcuts.map(ariaKeyshortcuts).join(' ') : undefined} disabled={busy} onClick={() => { setError(''); setCapturing(id) }} onKeyDown={capturing === id ? (event) => capture(event, id) : undefined}>
            {capturing === id ? 'キーを入力…' : shortcuts.length ? shortcuts.map(hotkeyLabel).join(' / ') : '未割り当て'}
          </button>
          {shortcuts.length > 0 && <button type="button" aria-label={`${label}の割り当てを解除`} disabled={busy} onClick={() => void commit(value.filter((item) => item.command !== id))}>解除</button>}
        </li>
      })}
    </ul>
    <button type="button" disabled={busy} onClick={() => void commit(DEFAULT_HOTKEYS.map((item) => ({ ...item })))}>既定に戻す</button>
    {error && <p role="alert">{error}</p>}
  </section>
}
