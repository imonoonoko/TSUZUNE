import { canonicalWorkspaceVaultKey } from './workspaces'
import { readRawSettingsForUpdate, writeRawSettings } from './settings'
import { VaultError, type VaultService } from './vault'
import { parseDeclaredPropertyTypes, type PropertyChangeScope, type PropertyDeclaredType } from '../shared/property-changes'

export class PropertyTypeSettingsService {
  constructor(private readonly vault: VaultService) {}

  private async assertScope(scope: PropertyChangeScope): Promise<string> {
    if (!scope || typeof scope.rootPath !== 'string' || !Number.isInteger(scope.rootRevision))
      throw new VaultError({ code: 'INVALID_PATH', message: 'Property設定の保存範囲が不正です。' })
    const root = this.vault.getRootPath()
    if (!root) throw new VaultError({ code: 'INVALID_PATH', message: 'Vaultを開いてください。' })
    const key = await canonicalWorkspaceVaultKey(root)
    if (this.vault.getRootPath() !== root || this.vault.getRootRevision() !== scope.rootRevision || key !== scope.rootPath)
      throw new VaultError({ code: 'FILE_CHANGED', message: 'Vaultが切り替わりました。Property設定を保存しませんでした。' })
    return key
  }

  async get(scope: PropertyChangeScope): Promise<Record<string, PropertyDeclaredType>> {
    const key = await this.assertScope(scope)
    const raw = await readRawSettingsForUpdate()
    await this.assertScope(scope)
    const map = raw.propertyTypesByVault
    if (map !== undefined && (!map || typeof map !== 'object' || Array.isArray(map))) throw new Error('Property設定の形式が不正です。')
    return parseDeclaredPropertyTypes((map as Record<string, unknown> | undefined)?.[key])
  }

  async set(scope: PropertyChangeScope, value: Record<string, PropertyDeclaredType>): Promise<void> {
    const types = parseDeclaredPropertyTypes(value)
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(types).length !== Object.keys(value).length)
      throw new Error('Property名または宣言型が不正です。')
    const key = await this.assertScope(scope)
    const raw = await readRawSettingsForUpdate()
    const map = raw.propertyTypesByVault
    if (map !== undefined && (!map || typeof map !== 'object' || Array.isArray(map))) throw new Error('Property設定の形式が不正です。')
    await this.assertScope(scope)
    await writeRawSettings({ ...raw, propertyTypesByVault: { ...(map as Record<string, unknown> ?? {}), [key]: types } })
  }
}
