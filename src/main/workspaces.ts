import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  emptyVaultWorkspaces,
  MAX_NAMED_WORKSPACES,
  parseVaultWorkspacesV1,
  parseWorkspaceName,
  parseWorkspaceScope,
  parseWorkspaceSnapshotV1,
  type VaultWorkspacesV1,
  type WorkspaceCollection,
  type WorkspaceScope,
  type WorkspaceSnapshotV1
} from '../shared/workspace-state'
import { readRawSettingsForUpdate, writeRawSettings } from './settings'
import { VaultError, type VaultService } from './vault'

export async function canonicalWorkspaceVaultKey(path: string): Promise<string> {
  const resolved = await realpath(path)
  return resolve(resolved).replaceAll('\\', '/').replace(/\/+$/, '').toLocaleLowerCase('en-US')
}

function changed(message = 'Vaultが切り替わったため、配置を保存しませんでした。'): VaultError {
  return new VaultError({ code: 'FILE_CHANGED', message })
}

function invalid(message: string): VaultError {
  return new VaultError({ code: 'INVALID_PATH', message })
}

function parseInput<T>(parser: (value: unknown) => T, value: unknown, message: string): T {
  try {
    return parser(value)
  } catch (error) {
    throw new VaultError({ code: 'INVALID_PATH', message }, { cause: error })
  }
}

function workspaceMap(raw: Record<string, unknown>): Record<string, unknown> {
  const value = raw.workspaceStateByVault
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('保存済みワークスペース設定が壊れています。')
  }
  return value as Record<string, unknown>
}

function stateFor(map: Record<string, unknown>, key: string): VaultWorkspacesV1 {
  if (!Object.prototype.hasOwnProperty.call(map, key)) return emptyVaultWorkspaces()
  return parseInput(
    parseVaultWorkspacesV1,
    map[key],
    'このVaultの保存済みワークスペースを読み込めません。'
  )
}

