import { describe, expect, it } from 'vitest'
import { createCalendarPluginHostHtml } from '../src/main/calendar-plugin-host-page'

describe('Calendar plugin isolated host page', () => {
  it('returns a strict, isolated document with fixed bootstrap order', () => {
    const html = createCalendarPluginHostHtml('session-123')

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('default-src \'none\'')
    expect(html).toContain("script-src 'self' tsuzune-calendar:")
    expect(html).toContain("style-src 'unsafe-inline'")
    expect(html).toContain("img-src data:")
    expect(html).toMatch(/connect-src 'none'/)
    expect(html).toMatch(/(?:frame|object|base|form)-src 'none'/)
    expect(html).toContain('<script src="tsuzune-calendar://host/bootstrap.js"></script>')
    expect(html).toContain('<script src="tsuzune-calendar://host/moment.js"></script>')
    expect(html).toContain('<script src="tsuzune-calendar://host/commonjs.js"></script>')
    expect(html).toContain('<script src="tsuzune-calendar://host/main.js"></script>')
    expect(html).toContain('<script src="tsuzune-calendar://host/activate.js"></script>')
    expect(html.indexOf('bootstrap.js')).toBeLessThan(html.indexOf('main.js'))
    expect(html.indexOf('moment.js')).toBeLessThan(html.indexOf('main.js'))
    expect(html.indexOf('commonjs.js')).toBeLessThan(html.indexOf('main.js'))
    expect(html.indexOf('main.js')).toBeLessThan(html.indexOf('activate.js'))
    expect(html).toContain('data-calendar-session="session-123"')
    expect(html).toContain('data-calendar-channel="tsuzune-calendar"')
    expect(html).not.toMatch(/<script(?![^>]+src=)[^>]*>/i)
    expect(html).not.toMatch(/(?:https?:|data:)[^"']*\.js/i)
    expect(html).not.toContain('eval(')
  })

  it('escapes session data and does not allow markup injection', () => {
    const html = createCalendarPluginHostHtml('" onload="alert(1) & <script>alert(2)</script>')

    expect(html).not.toContain('onload="alert')
    expect(html).not.toContain('<script>alert(2)</script>')
    expect(html).toContain('&quot;')
    expect(html).toContain('&lt;script&gt;')
  })
})
