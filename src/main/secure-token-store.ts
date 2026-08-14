import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface StringEncryptor {
  isAvailable(): Promise<boolean>
  encrypt(plainText: string): Promise<Buffer>
  decrypt(encrypted: Buffer): Promise<string>
}

interface StoredCiphertext {
  version: 1
  ciphertext: string
}

export class SecureTokenStore {
  constructor(
    private readonly filePath: string,
    private readonly encryptor: StringEncryptor
  ) {}

  async read(): Promise<string | null> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }

    if (!(await this.encryptor.isAvailable())) {
      throw new Error('Windowsの暗号化を利用できないためGoogle認証を復元できません。')
    }

    const parsed = JSON.parse(raw) as Partial<StoredCiphertext>
    if (parsed.version !== 1 || typeof parsed.ciphertext !== 'string') {
      throw new Error('保存されたGoogle認証情報の形式が不正です。')
    }
    return this.encryptor.decrypt(Buffer.from(parsed.ciphertext, 'base64'))
  }

  async write(refreshToken: string): Promise<void> {
    if (!(await this.encryptor.isAvailable())) {
      throw new Error('Windowsの暗号化を利用できないためGoogle認証を保存できません。')
    }
    const encrypted = await this.encryptor.encrypt(refreshToken)
    const payload: StoredCiphertext = {
      version: 1,
      ciphertext: encrypted.toString('base64')
    }
    const parent = dirname(this.filePath)
    const temporaryPath = `${this.filePath}.tmp-${randomUUID()}`
    await mkdir(parent, { recursive: true })
    try {
      await writeFile(temporaryPath, JSON.stringify(payload), {
        encoding: 'utf8',
        flag: 'wx'
      })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true })
  }
}
