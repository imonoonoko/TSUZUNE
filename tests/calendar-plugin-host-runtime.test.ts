import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/main/calendar-plugin-host-bootstrap.js', 'utf8')

describe('Calendar isolated host runtime boundaries', () => {
  it('keeps the mounted Calendar view when the active file changes', () => {
    expect(source).toContain('this.activeFile = null')
    expect(source).toContain('this.activeFile = file instanceof TFile ? file : null')
    expect(source).toContain('this.activeLeaf.view.file = this.activeFile')
    expect(source).toContain('getActiveFile()')
    expect(source).toContain('// Keep the mounted Calendar ItemView in place')
    expect(source).not.toMatch(/setActiveFile\(file\) \{[\s\S]*?this\.activeLeaf = leaf/)
  })

  it('exposes live daily-note options after parent init updates state', () => {
    expect(source).toContain("get options() { return state.daily }")
    expect(source).toContain('state.daily = { ...state.daily, ...(message.payload?.daily || {}) }')
    expect(source).not.toContain("instance: { options: state.daily }")
  })

  it('rejects pending bridge requests when the host unloads', () => {
    expect(source).toContain("reject(new Error('Calendar host was unloaded'))")
    expect(source).toContain('pendingRequests.clear()')
  })

  it('does not echo unchanged settings between the parent and upstream plugin', () => {
    expect(source).toContain('function sameSettings(left, right)')
    expect(source).toMatch(
      /async saveData\(settings\) \{[\s\S]*?const nextSettings =[\s\S]*?if \(sameSettings\(nextSettings, state\.settings\)\) return[\s\S]*?request\('save-settings'/
    )
    expect(source).toMatch(
      /if \(message\.type === 'settings'\) \{[\s\S]*?const nextSettings =[\s\S]*?if \(sameSettings\(nextSettings, state\.settings\)\) return[\s\S]*?pluginInstance\.loadOptions\(\)/
    )
  })
})
