import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CALENDAR_PLUGIN_SETTINGS,
  parseCalendarPluginSettings
} from '../src/shared/calendar-plugin-settings'

describe('Calendar 1.5.10 settings contract', () => {
  it('uses the upstream defaults', () => {
    expect(DEFAULT_CALENDAR_PLUGIN_SETTINGS).toEqual({
      shouldConfirmBeforeCreate: true,
      weekStart: 'locale',
      wordsPerDot: 250,
      showWeeklyNote: false,
      weeklyNoteFormat: '',
      weeklyNoteTemplate: '',
      weeklyNoteFolder: '',
      localeOverride: 'system-default'
    })
  })

  it('accepts every upstream week-start value and preserves strings verbatim', () => {
    expect(parseCalendarPluginSettings({
      weekStart: 'saturday',
      weeklyNoteFormat: ' YYYY-[W]WW ',
      weeklyNoteTemplate: '  template  ',
      weeklyNoteFolder: '  notes  ',
      localeOverride: ' ja '
    })).toMatchObject({
      weekStart: 'saturday',
      weeklyNoteFormat: ' YYYY-[W]WW ',
      weeklyNoteTemplate: '  template  ',
      weeklyNoteFolder: '  notes  ',
      localeOverride: ' ja '
    })
    for (const weekStart of ['locale', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
      expect(parseCalendarPluginSettings({ weekStart }).weekStart).toBe(weekStart)
    }
  })

  it('normalizes words per dot to a finite non-negative integer', () => {
    expect(parseCalendarPluginSettings({ wordsPerDot: 0 }).wordsPerDot).toBe(0)
    expect(parseCalendarPluginSettings({ wordsPerDot: 12.9 }).wordsPerDot).toBe(250)
    expect(parseCalendarPluginSettings({ wordsPerDot: -1 }).wordsPerDot).toBe(250)
    expect(parseCalendarPluginSettings({ wordsPerDot: Number.NaN }).wordsPerDot).toBe(250)
    expect(parseCalendarPluginSettings({ wordsPerDot: Number.POSITIVE_INFINITY }).wordsPerDot).toBe(250)
  })

  it('fails safe for wrong types, partial settings, unknown fields, and polluted prototypes', () => {
    const polluted = JSON.parse('{"__proto__":{"wordsPerDot":0},"showWeeklyNote":"yes"}')
    expect(parseCalendarPluginSettings(polluted)).toEqual(DEFAULT_CALENDAR_PLUGIN_SETTINGS)
    expect(parseCalendarPluginSettings({ weekStart: 'nonsense', wordsPerDot: '250' })).toEqual({
      ...DEFAULT_CALENDAR_PLUGIN_SETTINGS
    })
    expect(parseCalendarPluginSettings({ shouldConfirmBeforeCreate: false, unknown: true })).toEqual({
      ...DEFAULT_CALENDAR_PLUGIN_SETTINGS,
      shouldConfirmBeforeCreate: false
    })
    expect(parseCalendarPluginSettings(null)).toEqual(DEFAULT_CALENDAR_PLUGIN_SETTINGS)
  })
})
