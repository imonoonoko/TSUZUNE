import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCandidatePreview } from '../src/cli/chatgpt-candidate-preview'
import { CHATGPT_PROFILE_IDS } from '../src/core/chatgpt-candidates'

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('ChatGPT candidate preview CLI core', () => {
  it('writes deterministic local preview files without changing C0-A or Vault sources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-c1a-'))
    const input = join(root, 'c0')
    const vault = join(root, 'vault')
    const profileDirectory = join(vault, '20_分野')
    const output1 = join(root, 'c1-run-1')
    const output2 = join(root, 'c1-run-2')
    await mkdir(input, { recursive: true })
    await mkdir(profileDirectory, { recursive: true })

    const messages = [
      {
        conversationId: 'conversation-1',
        messageId: 'message-1',
        recordId: 'record-1',
        sha256: 'message-sha',
        sourceId: 'source-1',
        sourceSha256: 'source-sha',
        sourceEntryPath: 'conversations.json',
        branch: 'current',
        role: 'user',
        contentKind: 'text',
        text: 'TSUZUNEを最優先で開発する。',
        createdAtUnixSeconds: 1,
        privacyReviewRequired: false,
        candidateEligible: true
      }
    ]
    await writeFile(join(input, 'messages.jsonl'), `${messages.map((item) => JSON.stringify(item)).join('\n')}\n`)
    await writeFile(join(input, 'manifest.json'), `${JSON.stringify({
      schemaVersion: 1,
      provider: 'openai_chatgpt_export',
      contentDigest: 'c0-digest',
      stats: { candidateEligibleMessageCount: 1 }
    })}\n`)

    const profiles = []
    for (const profileId of CHATGPT_PROFILE_IDS) {
      const path = join(profileDirectory, `${profileId}.md`)
      await writeFile(path, `# ${profileId}\n`)
      profiles.push({ profileId, path })
    }
    const sourcePaths = [
      join(input, 'manifest.json'),
      join(input, 'messages.jsonl'),
      ...profiles.map(({ path }) => path)
    ]
    const before = await Promise.all(sourcePaths.map(async (path) => sha256(await readFile(path))))

    const first = await runCandidatePreview({ inputDirectory: input, outputDirectory: output1, vaultRoot: vault, profiles })
    const second = await runCandidatePreview({ inputDirectory: input, outputDirectory: output2, vaultRoot: vault, profiles })
    const after = await Promise.all(sourcePaths.map(async (path) => sha256(await readFile(path))))

    expect(second.contentDigest).toBe(first.contentDigest)
    expect(await readFile(join(output2, 'candidates.jsonl'), 'utf8')).toBe(
      await readFile(join(output1, 'candidates.jsonl'), 'utf8')
    )
    expect(after).toEqual(before)
    const summary = JSON.parse(await readFile(join(output1, 'candidate-summary.json'), 'utf8')) as Record<string, unknown>
    expect(summary.vaultWriteCount).toBe(0)
  })

  it('refuses to write preview output inside the Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-c1a-vault-'))
    const input = join(root, 'c0')
    const vault = join(root, 'vault')
    await mkdir(input, { recursive: true })
    await mkdir(vault, { recursive: true })

    await expect(runCandidatePreview({
      inputDirectory: input,
      outputDirectory: join(vault, 'generated'),
      vaultRoot: vault,
      profiles: []
    })).rejects.toThrow('outside the TSUZUNE Vault')
  })
})
