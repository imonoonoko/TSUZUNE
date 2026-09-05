import { randomUUID } from 'node:crypto'
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AiWriteReviewProposal } from '../shared/types'

interface ProposalFile {
  version: 1
  proposals: AiWriteReviewProposal[]
}

const EMPTY_FILE: ProposalFile = { version: 1, proposals: [] }

function proposalFilePath(settingsPath: string): string {
  return join(dirname(settingsPath), 'ai-write-review-proposals.json')
}

async function readProposalFile(path: string): Promise<ProposalFile> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<ProposalFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.proposals)) {
      throw new Error('AI変更案ファイルの形式が正しくありません。')
    }
    return {
      version: 1,
      proposals: parsed.proposals
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_FILE
    if (error instanceof SyntaxError) {
      throw new Error('AI変更案ファイルを読み取れませんでした。')
    }
    throw error
  }
}

async function withFileLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = `${path}.lock`
  await mkdir(dirname(path), { recursive: true })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx')
      try {
        return await operation()
      } finally {
        await handle.close()
        await unlink(lockPath).catch(() => undefined)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error('AI変更案の保存が使用中です。少し待ってから再試行してください。')
}

async function writeProposalFile(path: string, value: ProposalFile): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8')
  await rename(temporaryPath, path)
}

export class AiWriteReviewStore {
  private readonly path: string

  constructor(settingsPath: string) {
    this.path = proposalFilePath(settingsPath)
  }

  async list(): Promise<AiWriteReviewProposal[]> {
    return [...(await readProposalFile(this.path)).proposals]
  }

  async get(id: string): Promise<AiWriteReviewProposal | null> {
    return (await this.list()).find((proposal) => proposal.id === id) ?? null
  }

  async add(
    input: Omit<AiWriteReviewProposal, 'id' | 'createdAt'>
  ): Promise<AiWriteReviewProposal> {
    return withFileLock(this.path, async () => {
      const current = await readProposalFile(this.path)
      if (
        current.proposals.some(
          (proposal) => proposal.path.toLowerCase() === input.path.toLowerCase()
        )
      ) {
        throw new Error(`このノートには既に承認待ちのAI変更案があります: ${input.path}`)
      }
      const derivedGuard = input.derivedGuard
      if (
        derivedGuard &&
        current.proposals.some((proposal) => {
          const existingGuard = proposal.derivedGuard
          return (
            existingGuard !== undefined &&
            existingGuard.sourcePath.toLowerCase() ===
              derivedGuard.sourcePath.toLowerCase() &&
            existingGuard.sourceRevision === derivedGuard.sourceRevision &&
            existingGuard.derivationKey === derivedGuard.derivationKey
          )
        })
      ) {
        throw new Error('同じ原典revision・概念keyの派生ノート提案が既に存在します。')
      }
      const proposal = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString()
      }
      await writeProposalFile(this.path, {
        version: 1,
        proposals: [...current.proposals, proposal]
      })
      return proposal
    })
  }

  async remove(id: string): Promise<AiWriteReviewProposal | null> {
    return withFileLock(this.path, async () => {
      const current = await readProposalFile(this.path)
      const proposal = current.proposals.find((candidate) => candidate.id === id)
      if (!proposal) return null
      await writeProposalFile(this.path, {
        version: 1,
        proposals: current.proposals.filter((candidate) => candidate.id !== id)
      })
      return proposal
    })
  }
}
