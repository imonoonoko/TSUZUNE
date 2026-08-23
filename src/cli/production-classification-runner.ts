import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { app, safeStorage } from 'electron'
import { parseClassificationMigrationPlan } from './classification-migration-preview'
import {
  applyProductionClassificationRelocation,
  previewProductionClassificationRelocation,
  type ProductionClassificationRelocationOptions
} from './production-classification-relocation'
import {
  assertProductionNotRunning,
  resolveOAuthBuildCredentials,
  sanitizedPreview
} from './production-classification-runner-core'
import { GoogleConnectionService } from '../main/google-connection'
import {
  createPathAliasObject,
  downloadMarkdown,
  listPathAliasObjects,
  listVaultFiles,
  moveMarkdown,
  trashPathAliasObject,
  updatePathAliasObject
} from '../main/google-drive'
import { SecureTokenStore } from '../main/secure-token-store'
import type {
  DriveMarkdownRelocationRemote,
  RemoteRelocationMarkdownObject
} from './drive-path-alias-relocation-prototype'
import type { DrivePathAliasRemote } from './drive-path-alias-sync-prototype'

interface DriveLedgerBinding {
  rootPath: string
  vaultId: string
  rootFolderId: string | null
}

function requiredMode(): 'preview' | 'apply' {
  const preview = process.argv.includes('--preview')
  const apply = process.argv.includes('--apply')
  if (preview === apply) {
    throw new Error('Specify exactly one of --preview or --apply.')
  }
  return apply ? 'apply' : 'preview'
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sha256(value: string): string {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex')
}

function appDataRoot(): string {
  return resolve(
    process.env.APPDATA ?? resolve(homedir(), 'AppData', 'Roaming'),
    'tsuzune'
  )
}

function installedRoot(): string {
  return resolve(
    process.env.LOCALAPPDATA ?? resolve(homedir(), 'AppData', 'Local'),
    'Programs',
    'tsuzune'
  )
}

async function activeVaultRoot(settingsPath: string): Promise<string> {
  const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
    lastVaultPath?: unknown
  }
  if (typeof settings.lastVaultPath !== 'string') {
    throw new Error('Active production Vault is not configured.')
  }
  return resolve(settings.lastVaultPath)
}

async function pairedDriveBinding(
  ledgerPath: string,
  vaultRoot: string
): Promise<DriveLedgerBinding> {
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8')) as {
    version?: unknown
    vaults?: DriveLedgerBinding[]
  }
  const matches = (ledger.vaults ?? []).filter(
    (vault) =>
      resolve(vault.rootPath).toLocaleLowerCase() ===
      resolve(vaultRoot).toLocaleLowerCase()
  )
  if (
    ledger.version !== 1 ||
    matches.length !== 1 ||
    !matches[0].vaultId ||
    !matches[0].rootFolderId
  ) {
    throw new Error('Active Vault does not have one complete Drive binding.')
  }
  return matches[0]
}

function markdownRemote(
  accessToken: string,
  targetPaths: ReadonlySet<string>
): DriveMarkdownRelocationRemote {
  return {
    async listMarkdown(vaultId) {
      const files = await listVaultFiles(accessToken, vaultId)
      return Promise.all(
        files.map(async (file): Promise<RemoteRelocationMarkdownObject> => {
          const contentHash = targetPaths.has(file.path.toLocaleLowerCase())
            ? sha256(await downloadMarkdown(accessToken, file.id))
            : ''
          return {
            id: file.id,
            vaultId: file.appProperties.tsuzuneVaultId,
            path: file.path,
            name: file.name,
            parentId: file.parentIds[0] ?? '',
            version: file.version ?? '',
            contentHash
          }
        })
      )
    },
    async relocateMarkdown(input) {
      const moved = await moveMarkdown(accessToken, {
        fileId: input.fileId,
        vaultId: input.vaultId,
        oldPath: input.oldPath,
        path: input.newPath,
        expectedVersion: input.expectedVersion,
        expectedContentHash: input.expectedContentHash
      })
      if (!moved.version) {
        throw new Error('Google Drive did not return a relocation version.')
      }
      const contentHash = sha256(
        await downloadMarkdown(accessToken, moved.id)
      )
      return {
        id: moved.id,
        vaultId: moved.appProperties.tsuzuneVaultId,
        path: moved.path,
        name: moved.name,
        parentId: moved.parentIds[0] ?? '',
        version: moved.version,
        contentHash
      }
    }
  }
}

