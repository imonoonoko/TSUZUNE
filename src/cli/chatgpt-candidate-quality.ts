import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ChatGptCandidate, ChatGptCandidateInputMessage } from '../core/chatgpt-candidates'
import {
  buildChatGptCandidateQualitySample,
  type ChatGptCandidateReview
} from '../core/chatgpt-candidate-quality'

interface CandidateQualityOptions {
  candidateDirectory: string
  sourceDirectory: string
  outputDirectory: string
  vaultRoot: string
  reviewPath?: string
}

function parseArgument(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (required && !value) throw new TypeError(`Missing required argument: ${name}`)
  return value
}

function assertOutsideRoot(path: string, root: string): void {
  const relation = relative(resolve(root), resolve(path))
  if (relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))) {
    throw new Error('Candidate quality output must stay outside the TSUZUNE Vault.')
  }
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf8')
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T)
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporary = `${path}.tmp`
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, path)
}

function report(result: ReturnType<typeof buildChatGptCandidateQualitySample>): string {
  const ruleRows = result.review.ruleResults.map((item) =>
    `| ${item.rule} | ${item.reviewedCount} | ${item.precision === null ? '-' : `${(item.precision * 100).toFixed(1)}%`} | ${item.passed ? 'PASS' : 'HOLD'} |`
  ).join('\n')
  return `# ChatGPT Candidate Quality Calibration\n\n`+
    `- Candidate: ${result.audit.candidateCount}\n`+
    `- Sample: ${result.audit.sampleCount}\n`+
    `- Source trace: ${(result.audit.sourceTraceRate * 100).toFixed(1)}%\n`+
    `- Contamination: ${result.audit.contaminationCount}\n`+
    `- Sensitive auto-active: ${result.audit.sensitiveAutoActiveCount}\n`+
    `- Reviewed: ${result.review.reviewedCount}/${result.audit.sampleCount}\n`+
    `- Passed rules: ${result.review.passedRules.length === 0 ? 'none' : result.review.passedRules.join(', ')}\n\n`+
    `| Rule | Reviewed | Precision | Gate |\n|---|---:|---:|---|\n${ruleRows}\n\n`+
    `Sample claims and review notes remain in this local staging directory and must not be committed.\n`
}

export async function runCandidateQuality(options: CandidateQualityOptions) {
  assertOutsideRoot(options.outputDirectory, options.vaultRoot)
  const candidates = await readJsonLines<ChatGptCandidate>(join(options.candidateDirectory, 'candidates.jsonl'))
  const messages = await readJsonLines<ChatGptCandidateInputMessage>(join(options.sourceDirectory, 'messages.jsonl'))
  const reviews = options.reviewPath ? await readJsonLines<ChatGptCandidateReview>(options.reviewPath) : []
  const result = buildChatGptCandidateQualitySample(candidates, messages, reviews)
  await mkdir(options.outputDirectory, { recursive: true })
  const sampleJsonl = result.sample.map((item) => JSON.stringify(item)).join('\n') + '\n'
  const reviewTemplate = result.sample.map((item) => JSON.stringify({
    candidateId: item.candidateId,
    verdict: null,
    activeMemorySafe: false,
    reason: ''
  })).join('\n') + '\n'
  const publicSummary = {
    schemaVersion: result.schemaVersion,
    qualityVersion: result.qualityVersion,
    audit: result.audit,
    review: result.review,
    contentDigest: result.contentDigest
  }
  await atomicWrite(join(options.outputDirectory, 'quality-sample.jsonl'), sampleJsonl)
  await atomicWrite(join(options.outputDirectory, 'quality-review-template.jsonl'), reviewTemplate)
  await atomicWrite(join(options.outputDirectory, 'quality-summary.json'), `${JSON.stringify(publicSummary, null, 2)}\n`)
  await atomicWrite(join(options.outputDirectory, 'quality-report.md'), report(result))
  return result
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  const candidateDirectory = parseArgument('--candidates')!
  const sourceDirectory = parseArgument('--source')!
  const outputDirectory = parseArgument('--output')!
  const vaultRoot = parseArgument('--vault-root')!
  const reviewPath = parseArgument('--reviews', false)
  await runCandidateQuality({ candidateDirectory, sourceDirectory, outputDirectory, vaultRoot, reviewPath })
}