function sameSnapshot(left: WorkspaceSnapshotV1, right: WorkspaceSnapshotV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export class WorkspaceService {
  constructor(
    private readonly vault: VaultService,
    private readonly now: () => Date = () => new Date()
  ) {}

  private async currentScope(): Promise<WorkspaceScope> {
    const rootPath = this.vault.getRootPath()
    const rootRevision = this.vault.getRootRevision()
    if (!rootPath) {
      throw new VaultError({ code: 'NO_VAULT', message: '先にVaultを開いてください。' })
    }
    let canonical: string
    try {
      canonical = await canonicalWorkspaceVaultKey(rootPath)
    } catch (error) {
      throw new VaultError(
        { code: 'INVALID_PATH', message: 'Vaultの保存先を確認できません。' },
        { cause: error }
      )
    }
    if (
      this.vault.getRootPath() !== rootPath ||
      this.vault.getRootRevision() !== rootRevision
    ) {
      throw changed()
    }
    return { rootPath: canonical, rootRevision }
  }

  private async assertScope(value: unknown): Promise<WorkspaceScope> {
    const expected = parseInput(
      parseWorkspaceScope,
      value,
      'ワークスペースの保存範囲が不正です。'
    )
    const current = await this.currentScope()
    if (
      expected.rootRevision !== current.rootRevision ||
      expected.rootPath !== current.rootPath
    ) {
      throw changed()
    }
    return current
  }

  async getWorkspaces(expectedVaultPath: string): Promise<WorkspaceCollection> {
    if (typeof expectedVaultPath !== 'string' || expectedVaultPath.length === 0) {
      throw invalid('Vaultの場所が不正です。')
    }
    let expectedKey: string
    try {
      expectedKey = await canonicalWorkspaceVaultKey(expectedVaultPath)
    } catch (error) {
      throw new VaultError(
        { code: 'INVALID_PATH', message: '指定されたVaultを確認できません。' },
        { cause: error }
      )
    }
    const scope = await this.currentScope()
    if (expectedKey !== scope.rootPath) throw changed('別のVaultが開かれています。')
    const raw = await readRawSettingsForUpdate()
    const state = stateFor(workspaceMap(raw), scope.rootPath)
    const confirmed = await this.currentScope()
    if (confirmed.rootRevision !== scope.rootRevision || confirmed.rootPath !== scope.rootPath) {
      throw changed()
    }
    return { scope, state }
  }

  async saveWorkspace(
    scopeValue: WorkspaceScope,
    nameValue: string,
    snapshotValue: WorkspaceSnapshotV1,
    replaceExisting: boolean
  ): Promise<WorkspaceCollection> {
    const scope = await this.assertScope(scopeValue)
    let name: string
    try {
      name = parseWorkspaceName(nameValue)
    } catch (error) {
      throw new VaultError(
        { code: 'INVALID_NAME', message: 'ワークスペース名が不正です。' },
        { cause: error }
      )
    }
    const snapshot = parseInput(
      parseWorkspaceSnapshotV1,
      snapshotValue,
      'ワークスペースの内容が不正です。'
    )
    if (typeof replaceExisting !== 'boolean') throw invalid('更新指定が不正です。')

    const raw = await readRawSettingsForUpdate()
    const map = workspaceMap(raw)
    const current = stateFor(map, scope.rootPath)
    const index = current.named.findIndex((item) => item.name === name)
    if (index >= 0 && !replaceExisting) {
      throw new VaultError({ code: 'ALREADY_EXISTS', message: '同じ名前の配置があります。' })
    }
    if (index < 0 && current.named.length >= MAX_NAMED_WORKSPACES) {
      throw invalid('保存できる名前付きワークスペースは50件までです。')
    }
    if (index >= 0 && sameSnapshot(current.named[index].snapshot, snapshot)) {
      await this.assertScope(scope)
      return { scope, state: current }
    }

    const named = [...current.named]
    const item = { name, savedAt: this.now().toISOString(), snapshot }
    if (index >= 0) named[index] = item
    else named.push(item)
    named.sort((left, right) =>
      left.savedAt === right.savedAt
        ? left.name < right.name
          ? -1
          : left.name > right.name
            ? 1
            : 0
        : right.savedAt.localeCompare(left.savedAt)
    )
    const state: VaultWorkspacesV1 = { ...current, named }
    await this.assertScope(scope)
    await writeRawSettings({
      ...raw,
      workspaceStateByVault: { ...map, [scope.rootPath]: state }
    })
    return { scope, state }
  }

  async deleteWorkspace(scopeValue: WorkspaceScope, nameValue: string): Promise<WorkspaceCollection> {
    const scope = await this.assertScope(scopeValue)
    let name: string
    try {
      name = parseWorkspaceName(nameValue)
    } catch (error) {
      throw new VaultError(
        { code: 'INVALID_NAME', message: 'ワークスペース名が不正です。' },
        { cause: error }
      )
    }
    const raw = await readRawSettingsForUpdate()
    const map = workspaceMap(raw)
    const current = stateFor(map, scope.rootPath)
    if (!current.named.some((item) => item.name === name)) {
      throw new VaultError({ code: 'NOT_FOUND', message: 'ワークスペースが見つかりません。' })
    }
    const state: VaultWorkspacesV1 = {
      ...current,
      named: current.named.filter((item) => item.name !== name)
    }
    await this.assertScope(scope)
    await writeRawSettings({
      ...raw,
      workspaceStateByVault: { ...map, [scope.rootPath]: state }
    })
    return { scope, state }
  }

  async saveLastWorkspaceSession(
    scopeValue: WorkspaceScope,
    snapshotValue: WorkspaceSnapshotV1
  ): Promise<null> {
    const scope = await this.assertScope(scopeValue)
    const snapshot = parseInput(
      parseWorkspaceSnapshotV1,
      snapshotValue,
      'ワークスペースの内容が不正です。'
    )
    const raw = await readRawSettingsForUpdate()
    const map = workspaceMap(raw)
    const current = stateFor(map, scope.rootPath)
    if (current.lastSession && sameSnapshot(current.lastSession, snapshot)) {
      await this.assertScope(scope)
      return null
    }
    const state: VaultWorkspacesV1 = { ...current, lastSession: snapshot }
    await this.assertScope(scope)
    await writeRawSettings({
      ...raw,
      workspaceStateByVault: { ...map, [scope.rootPath]: state }
    })
    return null
  }
}
