import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClassificationMigrationPlan } from '../src/cli/classification-migration-preview'
import {
  PRODUCTION_CLASSIFICATION_ALLOWLIST,
  assertActiveProductionBinding,
  assertCanonicalPlan
} from '../src/cli/production-classification-relocation'
import {
  assertProductionNotRunning,
  countInstalledProductionProcesses,
  resolveOAuthBuildCredentials,
  sanitizedPreview
} from '../src/cli/production-classification-runner-core'

const temporaryRoots: string[] = []
const originalAppData = process.env.APPDATA

afterEach(async () => {
  process.env.APPDATA = originalAppData
  await Promise.all(
    temporaryRoots.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  )
})

function canonicalPlan(): ClassificationMigrationPlan {
  return {
    schemaVersion: 1,
    planId: 'test-production-classification',
    analysisAsOf: '2026-08-17T00:00:00+09:00',
    auditSource: {
      path: '40_情報源/audit.md',
      expectedSizeBytes: 1,
      expectedSha256: 'A'.repeat(64)
    },
    moves: PRODUCTION_CLASSIFICATION_ALLOWLIST.map(
      ([sourcePath, destinationPath]) => ({
        sourcePath,
        destinationPath,
        expectedSizeBytes: 1,
        expectedSha256: 'B'.repeat(64),
        expectedReferences: {
          active: 0,
          source: 0,
          history: 0,
          mcpBacklinks: 0
        }
      })
    )
  }
}

async function bindingFixture(pendingMoves: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'tsuzune-production-binding-'))
  temporaryRoots.push(root)
  process.env.APPDATA = root
  const vaultRoot = join(root, 'Vault')
  const stateRoot = join(root, 'tsuzune')
  const googleRoot = join(stateRoot, 'google')
  const preimagesDirectory = join(stateRoot, 'recovery', 'preimages')
  const driveLedgerPath = join(googleRoot, 'drive-sync.json')
  const aliasLedgerPath = join(googleRoot, 'path-alias-ledger.json')
  const recoveryPacketPath = join(stateRoot, 'recovery', 'recovery.json')
  await Promise.all([
    mkdir(vaultRoot, { recursive: true }),
    mkdir(googleRoot, { recursive: true }),
    mkdir(preimagesDirectory, { recursive: true })
  ])
  await writeFile(
    join(stateRoot, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot })
  )
  await writeFile(
    driveLedgerPath,
    JSON.stringify({
      version: 1,
      vaults: [
        {
          rootPath: vaultRoot,
          vaultId: 'vault-id',
          rootFolderId: 'root-id',
          pendingMoves
        }
      ]
    })
  )
  return {
    vaultRoot,
    driveLedgerPath,
    aliasLedgerPath,
    recoveryPacketPath,
    preimagesDirectory,
    plan: canonicalPlan(),
    vaultId: 'vault-id',
    rootFolderId: 'root-id'
  }
}

describe('production classification relocation boundary', () => {
  it('accepts only the canonical five source and destination pairs', () => {
    const plan = canonicalPlan()
    expect(() => assertCanonicalPlan({ plan })).not.toThrow()
    plan.moves[0] = {
      ...plan.moves[0],
      sourcePath: '30_知識/別ノート.md'
    }
    expect(() => assertCanonicalPlan({ plan })).toThrow(/canonical five-note/)
  })

  it('accepts an absent alias ledger and an empty pending-move map', async () => {
    await expect(
      assertActiveProductionBinding(await bindingFixture())
    ).resolves.toBeUndefined()
  })

  it('fails closed when Drive has pending move work', async () => {
    await expect(
      assertActiveProductionBinding(
        await bindingFixture({ 'old.md': 'new.md' })
      )
    ).rejects.toThrow(/pending recovery work/)
  })

  it('fails closed when the active Vault has multiple Drive bindings', async () => {
    const fixture = await bindingFixture()
    const ledger = JSON.parse(await readFile(fixture.driveLedgerPath, 'utf8'))
    ledger.vaults.push({
      rootPath: fixture.vaultRoot,
      vaultId: 'another-vault-id',
      rootFolderId: 'another-root-id'
    })
    await writeFile(fixture.driveLedgerPath, JSON.stringify(ledger))
    await expect(assertActiveProductionBinding(fixture)).rejects.toThrow(
      /ambiguous bindings/
    )
  })

  it('counts only the exact installed executable and rejects a running app', async () => {
    let target = ''
    const count = countInstalledProductionProcesses(
      'C:\\Programs\\tsuzune\\TSUZUNE.exe',
      (_file, _args, options) => {
        target = options.env.TSUZUNE_PROCESS_TARGET ?? ''
        return '0\r\n'
      }
    )
    expect(count).toBe(0)
    expect(target).toBe('C:\\Programs\\tsuzune\\TSUZUNE.exe')
    await expect(
      assertProductionNotRunning('ignored', () => 2)
    ).rejects.toThrow(/is running/)
  })

  it('never includes remote file IDs in the serialized preview', () => {
    const value = sanitizedPreview({
      fingerprint: 'fingerprint',
      moves: [
        {
          fileId: 'raw-drive-file-id',
          sourcePath: 'source.md',
          destinationPath: 'destination.md',
          version: 'remote-version',
          contentHash: 'content-hash'
        }
      ]
    })
    const serialized = JSON.stringify(value)
    expect(serialized).not.toContain('raw-drive-file-id')
    expect(serialized).not.toContain('remote-version')
    expect(value.moveCount).toBe(1)
  })

  it('requires OAuth environment values as a pair', () => {
    expect(() =>
      resolveOAuthBuildCredentials('missing.asar', {
        MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID: 'client-id'
      })
    ).toThrow(/must be set together/)
    expect(
      resolveOAuthBuildCredentials('missing.asar', {
        MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
        MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret'
      })
    ).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' })
  })
})
