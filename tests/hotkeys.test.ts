import { describe, expect, it } from 'vitest'
import { ariaKeyshortcuts, DEFAULT_HOTKEYS, matchHotkey, parseHotkeySettings, type HotkeyBinding } from '../src/shared/hotkeys'

const chord = (key: string, modifiers: Partial<HotkeyBinding> = {}): HotkeyBinding => ({ command: 'open-note', key, ctrl: false, meta: false, alt: false, shift: false, ...modifiers })
const event = (key: string, modifiers: Record<string, unknown> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, keyCode: 0, ...modifiers }) as KeyboardEvent

describe('hotkey settings', () => {
  it('loads defaults for older settings and validates configured bindings as a whole', () => {
    expect(parseHotkeySettings(undefined)).toEqual(DEFAULT_HOTKEYS)
    expect(parseHotkeySettings(null)).toEqual(DEFAULT_HOTKEYS)
    expect(() => parseHotkeySettings([...DEFAULT_HOTKEYS, chord('o', { ctrl: true })])).toThrow(/同じキー/)
    expect(() => parseHotkeySettings([chord('c', { ctrl: true })])).toThrow(/予約済み/)
    expect(() => parseHotkeySettings([chord('q')])).toThrow(/予約済み/)
    expect(() => parseHotkeySettings([chord('q', { shift: true })])).toThrow(/予約済み/)
    expect(() => parseHotkeySettings([chord('ArrowUp', { shift: true })])).toThrow(/予約済み/)
    expect(() => parseHotkeySettings([chord('Shift', { ctrl: true })])).toThrow(/使用できない/)
    expect(() => parseHotkeySettings([chord('l', { meta: true })])).toThrow(/予約済み/)
    expect(() => parseHotkeySettings([{ ...chord('q', { ctrl: true }), ctrl: 'yes' }])).toThrow(/形式/)
    expect(parseHotkeySettings([chord('o', { meta: true })])).toHaveLength(1)
  })

  it('matches exact chords and ignores repeated or composing events', () => {
    expect(matchHotkey(event('o', { ctrlKey: true }), DEFAULT_HOTKEYS)).toBe('open-note')
    expect(matchHotkey(event('f', { ctrlKey: true, shiftKey: true }), DEFAULT_HOTKEYS)).toBe('search')
    expect(matchHotkey(event('o', { ctrlKey: true, repeat: true }), DEFAULT_HOTKEYS)).toBeUndefined()
    expect(matchHotkey(event('o', { ctrlKey: true, isComposing: true }), DEFAULT_HOTKEYS)).toBeUndefined()
    expect(matchHotkey(event('o', { ctrlKey: true, keyCode: 229 }), DEFAULT_HOTKEYS)).toBeUndefined()
    expect(matchHotkey(event('o', { ctrlKey: true, shiftKey: true }), DEFAULT_HOTKEYS)).toBeUndefined()
  })

  it('supports unassignment, command replacement, restored defaults, and accessible shortcut names', () => {
    const saved = parseHotkeySettings(DEFAULT_HOTKEYS.filter((item) => item.command !== 'save'))
    expect(saved.some((item) => item.command === 'save')).toBe(false)
    expect(matchHotkey(event('s', { ctrlKey: true }), saved)).toBeUndefined()
    const restarted = parseHotkeySettings(saved)
    expect(restarted).toEqual(saved)
    expect(parseHotkeySettings(DEFAULT_HOTKEYS)).toEqual(DEFAULT_HOTKEYS)
    expect(ariaKeyshortcuts(DEFAULT_HOTKEYS[0])).toBe('Control+O')
  })
})
