import { buildContextBundle } from '../core/context'
import { parseFrontmatter } from '../core/frontmatter'
import { getOutgoingLinks } from '../core/links'
import { dirnameRelative } from '../core/paths'
import type { CompiledPathAliases } from '../core/path-aliases'
import { extractMarkdownTags } from '../core/tags'
import type { NoteDocument } from '../shared/types'

export type LinkRelationshipType =
  | 'project'
  | 'concept'
  | 'implementation'
  | 'source'
  | 'related_knowledge'
  | 'historical_context'
  | 'area'
  | 'moc'

export interface LinkCandidate {
  source: string
  target: string
  target_title: string
  reason: string
  confidence: number
  relationship_type: LinkRelationshipType
  already_linked: boolean
  evidence: string[]
}

export interface SuggestLinkOptions {
  maxCandidates?: number
  minConfidence?: number
}

interface WeightedEvidence {
  label: string
  weight: number
}

interface FenceState {
  character: '`' | '~'
  length: number
}

function openingFenceState(line: string): FenceState | null {
  const match = /^\s*(`{3,}|~{3,})/.exec(line)
  if (!match) {
    return null
  }
  return {
    character: match[1][0] as '`' | '~',
    length: match[1].length
  }
}

function isClosingFence(line: string, state: FenceState): boolean {
  const pattern =
    state.character === '`'
      ? /^\s*`{3,}\s*$/
      : /^\s*~{3,}\s*$/
  return pattern.test(line)
}

/** Returns true for lines that sit inside a fenced code block. */
function fenceMask(lines: string[]): boolean[] {
  const mask: boolean[] = []
  let active: FenceState | null = null
  for (const line of lines) {
    mask.push(active !== null)
    if (active) {
      if (isClosingFence(line, active)) {
        active = null
      }
    } else {
      const opening = openingFenceState(line)
      if (opening) {
        active = opening
      }
    }
  }
  return mask
}

/**
 * 弱い根拠(タグ・同一フォルダのみ)では高confidenceにならない重み設定。
 * 強い根拠(直接言及・build_context関連・同一プロジェクト)だけで 0.5 以上になる。
 */
const DIRECT_MENTION_WEIGHT = 0.6
const SHORT_NAME_MENTION_WEIGHT = 0.3
const PATH_MENTION_WEIGHT = 0.5
const CONTEXT_BACKLINK_WEIGHT = 0.55
const FRONTMATTER_PROJECT_WEIGHT = 0.5
const SAME_DIRECTORY_WEIGHT = 0.3
const SAME_AREA_FOLDER_WEIGHT = 0.25
const SHARED_TAG_WEIGHT = 0.2

function relationshipTypeFor(
  source: NoteDocument,
  target: NoteDocument
): LinkRelationshipType {
  const top = target.path.split('/')[0]
  const base: LinkRelationshipType = (() => {
    switch (top) {
      case '10_プロジェクト':
        return 'project'
      case '20_分野':
        return 'area'
      case '30_知識':
        return 'related_knowledge'
      case '40_情報源':
        return 'source'
      case '50_履歴':
        return 'historical_context'
      case '00_入口':
        return 'moc'
      default:
        return 'concept'
    }
  })()
  if (
    base === 'project' &&
    dirnameRelative(target.path) === dirnameRelative(source.path) &&
    source.content.toLocaleLowerCase().includes(target.name.toLocaleLowerCase())
  ) {
    return 'implementation'
  }
  return base
}

/**
 * あるノートに対するWikiリンク候補を、複数の証拠を組み合わせて提案する。
 * 既にリンク済みの相手・履歴ノートは候補から除外し、ノートは一切変更しない。
 */
export function suggestLinkCandidates(
  source: NoteDocument,
  notes: NoteDocument[],
  aliases?: CompiledPathAliases,
  options: SuggestLinkOptions = {}
): LinkCandidate[] {
  const maxCandidates = options.maxCandidates ?? 5
  const minConfidence = options.minConfidence ?? 0.55

  const sourceLower = source.content.toLocaleLowerCase()
  const sourceFrontmatter = parseFrontmatter(source.content)
  const sourceProject =
    sourceFrontmatter.attributes.project ??
    sourceFrontmatter.attributes.part_of ??
    null
  const sourceTags = new Set(
    extractMarkdownTags(source.content).map((tag) =>
      tag.toLocaleLowerCase()
    )
  )

  const outgoing = getOutgoingLinks(source.content, notes, aliases)
  const outgoingPaths = new Set(
    outgoing
      .map((link) => link.resolvedPath)
      .filter((path): path is string => Boolean(path))
      .map((path) => path.toLocaleLowerCase())
  )

  const bundle = buildContextBundle(source.path, notes, {
    maxCharacters: 6_000,
    maxOutgoing: 8,
    maxBacklinks: 8,
    pathAliases: aliases
  })
  const bundleByPath = new Map(
    bundle.included.map((item) => [item.path.toLocaleLowerCase(), item])
  )

  const sourceDirectory = dirnameRelative(source.path)
  const sourceTop = source.path.split('/')[0]
  const candidates: LinkCandidate[] = []

  for (const target of notes) {
    if (target.path === source.path) {
      continue
    }
    const targetLower = target.path.toLocaleLowerCase()
    if (outgoingPaths.has(targetLower)) {
      continue
    }
    if (
      target.path.startsWith('50_履歴/') ||
      target.path.startsWith('.tsuzune/') ||
      target.path.startsWith('.trash/')
    ) {
      continue
    }

    const evidence: WeightedEvidence[] = []
    const targetNameLower = target.name.toLocaleLowerCase()
    const targetPathKey = target.path
      .replace(/\.md$/i, '')
      .toLocaleLowerCase()

    const nameMentioned = sourceLower.includes(targetNameLower)
    if (targetNameLower.length >= 3 && nameMentioned) {
      evidence.push({ label: '本文で直接言及', weight: DIRECT_MENTION_WEIGHT })
    } else if (targetNameLower.length === 2 && nameMentioned) {
      evidence.push({
        label: '本文で短い名称に言及',
        weight: SHORT_NAME_MENTION_WEIGHT
      })
    }
    if (
      targetPathKey.length >= 4 &&
      sourceLower.includes(targetPathKey) &&
      !(targetNameLower.length >= 3 && nameMentioned)
    ) {
      evidence.push({ label: '本文でパス名に言及', weight: PATH_MENTION_WEIGHT })
    }

    const bundleEntry = bundleByPath.get(targetLower)
    if (bundleEntry) {
      evidence.push({
        label:
          bundleEntry.relation === 'backlink'
            ? 'build_contextで関連(バックリンク)'
            : 'build_contextで関連',
        weight: CONTEXT_BACKLINK_WEIGHT
      })
    }

    const targetFrontmatter = parseFrontmatter(target.content)
    const targetProject =
      targetFrontmatter.attributes.project ??
      targetFrontmatter.attributes.part_of ??
      null
    if (
      sourceProject &&
      targetProject &&
      sourceProject.toLocaleLowerCase() ===
        targetProject.toLocaleLowerCase()
    ) {
      evidence.push({
        label: '同一プロジェクト(frontmatter)',
        weight: FRONTMATTER_PROJECT_WEIGHT
      })
    }

    if (dirnameRelative(target.path) === sourceDirectory) {
      evidence.push({ label: '同一ディレクトリ', weight: SAME_DIRECTORY_WEIGHT })
    } else if (
      target.path.split('/')[0] === sourceTop &&
      (sourceTop === '10_プロジェクト' ||
        sourceTop === '20_分野' ||
        sourceTop === '30_知識')
    ) {
      evidence.push({
        label: '同一分野フォルダ',
        weight: SAME_AREA_FOLDER_WEIGHT
      })
    }

    const sharedTags = extractMarkdownTags(target.content)
      .map((tag) => tag.toLocaleLowerCase())
      .filter((tag) => sourceTags.has(tag))
    if (sharedTags.length > 0) {
      evidence.push({
        label: `共通タグ: ${sharedTags.slice(0, 3).join(', ')}`,
        weight: SHARED_TAG_WEIGHT
      })
    }

    if (evidence.length === 0) {
      continue
    }

    const confidence =
      1 -
      evidence.reduce(
        (remaining, item) => remaining * (1 - item.weight),
        1
      )
    if (confidence < minConfidence) {
      continue
    }

    evidence.sort((left, right) => right.weight - left.weight)
    candidates.push({
      source: source.path,
      target: target.path,
      target_title: target.name,
      reason: `${evidence[0].label} による関連候補`,
      confidence: Math.round(confidence * 100) / 100,
      relationship_type: relationshipTypeFor(source, target),
      already_linked: false,
      evidence: evidence.map((item) => item.label)
    })
  }

  candidates.sort(
    (left, right) =>
      right.confidence - left.confidence ||
      left.target.localeCompare(right.target, 'ja')
  )
  return candidates.slice(0, maxCandidates)
}

export interface LinkInsertPlan {
  newContent: string
  link: string
  insertedAt: number
  insertedText: string
  strategy: '関連行に追記' | '末尾に追加'
}

/**
 * TSUZUNE側で安全な挿入位置を決定してWikiリンク文字列を組み立てる。
 * 1) 既存の「関連:」行へ追記 2) コードフェンス外の末尾に「関連:」行を追加。
 */
export function buildLinkInsertPlan(
  markdown: string,
  targetPath: string
): LinkInsertPlan {
  const link = `[[${targetPath.replace(/\.md$/i, '').replaceAll('\\', '/')}]]`
  const lines = markdown.split('\n')
  const mask = fenceMask(lines)

  let offset = 0
  const lineOffsets: number[] = []
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (mask[index]) {
      continue
    }
    const trimmed = lines[index].trim()
    if (!/^関連[:：]/.test(trimmed)) {
      continue
    }
    const contentEnd = lineOffsets[index] + lines[index].trimEnd().length
    const connector = /^関連[:：]\s*$/.test(trimmed) ? ' ' : ' / '
    const insertedText = connector + link
    return {
      newContent:
        markdown.slice(0, contentEnd) +
        insertedText +
        markdown.slice(contentEnd),
      link,
      insertedAt: contentEnd,
      insertedText,
      strategy: '関連行に追記'
    }
  }

  let lastSafeIndex = lines.length - 1
  while (lastSafeIndex >= 0 && mask[lastSafeIndex]) {
    lastSafeIndex -= 1
  }
  const endOffset =
    lastSafeIndex < 0
      ? 0
      : lineOffsets[lastSafeIndex] + lines[lastSafeIndex].length
  const prefix = markdown.slice(0, endOffset)
  // 末尾追加: 空行で区切って「関連:」行を足し、ファイルは必ず改行で終える。
  const insertedText =
    (prefix.trim() === '' ? '' : '\n') + `関連: ${link}` + '\n'
  return {
    newContent: prefix + insertedText,
    link,
    insertedAt: endOffset,
    insertedText,
    strategy: '末尾に追加'
  }
}

/** 挿入位置を差し引いた本文が完全一致することを検証し、想定外の全置換を防ぐ。 */
export function assertOnlyLinkInserted(
  before: string,
  after: string,
  insertedAt: number,
  insertedText: string
): void {
  const reconstructed =
    after.slice(0, insertedAt) + after.slice(insertedAt + insertedText.length)
  if (reconstructed !== before) {
    throw new Error('リンク挿入以外の本文変更を検出しました。')
  }
}