function aliasRemote(accessToken: string): DrivePathAliasRemote {
  return {
    list: (vaultId) => listPathAliasObjects(accessToken, vaultId),
    create: (input) => createPathAliasObject(accessToken, input),
    update: (input) => updatePathAliasObject(accessToken, input),
    remove: (input) => trashPathAliasObject(accessToken, input)
  }
}

async function productionAccessToken(
  googleDirectory: string,
  installedAsarPath: string
): Promise<string> {
  const credentials = resolveOAuthBuildCredentials(installedAsarPath)
  const tokenStore = new SecureTokenStore(
    join(googleDirectory, 'refresh-token.json'),
    {
      isAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (plainText) => safeStorage.encryptStringAsync(plainText),
      decrypt: async (encrypted) =>
        (await safeStorage.decryptStringAsync(encrypted)).result
    }
  )
  const connection = new GoogleConnectionService({
    stateDirectory: googleDirectory,
    tokenStore,
    bundledClientId: credentials.clientId,
    bundledClientSecret: credentials.clientSecret,
    authorize: async () => {
      throw new Error('The offline classification runner cannot start OAuth.')
    },
    fetchImpl: globalThis.fetch
  })
  return connection.getAccessToken()
}

async function run(): Promise<void> {
  const mode = requiredMode()
  const productionRoot = installedRoot()
  const installedExecutable = join(productionRoot, 'TSUZUNE.exe')
  const processGuard = () => assertProductionNotRunning(installedExecutable)
  await processGuard()

  const stateRoot = appDataRoot()
  const googleDirectory = join(stateRoot, 'google')
  const settingsPath = join(stateRoot, 'settings.json')
  const driveLedgerPath = join(googleDirectory, 'drive-sync.json')
  const aliasLedgerPath = join(googleDirectory, 'path-alias-ledger.json')
  const recoveryRoot = join(stateRoot, 'recovery', 'production-classification')
  const preimagesDirectory = join(recoveryRoot, 'preimages')
  const recoveryPacketPath = join(recoveryRoot, 'recovery.json')
  const vaultRoot = await activeVaultRoot(settingsPath)
  const binding = await pairedDriveBinding(driveLedgerPath, vaultRoot)
  const planPath = resolve(
    argument('--plan') ??
      'docs/migrations/o2-production-classification-apply-plan.json'
  )
  const plan = parseClassificationMigrationPlan(
    JSON.parse(await readFile(planPath, 'utf8'))
  )

  await mkdir(preimagesDirectory, { recursive: true })
  await app.whenReady()
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('OS secure storage is unavailable.')
  }
  const accessToken = await productionAccessToken(
    googleDirectory,
    join(productionRoot, 'resources', 'app.asar')
  )
  const targetPaths = new Set(
    plan.moves
      .flatMap((move) => [move.sourcePath, move.destinationPath])
      .map((path) => path.toLocaleLowerCase())
  )
  const aliases = aliasRemote(accessToken)
  const markdown = markdownRemote(accessToken, targetPaths)

  const options: ProductionClassificationRelocationOptions = {
    vaultRoot,
    ownershipToken: randomUUID(),
    preimagesDirectory,
    recoveryPacketPath,
    driveLedgerPath,
    aliasLedgerPath,
    plan,
    vaultId: binding.vaultId,
    rootFolderId: binding.rootFolderId!,
    aliasRemote: aliases,
    markdownRemote: markdown,
    processGuard
  }

  if (mode === 'preview') {
    const preview = await previewProductionClassificationRelocation(options)
    process.stdout.write(
      `${JSON.stringify({ mode, status: 'ready', ...sanitizedPreview(preview) })}\n`
    )
    return
  }

  const expectedFingerprint = argument('--expected-fingerprint')
  if (!expectedFingerprint) {
    throw new Error('--expected-fingerprint is required for --apply.')
  }
  await applyProductionClassificationRelocation({
    ...options,
    expectedFingerprint
  })
  process.stdout.write(
    `${JSON.stringify({ mode, status: 'applied', moveCount: plan.moves.length })}\n`
  )
}

async function main(): Promise<void> {
  let exitCode = 0
  try {
    await run()
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Classification relocation was blocked.'}\n`
    )
    exitCode = 1
  } finally {
    app.exit(exitCode)
  }
}

void main()
