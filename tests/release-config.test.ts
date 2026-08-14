import { execFile as execFileCallback } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFile = promisify(execFileCallback)

interface PackageManifest {
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
  build?: {
    appId?: string
    publish?: Array<Record<string, unknown>>
    win?: {
      icon?: string
      target?: Array<{ target?: string; arch?: string[] }>
      artifactName?: string
    }
    nsis?: {
      oneClick?: boolean
      perMachine?: boolean
      deleteAppDataOnUninstall?: boolean
    }
  }
}

async function readPackageManifest(): Promise<PackageManifest> {
  return JSON.parse(
    await readFile(join(process.cwd(), 'package.json'), 'utf8')
  ) as PackageManifest
}

describe('Windows production release contract', () => {
  it('builds an auto-updatable per-user NSIS installer', async () => {
    const manifest = await readPackageManifest()
    const windowsTarget = manifest.build?.win?.target?.[0]

    expect(manifest.build?.appId).toBe('jp.tsuzune.app')
    expect(manifest.build?.win?.icon).toBe(
      'src/renderer/assets/tsuzune-app-icon.png'
    )
    expect(windowsTarget).toEqual({ target: 'nsis', arch: ['x64'] })
    expect(manifest.build?.win?.artifactName).toBe(
      'TSUZUNE-Setup-${version}.${ext}'
    )
    expect(manifest.build?.nsis).toEqual(
      expect.objectContaining({
        oneClick: true,
        perMachine: false,
        deleteAppDataOnUninstall: false
      })
    )
    expect(manifest.scripts?.['pack:win']).toContain('--win nsis --x64')
    expect(manifest.scripts?.['check:installer']).toBe(
      'node scripts/check-installer.mjs'
    )
  })

  it('provides one ordered command that updates the installed production app', async () => {
    const manifest = await readPackageManifest()

    expect(manifest.scripts?.['production:update']).toBe(
      'node scripts/update-production.mjs'
    )

    const { stdout } = await execFile(
      process.execPath,
      [join(process.cwd(), 'scripts', 'update-production.mjs'), '--plan'],
      { cwd: process.cwd() }
    )
    const plan = JSON.parse(stdout) as {
      steps: Array<{ id: string }>
      installArguments: string[]
      productionProfilePolicy: string
      installedVerification: string[]
    }

    expect(plan.steps.map(({ id }) => id)).toEqual([
      'typecheck',
      'tests',
      'mcp',
      'package',
      'installer-contract',
      'packaged-smoke',
      'silent-install',
      'installed-smoke',
      'installed-hash',
      'mcp-register'
    ])
    expect(plan.installArguments).toEqual(['/S'])
    expect(plan.productionProfilePolicy).toBe('must-remain-byte-identical')
    expect(plan.installedVerification).toEqual([
      'package-version',
      'app.asar-sha256',
      'executable-sha256',
      'renderer-ready'
    ])
  })

  it('runs packaged startup checks with an isolated Electron profile', async () => {
    const source = await readFile(
      join(process.cwd(), 'scripts', 'check-packaged-startup.mjs'),
      'utf8'
    )

    expect(source).toContain('--user-data-dir=')
  })

  it('keeps one app instance and focuses it on repeated launch', async () => {
    const source = await readFile(
      join(process.cwd(), 'src', 'main', 'index.ts'),
      'utf8'
    )
    const lockIndex = source.indexOf('app.requestSingleInstanceLock()')

    expect(lockIndex).toBeGreaterThan(-1)
    expect(lockIndex).toBeLessThan(source.indexOf('app.whenReady()'))
    expect(source).toContain('if (!singleInstanceLock) app.quit()')
    expect(source).toContain("app.on('second-instance', showMainWindow)")
  })

  it('invalidates the installed asar cache after replacing the production app', async () => {
    const source = await readFile(
      join(process.cwd(), 'scripts', 'update-production.mjs'),
      'utf8'
    )
    const installIndex = source.indexOf("runChecked(installer, ['/S'])")
    const uncacheIndex = source.indexOf('uncache(installedAsar)', installIndex)
    const versionReadIndex = source.indexOf(
      'const installedVersion = await readAsarVersion(installedAsar)',
      installIndex
    )

    expect(installIndex).toBeGreaterThan(-1)
    expect(uncacheIndex).toBeGreaterThan(installIndex)
    expect(uncacheIndex).toBeLessThan(versionReadIndex)
  })
})
