export type HotkeyCommandId =
  | 'open-note'
  | 'command-palette'
  | 'search'
  | 'save'
  | 'next-tab'
  | 'previous-tab'
  | 'close-tab'
  | `tab-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`

export interface HotkeyBinding {
  command: HotkeyCommandId
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

export type HotkeySettings = HotkeyBinding[]

export const HOTKEY_COMMANDS: { id: HotkeyCommandId; label: string }[] = [
  { id: 'open-note', label: 'ノートを開く' },
  { id: 'command-palette', label: 'コマンドパレット' },
  { id: 'search', label: '検索' },
  { id: 'save', label: '保存' },
  { id: 'next-tab', label: '次のタブ' },
  { id: 'previous-tab', label: '前のタブ' },
  { id: 'close-tab', label: 'タブを閉じる' },
  ...Array.from({ length: 9 }, (_, index) => ({ id: `tab-${index + 1}` as HotkeyCommandId, label: `${index + 1}番目のタブ` }))
]

const binding = (command: HotkeyCommandId, key: string, modifiers: Partial<HotkeyBinding> = {}): HotkeyBinding => ({
  command, key, ctrl: false, meta: false, alt: false, shift: false, ...modifiers
})

export const DEFAULT_HOTKEYS: HotkeySettings = [
  ...(['ctrl', 'meta'] as const).flatMap((modifier) => [
    binding('open-note', 'o', { [modifier]: true }),
    binding('command-palette', 'p', { [modifier]: true }),
    binding('search', 'k', { [modifier]: true })
  ]),
  binding('search', 'f', { ctrl: true, shift: true }),
  binding('search', 'f', { meta: true, shift: true }),
  binding('save', 's', { ctrl: true }),
  binding('next-tab', 'Tab', { ctrl: true }),
  binding('previous-tab', 'Tab', { ctrl: true, shift: true }),
  binding('close-tab', 'w', { ctrl: true }),
  ...Array.from({ length: 9 }, (_, index) => binding(`tab-${index + 1}` as HotkeyCommandId, String(index + 1), { ctrl: true }))
]

const modifierNames = ['ctrl', 'meta', 'alt', 'shift'] as const
const keyName = (key: string) => key.length === 1 ? key.toLowerCase() : key
const signature = (item: HotkeyBinding) => [keyName(item.key), ...modifierNames.filter((name) => item[name])].join('|')

export function normalizeHotkey(binding: HotkeyBinding): HotkeyBinding {
  return { ...binding, key: keyName(binding.key), ctrl: !!binding.ctrl, meta: !!binding.meta, alt: !!binding.alt, shift: !!binding.shift }
}

export function parseHotkeySettings(value: unknown): HotkeySettings {
  if (value === undefined || value === null) return DEFAULT_HOTKEYS.map((item) => ({ ...item }))
  if (!Array.isArray(value)) throw new Error('ホットキー設定の形式が正しくありません')
  const parsed: HotkeySettings = value.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.command !== 'string' || typeof item.key !== 'string' || !HOTKEY_COMMANDS.some((command) => command.id === item.command) || !item.key) throw new Error('ホットキー設定の形式が正しくありません')
    if (modifierNames.some((name) => item[name] !== undefined && typeof item[name] !== 'boolean')) throw new Error('ホットキー設定の形式が正しくありません')
    const candidate = normalizeHotkey(item as HotkeyBinding)
    if (candidate.key === 'Dead' || candidate.key === 'Process' || candidate.key === 'Unidentified' || ['Shift', 'Control', 'Alt', 'Meta', 'OS', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'Compose', 'KanaMode', 'HangulMode', 'HanjaMode', 'Convert', 'NonConvert', 'ModeChange'].includes(candidate.key) || candidate.key.length > 1 && !['Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Space'].includes(candidate.key)) throw new Error('使用できないキーです')
    return candidate
  })
  const chords = new Set<string>()
  for (const item of parsed) {
    const chord = signature(item)
    if (chords.has(chord)) throw new Error('同じキーが複数の操作に割り当てられています')
    chords.add(chord)
    const lowerKey = item.key.toLowerCase()
    const supportedMetaChord = item.command === 'open-note' && lowerKey === 'o' || item.command === 'command-palette' && lowerKey === 'p' || item.command === 'search' && (lowerKey === 'k' || lowerKey === 'f' && item.shift)
    if ((!item.ctrl && !item.meta && !item.alt && item.key.length === 1) || (!item.ctrl && !item.meta && !item.alt && ['Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(item.key)) || item.key === 'F4' && item.alt || item.key === 'Delete' && item.ctrl && item.alt || item.key === 'Escape' && item.alt || (item.ctrl || item.meta) && ['c', 'x', 'v', 'z', 'y', 'a'].includes(lowerKey) || item.meta && ['l', 'e', 'r', 'd', 'tab', 'm', 'i', 'f', 's', 'x', 'b', 'u', 'n', 'w', 'a', 'v'].includes(lowerKey) && !supportedMetaChord) throw new Error('そのキーの組み合わせは予約済みです')
  }
  return parsed
}

export function matchHotkey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'keyCode'>, settings: HotkeySettings): HotkeyCommandId | undefined {
  if (event.repeat || event.isComposing || event.keyCode === 229) return undefined
  return settings.find((item) => keyName(event.key) === item.key && !!event.ctrlKey === item.ctrl && !!event.metaKey === item.meta && !!event.altKey === item.alt && !!event.shiftKey === item.shift)?.command
}

export function hotkeyLabel(item: HotkeyBinding): string {
  const parts = [item.ctrl && 'Ctrl', item.meta && 'Meta', item.alt && 'Alt', item.shift && 'Shift', item.key.length === 1 ? item.key.toUpperCase() : item.key].filter(Boolean)
  return parts.join('+')
}

export function ariaKeyshortcuts(item: HotkeyBinding): string {
  const parts = [item.ctrl && 'Control', item.meta && 'Meta', item.alt && 'Alt', item.shift && 'Shift', item.key === ' ' ? 'Space' : item.key.length === 1 ? item.key.toUpperCase() : item.key]
  return parts.filter(Boolean).join('+')
}
