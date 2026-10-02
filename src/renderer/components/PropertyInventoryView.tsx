import { useMemo, useState } from 'react'
import { inspectFrontmatterProperty, parseFrontmatter } from '../../core/frontmatter'
import { readPropertyAsDeclared } from '../../core/property-changes'
import type { PropertyDeclaredType } from '../../shared/property-changes'
import type { NoteDocument } from '../../shared/types'
import type {
  ObservedPropertyShape,
  PropertyInventory,
  PropertyInventoryEntry,
  PropertyInventoryStatus
} from '../../core/property-inventory'

type PropertyInventoryViewProps = {
  inventory: PropertyInventory
  onOpenNote: (path: string) => void
  notes?: readonly NoteDocument[]
  declaredTypes?: Record<string, PropertyDeclaredType>
  onDeclare?: (name: string, type: PropertyDeclaredType | null) => Promise<void>
  onManage?: (name: string) => void
  disabled?: boolean
}

type SortMode = 'name' | 'usage'

const shapeOrder: ObservedPropertyShape[] = [
  'text',
  'number',
  'checkbox',
  'list',
  'null',
  'unsupported',
  'malformed'
]

const shapeLabels: Record<ObservedPropertyShape, string> = {
  text: 'テキスト',
  number: '数値',
  checkbox: 'チェックボックス',
  list: 'リスト',
  null: '空値',
  unsupported: '未対応',
  malformed: '不正な形式'
}

const statusLabels: Record<PropertyInventoryStatus, string> = {
  consistent: '観測済み',
  'empty-values': '空値あり',
  'mixed-types': '型混在',
  unsupported: '解析不可',
  malformed: '解析不可'
}

const declaredLabels: Record<PropertyDeclaredType, string> = {
  text: 'テキスト', number: '数値', checkbox: 'チェックボックス',
  list: 'リスト', date: '日付', datetime: '日時'
}

function isEmptySource(markdown: string, name: string): boolean {
  const frontmatter = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1]
  if (!frontmatter) return false
  const lines = frontmatter.split(/\r?\n/)
  const index = lines.findIndex((line) => line.startsWith(`${name}:`))
  if (index < 0) return false
  const raw = lines[index].slice(name.length + 1).trim().split(/\s+#/)[0].trim()
  if (raw === 'null' || raw === '~') return true
  if (raw && !raw.startsWith('#')) return false
  const next = lines.slice(index + 1).find((line) => line.trim() && !line.trimStart().startsWith('#'))
  return !next || /^[A-Za-z_][A-Za-z0-9_-]*:/.test(next)
}

function issuePaths(name: string, notes: readonly NoteDocument[], declaredType?: PropertyDeclaredType): {
  mismatch: string[]; empty: string[]; unsupported: string[]
} {
  const paths = { mismatch: [] as string[], empty: [] as string[], unsupported: [] as string[] }
  for (const note of notes) {
    const parsed = parseFrontmatter(note.content)
    if (!Object.prototype.hasOwnProperty.call(parsed.attributes, name)) continue
    if (parsed.warnings.length) {
      paths.unsupported.push(note.path)
      continue
    }
    const inspection = inspectFrontmatterProperty(note.content, name)
    if (!inspection.ok) {
      paths[parsed.attributes[name] === null && isEmptySource(note.content, name) ? 'empty' : 'unsupported'].push(note.path)
    } else if (inspection.property === null ||
      (inspection.property.type === 'list' && inspection.property.value.length === 0)) {
      paths.empty.push(note.path)
    } else if (declaredType && readPropertyAsDeclared(inspection.property, declaredType)?.type !== declaredType) {
      paths.mismatch.push(note.path)
    }
  }
  return paths
}

function shapeText(entry: PropertyInventoryEntry): string {
  return shapeOrder
    .filter((shape) => (entry.shapeCounts[shape] ?? 0) > 0)
    .map((shape) => `${shapeLabels[shape]} ${entry.shapeCounts[shape]}`)
    .join('、')
}

