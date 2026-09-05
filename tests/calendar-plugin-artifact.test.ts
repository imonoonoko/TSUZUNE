import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { CALENDAR_PLUGIN_CONTRACT, verifyCalendarPluginArtifact, type CalendarArtifactContract } from '../src/main/calendar-plugin-artifact'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-calendar-artifact-'))
  const dir = join(root, '.obsidian', 'plugins', 'calendar')
  await mkdir(dir, { recursive: true })
  const main = 'window.calendarFixture = true'
  const manifest = JSON.stringify({ id: 'calendar-fixture', version: '0.0.1' })
  await writeFile(join(dir, 'main.js'), main)
  await writeFile(join(dir, 'manifest.json'), manifest)
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const contract: CalendarArtifactContract = { ...CALENDAR_PLUGIN_CONTRACT, id: 'calendar-fixture', version: '0.0.1', mainSha256: hash(main), manifestSha256: hash(manifest) }
  return { root, dir, contract }
}
function reason(result: Awaited<ReturnType<typeof verifyCalendarPluginArtifact>>) {
  if (result.ok) throw new Error('expected rejection')
  return result.reason
}

describe('Calendar 1.5.10 artifact verifier', () => {
  it('accepts the pinned official artifact', async () => {
    const { root, contract } = await fixture()
    const result = await verifyCalendarPluginArtifact(root, contract)
    expect(result).toMatchObject({ ok: true, id: 'calendar-fixture', version: '0.0.1' })
    expect(result.ok && Buffer.from(result.mainSource).toString('utf8')).toBe('window.calendarFixture = true')
    expect(CALENDAR_PLUGIN_CONTRACT).toMatchObject({ id: 'calendar', version: '1.5.10' })
  })

  it('rejects missing, modified, and mismatched artifacts', async () => {
    const { root, dir, contract } = await fixture()
    await writeFile(join(dir, 'main.js'), 'modified')
    expect(reason(await verifyCalendarPluginArtifact(root, contract))).toBe('main-hash-mismatch')
    const manifestFixture = await fixture()
    const manifest = JSON.parse(await readFile(join(manifestFixture.dir, 'manifest.json'), 'utf8'))
    manifest.version = '9.9.9'
    await writeFile(join(manifestFixture.dir, 'manifest.json'), JSON.stringify(manifest))
    expect(reason(await verifyCalendarPluginArtifact(manifestFixture.root, manifestFixture.contract))).toBe('manifest-hash-mismatch')
    const missing = await mkdtemp(join(tmpdir(), 'tsuzune-calendar-missing-'))
    expect(reason(await verifyCalendarPluginArtifact(missing, contract))).toBe('missing-plugin-directory')
  })

  it('rejects symlinked plugin files when the platform permits creating them', async () => {
    const { root, dir, contract } = await fixture()
    try {
      await writeFile(join(root, 'outside.js'), await readFile(join(dir, 'main.js')))
      await symlink(join(root, 'outside.js'), join(dir, 'main.js'))
    } catch {
      return
    }
    expect(reason(await verifyCalendarPluginArtifact(root, contract))).toBe('main-file-symlink')
  })
})
