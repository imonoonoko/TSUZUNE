export const CALENDAR_WEEK_STARTS = [
  'locale',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const

export type CalendarWeekStart = (typeof CALENDAR_WEEK_STARTS)[number]

export interface CalendarPluginSettings {
  shouldConfirmBeforeCreate: boolean
  weekStart: CalendarWeekStart
  wordsPerDot: number
  showWeeklyNote: boolean
  weeklyNoteFormat: string
  weeklyNoteTemplate: string
  weeklyNoteFolder: string
  localeOverride: string
}

export const DEFAULT_CALENDAR_PLUGIN_SETTINGS: CalendarPluginSettings = {
  shouldConfirmBeforeCreate: true,
  weekStart: 'locale',
  wordsPerDot: 250,
  showWeeklyNote: false,
  weeklyNoteFormat: '',
  weeklyNoteTemplate: '',
  weeklyNoteFolder: '',
  localeOverride: 'system-default'
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

export function parseCalendarPluginSettings(value: unknown): CalendarPluginSettings {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_CALENDAR_PLUGIN_SETTINGS }
  }

  const input = value as Record<string, unknown>
  const next = { ...DEFAULT_CALENDAR_PLUGIN_SETTINGS }

  if (hasOwn(input, 'shouldConfirmBeforeCreate') && typeof input.shouldConfirmBeforeCreate === 'boolean') {
    next.shouldConfirmBeforeCreate = input.shouldConfirmBeforeCreate
  }
  if (hasOwn(input, 'weekStart') && typeof input.weekStart === 'string' &&
      (CALENDAR_WEEK_STARTS as readonly string[]).includes(input.weekStart)) {
    next.weekStart = input.weekStart as CalendarWeekStart
  }
  if (hasOwn(input, 'wordsPerDot') && typeof input.wordsPerDot === 'number' &&
      Number.isFinite(input.wordsPerDot) && Number.isInteger(input.wordsPerDot) && input.wordsPerDot >= 0) {
    next.wordsPerDot = input.wordsPerDot
  }
  for (const key of ['weeklyNoteFormat', 'weeklyNoteTemplate', 'weeklyNoteFolder', 'localeOverride'] as const) {
    if (hasOwn(input, key) && typeof input[key] === 'string') next[key] = input[key]
  }
  if (hasOwn(input, 'showWeeklyNote') && typeof input.showWeeklyNote === 'boolean') {
    next.showWeeklyNote = input.showWeeklyNote
  }
  return next
}
