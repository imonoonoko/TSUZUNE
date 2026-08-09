import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCandidateQuality } from '../src/cli/chatgpt-candidate-quality'

describe('ChatGPT candidate quality CLI', () => {
  it('writes deterministic local-only calibration artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-c1b-'))
    const candidateDirectory = join(root, 'candidates')
    const sourceDirectory = join(root, 'source')
    const vaultRoot = join(root, 'vault')
    const output1 = join(root, 'out-1')
    const output2 = join(root, 'out-2')
    await Promise.all([candidateDirectory, sourceDirectory, vaultRoot].map((path) => mkdir(path, { recursive: true })))
    const source = {
      conversationId: 'conversation', messageId: 'message', recordId: 'record', sha256: 'sha',
      sourceId: 'source', sourceSha256: 'source-sha', sourceEntryPath: 'conversations.json',
      branch: 'current', role: 'user', contentKind: 'text', text: '私はローカルソフトを使っている。',
      createdAtUnixSeconds: 1, privacyReviewRequired: false, candidateEligible: true
    }
    const candidate = {
      candidateId: 'candidate', ruleVersion: 'rule', claimText: source.text, claimSha256: 'claim-sha',
      labels: ['current_profile'], temporalStatus: 'current_candidate', privacyReviewRequired: false,
      correctionSignal: false, extractionRules: ['profile.explicit_self_statement'],
      sourceReferences: [{
        conversationId: source.conversationId, messageId: source.messageId, messageRecordId: source.recordId,
        messageSha256: source.sha256, sourceId: source.sourceId, sourceSha256: source.sourceSha256,
        sourceEntryPath: source.sourceEntryPath, createdAtUnixSeconds: source.createdAtUnixSeconds
      }],
      profileDiff: { status: 'new_candidate', targetProfileIds: ['本人プロフィール'], matchingProfileIds: [] }
    }
    await writeFile(join(sourceDirectory, 'messages.jsonl'), `${JSON.stringify(source)}\n`)
    await writeFile(join(candidateDirectory, 'candidates.jsonl'), `${JSON.stringify(candidate)}\n`)

    const first = await runCandidateQuality({ candidateDirectory, sourceDirectory, outputDirectory: output1, vaultRoot })
    const second = await runCandidateQuality({ candidateDirectory, sourceDirectory, outputDirectory: output2, vaultRoot })
    expect(second.contentDigest).toBe(first.contentDigest)
    expect(await readFile(join(output2, 'quality-sample.jsonl'), 'utf8')).toBe(await readFile(join(output1, 'quality-sample.jsonl'), 'utf8'))
    const summary = JSON.parse(await readFile(join(output1, 'quality-summary.json'), 'utf8'))
    expect(summary.audit.sourceTraceRate).toBe(1)
  })

  it('refuses to write inside the Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tsuzune-c1b-vault-'))
    const vaultRoot = join(root, 'vault')
    await mkdir(vaultRoot, { recursive: true })
    await expect(runCandidateQuality({
      candidateDirectory: root,
      sourceDirectory: root,
      outputDirectory: join(vaultRoot, 'quality'),
      vaultRoot
    })).rejects.toThrow('outside the TSUZUNE Vault')
  })
})
