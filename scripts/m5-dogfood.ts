import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildContextBundle, type ContextBundle } from '../src/core/context'
import { getBacklinks, getOutgoingLinks } from '../src/core/links'
import {
  evaluateTemporal,
  parseTemporalNote
} from '../src/core/temporal'
import { VaultService } from '../src/main/vault'
import type { NoteDocument } from '../src/shared/types'

export interface M5EvaluationOptions {
  seedPaths: string[]
  currentAsOf: string
  pastAsOf: string
  generatedAt: string
}

export interface M5PeriodResult {
  markdown: string
  includedPaths: string[]
  futureLeakPaths: string[]
  unscopedNormalBodyPaths: string[]
  reviewWarningPaths: string[]
  resolvedProvenancePairs: string[]
  warningCodes: string[]
}

export interface M5ArmResult {
  current: M5PeriodResult
  past: M5PeriodResult
}

export interface M5EvaluationResult {
  options: M5EvaluationOptions
  arms: {
    seedOnly: M5ArmResult
    legacyOneHop: M5ArmResult
    temporal: M5ArmResult
  }
  safetyProbes: {
    conflictPreserved: boolean
    conflictWarningPresent: boolean
    unknownObservedAtOmitted: boolean
    unknownObservedAtWarningPresent: boolean
  }
}

interface RawPeriod {
  markdown: string
  includedPaths: string[]
  unscopedNormalBodyPaths: string[]
  warnings: ContextBundle['warnings']
  provenancePairs: string[]
}

const FIXED_QUESTIONS = [
  '現在動いているプロジェクトは何か。',
  '2026-07-22時点では何が動いていたか。',
  '再確認が必要な情報は何か。',
  'この状態を採用した根拠は何か。'
]

export const M5_SEED_PATHS = [
  '10_プロジェクト/TSUZUNE.md',
  '10_プロジェクト/ONOKO・CodexAtelier・Forest Room.md',
  '10_プロジェクト/宵灯工房.md'
]

export function evaluateM5Notes(
  notes: NoteDocument[],
  options: M5EvaluationOptions
): M5EvaluationResult {
  const seedCurrent = buildSeedOnly(notes, options.seedPaths)
  const seedPast = buildSeedOnly(notes, options.seedPaths)
  const legacyCurrent = buildLegacyOneHop(
    notes,
    options.seedPaths,
    options.generatedAt
  )
  const legacyPast = buildLegacyOneHop(
    notes,
    options.seedPaths,
    options.generatedAt
  )
  const temporalCurrent = buildTemporal(
    notes,
    options.seedPaths,
    options.currentAsOf,
    options.generatedAt
  )
  const temporalPast = buildTemporal(
    notes,
    options.seedPaths,
    options.pastAsOf,
    options.generatedAt
  )

  return {
    options,
    arms: {
      seedOnly: {
        current: analyzePeriod(seedCurrent, notes, options.currentAsOf),
        past: analyzePeriod(seedPast, notes, options.pastAsOf)
      },
      legacyOneHop: {
        current: analyzePeriod(
          legacyCurrent,
          notes,
          options.currentAsOf
        ),
        past: analyzePeriod(legacyPast, notes, options.pastAsOf)
      },
      temporal: {
        current: analyzePeriod(
          temporalCurrent,
          notes,
          options.currentAsOf
        ),
        past: analyzePeriod(temporalPast, notes, options.pastAsOf)
      }
    },
    safetyProbes: runSafetyProbes(options.generatedAt)
  }
}

function buildSeedOnly(
  notes: NoteDocument[],
  seedPaths: string[]
): RawPeriod {
  const selected = seedPaths.map((path) => requireNote(notes, path))
  return {
    markdown: selected
      .map((note) =>
        [
          'TSUZUNE_SOURCE_BEGIN',
          `## Source: ${note.name}`,
          `Path: ${note.path}`,
          'Relation: 起点のみ',
          '',
          note.content.trim(),
          '',
          'TSUZUNE_SOURCE_END'
        ].join('\n')
      )
      .join('\n\n'),
    includedPaths: selected.map((note) => note.path),
    unscopedNormalBodyPaths: selected
      .filter((note) => parseTemporalNote(note).kind === 'normal')
      .map((note) => note.path),
    warnings: [],
    provenancePairs: []
  }
}

