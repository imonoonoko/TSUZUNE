(function activateTsuzuneCalendar() {
  'use strict'
  Promise.resolve(window.__tsuzuneCalendarHost.activate(window.module?.exports)).catch((error) => {
    window.parent.postMessage({
      channel: 'tsuzune-calendar',
      session: document.documentElement.dataset.calendarSession || '',
      type: 'error',
      payload: { message: error instanceof Error ? error.message : String(error) }
    }, '*')
  })
})()
