import { readFileSync } from 'node:fs'
// @ts-expect-error jsdom is a Vitest runtime dependency without bundled declarations.
import { JSDOM } from 'jsdom'
import moment from 'moment'
import { afterEach, describe, expect, it, vi } from 'vitest'

const source = readFileSync('src/main/calendar-plugin-host-bootstrap.js', 'utf8')
const openWindows: JSDOM[] = []

function timestamp(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12).getTime()
}

function mountCalendarHost(weekStart: 'locale' | 'monday' = 'locale') {
  const dom = new JSDOM(
    '<!doctype html><html data-calendar-session="activity-test"><body><main id="calendar-plugin-host"></main></body></html>',
    { runScripts: 'outside-only', url: 'tsuzune-calendar://host/?session=activity-test' }
  )
  openWindows.push(dom)
  const { window } = dom
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    }
  })
  const sessionStorage = new Map<string, string>()
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key: string) => sessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) => sessionStorage.set(key, String(value)),
      removeItem: (key: string) => sessionStorage.delete(key),
      clear: () => sessionStorage.clear()
    }
  })
  ;(window as unknown as { moment: typeof moment }).moment = moment
  const postMessage = vi.spyOn(window.parent, 'postMessage')
  window.eval(source)

  const view = window.document.querySelector('.view-content')!
  const displayedMonth = moment([2026, 7, 1]).startOf('month')
  const start = displayedMonth.clone().startOf(weekStart === 'monday' ? 'isoWeek' : 'week')
  view.innerHTML = [
    '<div class="title"><span class="month">Aug</span><span class="year">2026</span></div>',
    '<div class="calendar-grid">',
    ...Array.from({ length: 42 }, (_, index) => {
      const date = start.clone().add(index, 'days')
      const adjacent = date.isSame(displayedMonth, 'month') ? '' : ' adjacent-month'
      return `<div class="day${adjacent}">${date.format('D')}<div class="dot-container"></div></div>`
    }),
    '</div>'
  ].join('')

  const message = new window.MessageEvent('message', {
    data: {
      channel: 'tsuzune-calendar',
      session: 'activity-test',
      type: 'init',
      payload: {
        snapshot: {
          directories: [],
          notes: [
            { path: '10_プロジェクト/Created.md', name: 'Created', content: '', createdAt: timestamp(2026, 8, 17), modifiedAt: timestamp(2026, 8, 17), size: 1 },
            { path: '30_知識/Updated.md', name: 'Updated', content: '', createdAt: timestamp(2026, 8, 10), modifiedAt: timestamp(2026, 8, 17), size: 1 },
            { path: '01_受信箱/Unknown-created.md', name: 'Unknown-created', content: '', createdAt: null, modifiedAt: timestamp(2026, 8, 17), size: 1 },
            { path: '50_履歴/AI更新/Hidden.md', name: 'Hidden', content: '', createdAt: timestamp(2026, 8, 17), modifiedAt: timestamp(2026, 8, 17), size: 1 },
            { path: '30_知識/Old.md', name: 'Old', content: '', createdAt: timestamp(2026, 8, 1), modifiedAt: timestamp(2026, 8, 2), size: 1 }
          ]
        },
        settings: {},
        selectedPath: null,
        daily: { format: 'YYYY-MM-DD', folder: '02_デイリー', template: '' }
      }
    }
  })
  Object.defineProperty(message, 'source', { value: window.parent })
  window.dispatchEvent(message)
  return { dom, window, postMessage }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  for (const dom of openWindows.splice(0)) dom.window.close()
  vi.restoreAllMocks()
})