function buildLegacyOneHop(
  notes: NoteDocument[],
  seedPaths: string[],
  generatedAt: string
): RawPeriod {
  const markdown: string[] = [
    '# TSUZUNE Legacy One-hop Context',
    '',
    `Generated: ${generatedAt}`,
    ''
  ]
  const includedPaths: string[] = []

  for (const seedPath of seedPaths) {
    const seed = requireNote(notes, seedPath)
    const candidates: Array<{
      note: NoteDocument
      relation: 'seed' | 'outgoing' | 'backlink'
    }> = [{ note: seed, relation: 'seed' }]
    const selected = new Set([seed.path])

    for (const link of getOutgoingLinks(seed.content, notes)) {
      if (
        candidates.filter((candidate) => candidate.relation === 'outgoing')
          .length >= 5
      ) {
        break
      }
      if (
        link.status !== 'resolved' ||
        !link.resolvedPath ||
        selected.has(link.resolvedPath)
      ) {
        continue
      }
      const note = notes.find((item) => item.path === link.resolvedPath)
      if (note) {
        selected.add(note.path)
        candidates.push({ note, relation: 'outgoing' })
      }
    }

    for (const note of getBacklinks(seed.path, notes).slice(0, 3)) {
      if (!selected.has(note.path)) {
        selected.add(note.path)
        candidates.push({ note, relation: 'backlink' })
      }
    }

    for (const candidate of candidates) {
      includedPaths.push(candidate.note.path)
      markdown.push(
        [
          `## Source: ${candidate.note.name}`,
          `Path: ${candidate.note.path}`,
          `Relation: ${candidate.relation}`,
          `Updated: ${new Date(candidate.note.modifiedAt).toISOString()}`,
          '',
          candidate.note.content.trim(),
          ''
        ].join('\n')
      )
    }
  }

  return {
    markdown: markdown.join('\n'),
    includedPaths: unique(includedPaths),
    unscopedNormalBodyPaths: unique(
      includedPaths.filter((path) => {
        const note = notes.find((candidate) => candidate.path === path)
        return !!note && parseTemporalNote(note).kind === 'normal'
      })
    ),
    warnings: [],
    provenancePairs: []
  }
}

function buildTemporal(
  notes: NoteDocument[],
  seedPaths: string[],
  asOf: string,
  generatedAt: string
): RawPeriod {
  const bundles = seedPaths.map((seedPath) =>
    buildContextBundle(seedPath, notes, {
      asOf,
      generatedAt,
      includeHistory: false
    })
  )

  return {
    markdown: bundles
      .map(
        (bundle, index) =>
          `# Project ${index + 1}\n\n${bundle.markdown}`
      )
      .join('\n\n'),
    includedPaths: unique(
      bundles.flatMap((bundle) =>
        bundle.included.map((source) => source.path)
      )
    ),
    unscopedNormalBodyPaths: unique(
      bundles.flatMap((bundle) =>
        bundle.included.flatMap((source) => {
          const note = notes.find(
            (candidate) => candidate.path === source.path
          )
          return note &&
            parseTemporalNote(note).kind === 'normal' &&
            !source.contentOmitted
            ? [source.path]
            : []
        })
      )
    ),
    warnings: bundles.flatMap((bundle) => bundle.warnings),
    provenancePairs: unique(
      bundles.flatMap((bundle) =>
        bundle.included.flatMap((source) =>
          source.provenance?.status === 'resolved' &&
          source.provenance.resolvedPath
            ? [`${source.path} -> ${source.provenance.resolvedPath}`]
            : []
        )
      )
    )
  }
}

function analyzePeriod(
  raw: RawPeriod,
  notes: NoteDocument[],
  asOf: string
): M5PeriodResult {
  const futureLeakPaths = raw.includedPaths.filter((path) => {
    const note = notes.find((candidate) => candidate.path === path)
    if (!note) {
      return false
    }
    const parsed = parseTemporalNote(note)
    if (!parsed.metadata) {
      return false
    }
    const evaluation = evaluateTemporal(parsed.metadata, asOf)
    return evaluation.kind === 'state'
      ? evaluation.phase === 'future'
      : evaluation.phase === 'future'
  })

  return {
    markdown: raw.markdown,
    includedPaths: raw.includedPaths,
    futureLeakPaths,
    unscopedNormalBodyPaths: raw.unscopedNormalBodyPaths,
    reviewWarningPaths: unique(
      raw.warnings.flatMap((warning) =>
        warning.code === 'REVIEW_DUE' && warning.path
          ? [warning.path]
          : []
      )
    ),
    resolvedProvenancePairs: raw.provenancePairs,
    warningCodes: raw.warnings.map((warning) => warning.code)
  }
}

