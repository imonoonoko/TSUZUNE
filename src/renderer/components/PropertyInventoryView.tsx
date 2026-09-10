import { useMemo, useState } from 'react'
import type {
  ObservedPropertyShape,
  PropertyInventory,
  PropertyInventoryEntry,
  PropertyInventoryStatus
} from '../../core/property-inventory'

type PropertyInventoryViewProps = {
  inventory: PropertyInventory
  onOpenNote: (path: string) => void
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

function shapeText(entry: PropertyInventoryEntry): string {
  return shapeOrder
    .filter((shape) => (entry.shapeCounts[shape] ?? 0) > 0)
    .map((shape) => `${shapeLabels[shape]} ${entry.shapeCounts[shape]}`)
    .join('、')
}

export default function PropertyInventoryView({
  inventory,
  onOpenNote
}: PropertyInventoryViewProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [selectedName, setSelectedName] = useState<string | null>(null)
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
            <span role="columnheader">状態</span>
          </div>
          {entries.map((entry) => {
            const expanded = selectedName === entry.name
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
                  <span role="cell" aria-label={`状態: ${statusLabels[entry.status]}`}>
                    {statusLabels[entry.status]}
                  </span>
                </div>
                {expanded && (
                  <div className="property-inventory-samples" role="region" aria-label={`${entry.name}のサンプルノート`}>
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