describe('Calendar note activity extension', () => {
  it('marks creation and last-update activity without exposing audit history', async () => {
    moment.locale('en')
    const { window } = mountCalendarHost()
    await settle()

    const day = window.document.querySelector<HTMLElement>('.day[data-tsuzune-date="2026-08-17"]')
    const trigger = day?.querySelector<HTMLButtonElement>('.tsuzune-note-activity-trigger')
    expect(trigger?.getAttribute('aria-label')).toBe('8月17日: 作成1件、最終更新3件')
    expect(trigger?.dataset.createdCount).toBe('1')
    expect(trigger?.dataset.modifiedCount).toBe('3')
    const legend = window.document.querySelector<HTMLElement>('.tsuzune-note-activity-legend')
    expect(legend?.textContent).toContain('作成')
    expect(legend?.textContent).toContain('更新')
    expect(legend?.textContent).toContain('印を押すと一覧')
    expect(legend?.title).toContain('日付の印をクリックするとノート一覧')
    expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger?.getAttribute('title')).toContain('ノート活動')
    expect(window.document.querySelector('.day[data-tsuzune-date="2026-08-03"] .tsuzune-note-activity-trigger')).toBeNull()
  })

  it('opens an accessible note list, uses the existing open bridge, and dismisses outside', async () => {
    moment.locale('en')
    const { window, postMessage } = mountCalendarHost()
    await settle()
    postMessage.mockClear()

    const trigger = window.document.querySelector<HTMLButtonElement>(
      '.day[data-tsuzune-date="2026-08-17"] .tsuzune-note-activity-trigger'
    )!
    trigger.click()

    const dialog = window.document.querySelector<HTMLElement>('[role="dialog"][aria-label="2026年8月17日のノート活動"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('作成 1')
    expect(dialog?.textContent).toContain('最終更新 3')
    expect(dialog?.textContent).toContain('Created')
    expect(dialog?.textContent).toContain('Updated')
    expect(dialog?.textContent).toContain('Unknown-created')
    expect(dialog?.textContent).not.toContain('Hidden')

    dialog?.querySelector<HTMLButtonElement>('button[data-note-path="30_知識/Updated.md"]')?.click()
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'tsuzune-calendar',
        type: 'request',
        payload: expect.objectContaining({ action: 'open-note', payload: { path: '30_知識/Updated.md', newSplit: false } })
      }),
      '*'
    )

    trigger.click()
    expect(window.document.querySelector('[role="dialog"]')).not.toBeNull()
    window.document.body.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
    expect(window.document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes the note list when calendar navigation removes its date trigger', async () => {
    moment.locale('en')
    const { window } = mountCalendarHost()
    await settle()

    window.document.querySelector<HTMLButtonElement>(
      '.day[data-tsuzune-date="2026-08-17"] .tsuzune-note-activity-trigger'
    )!.click()
    expect(window.document.querySelector('[role="dialog"]')).not.toBeNull()

    window.document.querySelector('.title .month')!.textContent = 'Sep'
    const start = moment([2026, 8, 1]).startOf('month').startOf('week')
    window.document.querySelector('.calendar-grid')!.innerHTML = Array.from({ length: 42 }, (_, index) =>
      `<div class="day">${start.clone().add(index, 'days').format('D')}<div class="dot-container"></div></div>`
    ).join('')
    await settle()

    expect(window.document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('refreshes the note list when activity changes without changing its counts', async () => {
    moment.locale('en')
    const { window } = mountCalendarHost()
    await settle()

    const originalTrigger = window.document.querySelector<HTMLButtonElement>(
      '.day[data-tsuzune-date="2026-08-17"] .tsuzune-note-activity-trigger'
    )!
    originalTrigger.click()
    expect(window.document.querySelector('[role="dialog"]')?.textContent).toContain('Updated')

    const message = new window.MessageEvent('message', {
      data: {
        channel: 'tsuzune-calendar',
        session: 'activity-test',
        type: 'snapshot',
        payload: {
          snapshot: {
            directories: [],
            notes: [
              { path: '10_プロジェクト/Created.md', name: 'Created', content: '', createdAt: timestamp(2026, 8, 17), modifiedAt: timestamp(2026, 8, 17), size: 1 },
              { path: '30_知識/Replaced.md', name: 'Replaced', content: '', createdAt: timestamp(2026, 8, 10), modifiedAt: timestamp(2026, 8, 17), size: 1 },
              { path: '01_受信箱/Unknown-created.md', name: 'Unknown-created', content: '', createdAt: null, modifiedAt: timestamp(2026, 8, 17), size: 1 },
              { path: '50_履歴/AI更新/Hidden.md', name: 'Hidden', content: '', createdAt: timestamp(2026, 8, 17), modifiedAt: timestamp(2026, 8, 17), size: 1 }
            ]
          }
        }
      }
    })
    Object.defineProperty(message, 'source', { value: window.parent })
    window.dispatchEvent(message)
    await settle()

    const refreshedTrigger = window.document.querySelector<HTMLButtonElement>(
      '.day[data-tsuzune-date="2026-08-17"] .tsuzune-note-activity-trigger'
    )!
    expect(refreshedTrigger).not.toBe(originalTrigger)
    expect(window.document.querySelector('[role="dialog"]')).toBeNull()
    refreshedTrigger.click()
    expect(window.document.querySelector('[role="dialog"]')?.textContent).toContain('Replaced')
    expect(window.document.querySelector('[role="dialog"]')?.textContent).not.toContain('Updated')
  })

  it('maps activity to the rendered date when the calendar starts weeks on Monday', async () => {
    moment.locale('ja')
    const { window } = mountCalendarHost('monday')
    await settle()

    const activityDay = window.document.querySelector(
      '.day[data-tsuzune-date="2026-08-17"]:has(.tsuzune-note-activity-trigger)'
    )
    expect(activityDay).not.toBeNull()
    expect(activityDay?.firstChild?.textContent).toBe('17')
    expect(
      window.document.querySelector('.day[data-tsuzune-date="2026-08-18"] .tsuzune-note-activity-trigger')
    ).toBeNull()
  })
})