function runSafetyProbes(
  generatedAt: string
): M5EvaluationResult['safetyProbes'] {
  const baseTime = '2026-07-31'
  const source = note(
    '40_情報源/安全性プローブ.md',
    '# 安全性プローブ'
  )
  const conflictSeed = note('検証/競合.md', '# 競合')
  const conflictA = note(
    '50_履歴/競合-active.md',
    temporalState({
      subject: '[[検証/競合]]',
      status: 'active',
      source: '[[40_情報源/安全性プローブ]]'
    })
  )
  const conflictB = note(
    '50_履歴/競合-frozen.md',
    temporalState({
      subject: '[[検証/競合]]',
      status: 'frozen',
      source: '[[40_情報源/安全性プローブ]]'
    })
  )
  const conflictBundle = buildContextBundle(
    conflictSeed.path,
    [conflictSeed, source, conflictA, conflictB],
    { asOf: baseTime, generatedAt }
  )

  const unknownSeed = note('検証/観測時刻不明.md', '# 観測時刻不明')
  const unknownState = note(
    '50_履歴/観測時刻不明-active.md',
    temporalState({
      subject: '[[検証/観測時刻不明]]',
      status: 'active',
      source: '[[40_情報源/安全性プローブ]]',
      observedAt: null
    })
  )
  const unknownBundle = buildContextBundle(
    unknownSeed.path,
    [unknownSeed, source, unknownState],
    {
      asOf: baseTime,
      generatedAt,
      temporalPerspective: 'knowledge-time'
    }
  )

  const conflictPaths = [conflictA.path, conflictB.path]
  return {
    conflictPreserved: conflictPaths.every((path) =>
      conflictBundle.included.some((source) => source.path === path)
    ),
    conflictWarningPresent: conflictBundle.warnings.some(
      (warning) => warning.code === 'CONFLICTING_CURRENT_STATES'
    ),
    unknownObservedAtOmitted: !unknownBundle.included.some(
      (entry) => entry.path === unknownState.path
    ),
    unknownObservedAtWarningPresent: unknownBundle.warnings.some(
      (warning) => warning.code === 'UNKNOWN_OBSERVED_AT'
    )
  }
}

function temporalState(input: {
  subject: string
  status: string
  source: string
  observedAt?: string | null
}): string {
  return [
    '---',
    'kind: state',
    `subject: "${input.subject}"`,
    `status: ${input.status}`,
    'valid_from: 2026-07-01',
    ...(input.observedAt === null
      ? []
      : [`observed_at: ${input.observedAt ?? '2026-07-01'}`]),
    `source: "${input.source}"`,
    '---',
    `# ${input.status}`
  ].join('\n')
}

function note(path: string, content: string): NoteDocument {
  const fileName = path.split('/').at(-1) ?? path
  return {
    path,
    name: fileName.replace(/\.md$/i, ''),
    content,
    modifiedAt: Date.parse('2026-07-31T03:00:00+09:00'),
    size: Buffer.byteLength(content)
  }
}

function requireNote(notes: NoteDocument[], path: string): NoteDocument {
  const found = notes.find((note) => note.path === path)
  if (!found) {
    throw new Error(`M5の起点ノートが見つかりません: ${path}`)
  }
  return found
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, 'ja')
  )
}

export function parseM5Arguments(args: string[]): {
  vault: string
  output: string
  currentAsOf: string
  pastAsOf: string
} {
  if (args[0] && !args[0].startsWith('--')) {
    return {
      vault: resolve(args[0]),
      currentAsOf: args[1] ?? '2026-07-31',
      pastAsOf: args[2] ?? '2026-07-22',
      output: resolve(args[3] ?? 'work/m5-dogfood')
    }
  }

  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith('--') || !value) {
      throw new Error(
        'Usage: --vault <path> [--output <path>] [--current <date>] [--past <date>]'
      )
    }
    values.set(key, value)
  }

  const vault = values.get('--vault')
  if (!vault) {
    throw new Error('--vault is required.')
  }
  return {
    vault: resolve(vault),
    output: resolve(values.get('--output') ?? 'work/m5-dogfood'),
    currentAsOf: values.get('--current') ?? '2026-07-31',
    pastAsOf: values.get('--past') ?? '2026-07-22'
  }
}

