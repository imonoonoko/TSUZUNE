import { lstat, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  applyDrivePathAliasRelocationPrototype,
  previewDrivePathAliasRelocationPrototype,
  type DriveMarkdownRelocationRemote,
  type DrivePathAliasRelocationPreview,
  type RelocationOptions
} from './drive-path-alias-relocation-prototype'

export const PRODUCTION_CLASSIFICATION_ALLOWLIST = [
  [
    '30_知識/TSUZUNE-Google連携・同期・障害対応.md',
    '30_知識/ソフトウェア開発/TSUZUNE-Google連携・同期・障害対応.md'
  ],
  [
    '30_知識/TSUZUNE-MCPとAI書き込み運用.md',
    '30_知識/ソフトウェア開発/TSUZUNE-MCPとAI書き込み運用.md'
  ],
  [
    '30_知識/TSUZUNE-データ保護・バックアップ・復旧.md',
    '30_知識/ソフトウェア開発/TSUZUNE-データ保護・バックアップ・復旧.md'
  ],
  [
    '30_知識/TSUZUNE-開発開始と区切りの標準ループ.md',
    '30_知識/ソフトウェア開発/TSUZUNE-開発開始と区切りの標準ループ.md'
  ],
  [
    '30_知識/TSUZUNE-本番更新・インストール・Release運用.md',
    '30_知識/ソフトウェア開発/TSUZUNE-本番更新・インストール・Release運用.md'
  ]
] as const

export type ProductionProcessGuard = () => Promise<void>

export type ProductionClassificationRelocationOptions = RelocationOptions & {
  processGuard: ProductionProcessGuard
}

export type ProductionClassificationRelocationPreview =
  DrivePathAliasRelocationPreview

function productionSettingsPath(): string {
  return resolve(
    process.env.APPDATA ?? resolve(homedir(), 'AppData', 'Roaming'),
    'tsuzune',
    'settings.json'
  )
}

async function assertAbsent(path: string, label: string): Promise<void> {
  try {
    await lstat(path)
    throw new Error(`${label} exists.`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export function assertCanonicalPlan(
  options: Pick<RelocationOptions, 'plan'>
): void {
  const actual = (options.plan?.moves ?? [])
    .map((move) => `${move.sourcePath}\0${move.destinationPath}`)
    .sort()
  const expected = PRODUCTION_CLASSIFICATION_ALLOWLIST
    .map(([sourcePath, destinationPath]) => `${sourcePath}\0${destinationPath}`)
    .sort()
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      'Production classification relocation requires the canonical five-note plan.'
    )
  }
}

export async function assertActiveProductionBinding(
  options: Pick<
    RelocationOptions,
    | 'aliasLedgerPath'
    | 'driveLedgerPath'
    | 'plan'
    | 'preimagesDirectory'
    | 'recoveryPacketPath'
    | 'rootFolderId'
    | 'vaultId'
    | 'vaultRoot'
  >
): Promise<void> {
  const settings = JSON.parse(
    await readFile(productionSettingsPath(), 'utf8')
  ) as { lastVaultPath?: unknown }
  if (
    typeof settings.lastVaultPath !== 'string' ||
    resolve(settings.lastVaultPath).toLocaleLowerCase() !==
      resolve(options.vaultRoot).toLocaleLowerCase()
  ) {
    throw new Error(
      'Active production Vault root does not match the relocation root.'
    )
  }

  const ledger = JSON.parse(
    await readFile(options.driveLedgerPath, 'utf8')
  ) as {
    version?: unknown
    vaults?: Array<{
      rootPath?: string
      vaultId?: string
      rootFolderId?: string | null
      pendingDeletion?: unknown
      pendingMoves?: unknown
    }>
  }
  if (ledger.version !== 1 || !Array.isArray(ledger.vaults)) {
    throw new Error('Drive ledger schema is not supported.')
  }
  const matchingBindings = ledger.vaults.filter(
    (vault) =>
      typeof vault.rootPath === 'string' &&
      resolve(vault.rootPath).toLocaleLowerCase() ===
        resolve(options.vaultRoot).toLocaleLowerCase()
  )
  if (matchingBindings.length !== 1) {
    throw new Error(
      matchingBindings.length === 0
        ? 'Drive ledger is not bound to the active production Vault.'
        : 'Drive ledger has ambiguous bindings for the active production Vault.'
    )
  }
  const paired = matchingBindings[0]
  if (paired.vaultId !== options.vaultId || paired.rootFolderId !== options.rootFolderId) {
    throw new Error('Drive ledger is not bound to the active production Vault.')
  }
  const pendingMoves =
    paired.pendingMoves &&
    typeof paired.pendingMoves === 'object' &&
    !Array.isArray(paired.pendingMoves)
      ? Object.keys(paired.pendingMoves as Record<string, unknown>)
      : []
  if (paired.pendingDeletion || pendingMoves.length > 0) {
    throw new Error('Drive ledger has pending recovery work.')
  }

  await assertAbsent(options.recoveryPacketPath, 'Unresolved recovery packet')
  await assertAbsent(
    resolve(options.preimagesDirectory, `${options.plan.planId}.rollback.json`),
    'Unresolved local rollback packet'
  )

  try {
    const aliasLedger = JSON.parse(
      await readFile(options.aliasLedgerPath, 'utf8')
    ) as {
      kind?: unknown
      version?: unknown
      vaultId?: unknown
      rootFolderId?: unknown
    }
    if (
      aliasLedger.kind !== 'o2-p4a-path-alias-ledger' ||
      aliasLedger.version !== 1 ||
      aliasLedger.vaultId !== options.vaultId ||
      aliasLedger.rootFolderId !== options.rootFolderId
    ) {
      throw new Error(
        'Path Alias ledger is not bound to the active production Vault.'
      )
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function productionOptions(
  options: ProductionClassificationRelocationOptions
): RelocationOptions {
  if (!options.ownershipToken) {
    throw new Error('Production relocation requires an explicit ownership token.')
  }
  return {
    ...options,
    ownership: {
      mode: 'production',
      settingsPath: productionSettingsPath(),
      vaultId: options.vaultId,
      rootFolderId: options.rootFolderId
    }
  }
}

export async function previewProductionClassificationRelocation(
  options: ProductionClassificationRelocationOptions
): Promise<ProductionClassificationRelocationPreview> {
  assertCanonicalPlan(options)
  await options.processGuard()
  await assertActiveProductionBinding(options)
  return previewDrivePathAliasRelocationPrototype(productionOptions(options))
}

export async function applyProductionClassificationRelocation(
  options: ProductionClassificationRelocationOptions & {
    expectedFingerprint: string
  }
): Promise<void> {
  if (!options.expectedFingerprint) {
    throw new Error('Expected preview fingerprint is required.')
  }
  const preview = await previewProductionClassificationRelocation(options)
  if (preview.fingerprint !== options.expectedFingerprint) {
    throw new Error('Production classification preview fingerprint is stale.')
  }
  await options.processGuard()
  await applyDrivePathAliasRelocationPrototype({
    ...productionOptions(options),
    preview
  })
}

export type { DriveMarkdownRelocationRemote }
