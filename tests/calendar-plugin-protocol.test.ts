import { describe, expect, it } from 'vitest'
import { planCalendarPluginRoute } from '../src/main/calendar-plugin-protocol'

const assets = { html: (session: string) => `<html data-session="${session}"></html>`, bootstrap: 'boot', commonjs: 'common', activate: 'activate', moment: 'moment' }

describe('Calendar plugin protocol route planner', () => {
  it('serves the session-bound HTML and static scripts with no-store headers', async () => {
    const html = await planCalendarPluginRoute('tsuzune-calendar://host/?session=abc_1', 'C:/missing', assets)
    expect(html.status).toBe(200)
    expect(html.body).toContain('abc_1')
    expect(html.headers['Cache-Control']).toBe('no-store')
    expect((await planCalendarPluginRoute('tsuzune-calendar://host/bootstrap.js', 'C:/missing', assets)).body).toBe('boot')
  })

  it('rejects injection, missing sessions, other hosts, methods represented by route absence, and unknown routes', async () => {
    expect((await planCalendarPluginRoute('tsuzune-calendar://host/?session=%22%20onload%3D1', 'C:/missing', assets)).status).toBe(400)
    expect((await planCalendarPluginRoute('tsuzune-calendar://host/', 'C:/missing', assets)).status).toBe(400)
    expect((await planCalendarPluginRoute('tsuzune-calendar://other/?session=x', 'C:/missing', assets)).status).toBe(404)
    expect((await planCalendarPluginRoute('tsuzune-calendar://host/?session=x', 'C:/missing', assets, 'POST')).status).toBe(405)
    expect((await planCalendarPluginRoute('tsuzune-calendar://host/nope?session=x', 'C:/missing', assets)).status).toBe(404)
  })

  it('never serves main.js when the pinned artifact cannot be verified', async () => {
    const main = await planCalendarPluginRoute('tsuzune-calendar://host/main.js', 'C:/missing', assets)
    expect(main.status).toBe(404)
    expect(main.body).toBeUndefined()
  })

  it('uses JavaScript nosniff and immutable content types for scripts', async () => {
    const route = await planCalendarPluginRoute('tsuzune-calendar://host/moment.js', 'C:/missing', assets)
    expect(route.headers['Content-Type']).toContain('javascript')
    expect(route.headers['X-Content-Type-Options']).toBe('nosniff')
  })
})