export async function runM5Dogfood(args: string[]): Promise<void> {
  const options = parseM5Arguments(args)
  const vault = new VaultService()
  await vault.setRootPath(options.vault)
  const snapshot = await vault.scan()
  const generatedAt = '2026-07-31T03:00:00+09:00'
  const result = evaluateM5Notes(snapshot.notes, {
    seedPaths: M5_SEED_PATHS,
    currentAsOf: options.currentAsOf,
    pastAsOf: options.pastAsOf,
    generatedAt
  })

  await mkdir(options.output, { recursive: true })
  const armFiles: Array<{
    fileName: string
    title: string
    arm: M5ArmResult
  }> = [
    {
      fileName: 'A-seed-only.md',
      title: 'A: 起点ノートだけ',
      arm: result.arms.seedOnly
    },
    {
      fileName: 'B-legacy-one-hop.md',
      title: 'B: 従来の1段リンクContext',
      arm: result.arms.legacyOneHop
    },
    {
      fileName: 'C-temporal.md',
      title: 'C: 時間対応Context',
      arm: result.arms.temporal
    }
  ]

  for (const output of armFiles) {
    await writeFile(
      resolve(options.output, output.fileName),
      armDocument(output.title, output.arm, result.options),
      'utf8'
    )
  }

  const metrics = {
    options: result.options,
    arms: Object.fromEntries(
      Object.entries(result.arms).map(([name, arm]) => [
        name,
        {
          current: withoutMarkdown(arm.current),
          past: withoutMarkdown(arm.past)
        }
      ])
    ),
    safetyProbes: result.safetyProbes
  }
  await writeFile(
    resolve(options.output, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    resolve(options.output, 'README.md'),
    summaryDocument(result),
    'utf8'
  )

  process.stdout.write(
    `${JSON.stringify(
      {
        output: options.output,
        temporalPastFutureLeaks:
          result.arms.temporal.past.futureLeakPaths.length,
        temporalPastUnscopedNormalBodies:
          result.arms.temporal.past.unscopedNormalBodyPaths.length,
        legacyPastFutureLeaks:
          result.arms.legacyOneHop.past.futureLeakPaths.length,
        legacyPastUnscopedNormalBodies:
          result.arms.legacyOneHop.past.unscopedNormalBodyPaths.length,
        temporalReviewWarnings:
          result.arms.temporal.current.reviewWarningPaths.length,
        safetyProbes: result.safetyProbes
      },
      null,
      2
    )}\n`
  )
}

function withoutMarkdown(
  period: M5PeriodResult
): Omit<M5PeriodResult, 'markdown'> {
  const { markdown: _markdown, ...metrics } = period
  return metrics
}

function armDocument(
  title: string,
  arm: M5ArmResult,
  options: M5EvaluationOptions
): string {
  return [
    `# ${title}`,
    '',
    'このファイルだけを根拠として回答する。一般知識や他ファイルを補わない。',
    '根拠がなければ「不明」、再確認期限超過なら「要再確認」と明記する。',
    '競合する状態があれば両方を示し、一方へ勝手に確定しない。',
    '',
    `## 現在用資料（${options.currentAsOf}）`,
    '',
    arm.current.markdown,
    '',
    `## 過去時点用資料（${options.pastAsOf}）`,
    '',
    arm.past.markdown,
    '',
    '## 固定質問',
    '',
    ...FIXED_QUESTIONS.map((question, index) => `${index + 1}. ${question}`),
    '',
    '各回答の末尾に、根拠にしたノートのPathを列挙する。',
    ''
  ].join('\n')
}

function summaryDocument(result: M5EvaluationResult): string {
  const rows = Object.entries(result.arms).map(([name, arm]) => {
    return `| ${name} | ${arm.past.futureLeakPaths.length} | ${arm.past.unscopedNormalBodyPaths.length} | ${arm.current.reviewWarningPaths.length} | ${arm.current.resolvedProvenancePairs.length} |`
  })
  return [
    '# M5 Temporal Memory Lite dogfood',
    '',
    '| Arm | 過去への時間ノート未来漏洩 | 過去へ露出した時間未指定本文 | 現在の再確認警告 | 解決済み出典 |',
    '|---|---:|---:|---:|---:|',
    ...rows,
    '',
    'Safety probes:',
    '',
    ...Object.entries(result.safetyProbes).map(
      ([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'}: ${name}`
    ),
    '',
    '注意: これはContext選定の機械判定であり、固定4問の回答品質は各Armを新規Codexへ渡して別途採点する。',
    ''
  ].join('\n')
}