export default function PropertyInventoryView({
  inventory,
  onOpenNote,
  notes = [],
  declaredTypes = {},
  onDeclare,
  onManage,
  disabled = false
}: PropertyInventoryViewProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [savingName, setSavingName] = useState<string | null>(null)
  const [declareError, setDeclareError] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const entries = useMemo(() => {
    const filtered = inventory.entries.filter((entry) =>
      entry.name.toLocaleLowerCase().includes(normalizedQuery)
    )
    return [...filtered].sort((left, right) => {
      if (sortMode === 'usage' && right.noteCount !== left.noteCount) {
        return right.noteCount - left.noteCount
      }
      return left.name.localeCompare(right.name, 'ja')
    })
  }, [inventory.entries, normalizedQuery, sortMode])

  return (
    <section className="property-inventory-panel" aria-label="プロパティ一覧">
      <header className="property-inventory-header">
        <div>
          <h2>プロパティ一覧</h2>
          <p>可視ノート {inventory.noteCount}件・Properties使用ノート {inventory.frontmatterNoteCount}件</p>
        </div>
        <span className="property-inventory-scope">可視スナップショット</span>
      </header>
      <div className="property-inventory-toolbar">
        <label>
          Property名を検索
          <input
            type="search"
            aria-label="Property名を検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Property名"
          />
        </label>
        <label>
          並び順
          <select
            aria-label="並び順"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="name">Property名</option>
            <option value="usage">使用ノート数</option>
          </select>
        </label>
      </div>
      {entries.length === 0 ? (
        <p className="property-inventory-empty" role="status">一致するPropertyはありません。</p>
      ) : (
        <div className="property-inventory-table" role="table" aria-label="Property一覧">
          <div className="property-inventory-row property-inventory-heading" role="row">
            <span role="columnheader">Property名</span>
            <span role="columnheader">使用ノート数</span>
            <span role="columnheader">観測形状</span>
            <span role="columnheader">宣言型</span>
            <span role="columnheader">状態</span>
          </div>
          {entries.map((entry) => {
            const expanded = selectedName === entry.name
            const declaredType = declaredTypes[entry.name]
            const issues = expanded ? issuePaths(entry.name, notes, declaredType) : null
            return (
              <div key={entry.name}>
                <div className="property-inventory-row" role="row">
                  <span role="cell">
                    <button
                      type="button"
                      className="property-inventory-name"
                      aria-expanded={expanded}
                      aria-label={`${entry.name}のサンプルを${expanded ? '閉じる' : '表示'}`}
                      onClick={() => setSelectedName(expanded ? null : entry.name)}
                    >
                      {entry.name}
                    </button>
                  </span>
                  <span role="cell">{entry.noteCount}</span>
                  <span role="cell">{shapeText(entry)}</span>
                  <span role="cell">{declaredType ? declaredLabels[declaredType] : '未指定'}</span>
                  <span role="cell" aria-label={`状態: ${statusLabels[entry.status]}`}>
                    {statusLabels[entry.status]}
                  </span>
                </div>
                {expanded && (
                  <div className="property-inventory-samples" role="region" aria-label={`${entry.name}のサンプルノート`}>
                    {onDeclare ? (
                      <label>
                        {entry.name}の宣言型
                        <select aria-label={`${entry.name}の宣言型`} value={declaredType ?? ''}
                          disabled={disabled || savingName !== null}
                          onChange={(event) => {
                            const type = event.target.value as PropertyDeclaredType | ''
                            setSavingName(entry.name)
                            setDeclareError(null)
                            void onDeclare(entry.name, type || null).catch((error: unknown) => {
                              setDeclareError(error instanceof Error ? error.message : '宣言型を保存できませんでした。')
                            }).finally(() => setSavingName(null))
                          }}>
                          <option value="">未指定</option>
                          {Object.entries(declaredLabels).map(([type, label]) =>
                            <option key={type} value={type}>{label}</option>
                          )}
                        </select>
                      </label>
                    ) : null}
                    {declareError ? <span role="alert">{declareError}</span> : null}
                    {onManage ? <button type="button" disabled={disabled}
                      onClick={() => onManage(entry.name)}>{entry.name}を管理</button> : null}
                    <span>サンプルノート（最大5件）</span>
                    <div>
                      {entry.samplePaths.map((path) => (
                        <button
                          type="button"
                          className="property-inventory-sample"
                          key={path}
                          onClick={() => onOpenNote(path)}
                        >
                          {path}
                        </button>
                      ))}
                    </div>
                    {issues ? ([
                      ['mismatch', '宣言型と異なる値'],
                      ['empty', '空値'],
                      ['unsupported', '解析できない値']
                    ] as const).map(([kind, label]) => (
                      <div key={kind}>
                        <span>{label} {issues[kind].length}件</span>
                        {issues[kind].map((path) => <button type="button" key={path}
                          className="property-inventory-sample" onClick={() => onOpenNote(path)}>{path}</button>)}
                      </div>
                    )) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
