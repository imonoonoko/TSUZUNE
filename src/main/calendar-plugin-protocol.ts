import { createRequire } from 'node:module'
import { protocol } from 'electron'
import { verifyCalendarPluginArtifact } from './calendar-plugin-artifact'

export const CALENDAR_SCHEME = 'tsuzune-calendar'
const HOST = 'host'
let registered = false
let handlerRegistered = false

export type CalendarProtocolRoute = {
  status: number
  headers: Record<string, string>
  body?: string | Uint8Array
}

export type CalendarProtocolAssets = {
  bootstrap?: string
  commonjs?: string
  activate?: string
  moment?: string
  html?: (session: string) => string
}

function headers(contentType: string): Record<string, string> {
  return { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
}
function error(status: number): CalendarProtocolRoute { return { status, headers: headers('text/plain; charset=utf-8') } }
function sessionFrom(url: URL): string | null {
  const value = url.searchParams.get('session')
  return value && /^[A-Za-z0-9._~-]{1,128}$/.test(value) ? value : null
}

export async function planCalendarPluginRoute(requestUrl: string, vaultRoot: string, assets: CalendarProtocolAssets = {}, method = 'GET'): Promise<CalendarProtocolRoute> {
  if (method !== 'GET') return error(405)
  let url: URL
  try { url = new URL(requestUrl) } catch { return error(400) }
  if (url.protocol !== `${CALENDAR_SCHEME}:` || url.hostname !== HOST || url.port !== '' || url.username !== '' || url.password !== '') return error(404)
  if (url.pathname === '/') {
    const session = sessionFrom(url)
    if (!session) return error(400)
    if (!assets.html) return error(404)
    return { status: 200, headers: headers('text/html; charset=utf-8'), body: assets.html(session) }
  }
  const textRoutes: Record<string, [string | undefined, string]> = {
    '/bootstrap.js': [assets.bootstrap, 'text/javascript; charset=utf-8'],
    '/commonjs.js': [assets.commonjs, 'text/javascript; charset=utf-8'],
    '/activate.js': [assets.activate, 'text/javascript; charset=utf-8'],
    '/moment.js': [assets.moment, 'text/javascript; charset=utf-8'],
  }
  if (textRoutes[url.pathname]) {
    const [body, type] = textRoutes[url.pathname]
    return body === undefined ? error(404) : { status: 200, headers: headers(type), body }
  }
  if (url.pathname === '/main.js') {
    const artifact = await verifyCalendarPluginArtifact(vaultRoot)
    if (!artifact.ok) return error(404)
    return { status: 200, headers: headers('text/javascript; charset=utf-8'), body: artifact.mainSource }
  }
  return error(404)
}

export function registerCalendarPluginSchemeAsPrivileged(): void {
  if (registered) return
  protocol.registerSchemesAsPrivileged([{ scheme: CALENDAR_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } }])
  registered = true
}

export function registerCalendarPluginProtocol(vaultRootProvider: () => string | null | undefined, assets: CalendarProtocolAssets = {}): void {
  if (handlerRegistered) return
  protocol.handle(CALENDAR_SCHEME, async (request) => {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: headers('text/plain; charset=utf-8') })
    let vaultRoot: string | null | undefined
    try { vaultRoot = vaultRootProvider() } catch { vaultRoot = undefined }
    const route = vaultRoot ? await planCalendarPluginRoute(request.url, vaultRoot, assets, request.method) : error(404)
    const body = route.body === undefined ? null : typeof route.body === 'string' ? route.body : new Uint8Array(route.body)
    return new Response(body, { status: route.status, headers: route.headers })
  })
  handlerRegistered = true
}

export function loadMomentScript(): string {
  const require = createRequire(import.meta.url)
  return require('node:fs').readFileSync(require.resolve('moment/min/moment-with-locales.js'), 'utf8')
}
