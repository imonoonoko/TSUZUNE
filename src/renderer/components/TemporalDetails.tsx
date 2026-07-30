import {
  buildTemporalTimeline,
  parseTemporalNote,
  type TemporalTimelineEntry,
  type TemporalWarning
} from '../../core/temporal'
import type { NoteDocument } from '../../shared/types'

interface TemporalDetailsProps {
  selectedNote: NoteDocument
  notes: NoteDocument[]
  asOf: string
}

function subjectFor(
  selectedNote: NoteDocument,
  parsed: ReturnType<typeof parseTemporalNote>
): string {
  if (parsed.metadata) {
    return parsed.metadata.subject
  }
  return `[[${selectedNote.path.replace(/\.md$/i, '')}]]`
}

function noteName(path: string): string {
  return (path.split('/').at(-1) ?? path).replace(/\.md$/i, '')
}

function phaseLabel(entry: TemporalTimelineEntry): string {
  if (entry.evaluation.kind === 'event') {
    return entry.evaluation.phase === 'future' ? '未来' : '発生済み'
  }
  switch (entry.evaluation.phase) {
    case 'historical':
      return '過去'
    case 'future':
      return '未来'
    default:
      return '現在'
  }
}

function entryValue(entry: TemporalTimelineEntry): string {
  return entry.metadata.kind === 'state'
    ? entry.metadata.status
    : entry.metadata.event
}

function entryDate(entry: TemporalTimelineEntry): string {
  if (entry.metadata.kind === 'event') {
    return entry.metadata.occurredAt
  }
  return entry.metadata.validTo
    ? `${entry.metadata.validFrom} – ${entry.metadata.validTo}`
    : `${entry.metadata.validFrom} –`
}

function warningKey(warning: TemporalWarning, index: number): string {
  return `${warning.code}:${warning.field ?? ''}:${index}`
}

function warningMessage(warning: TemporalWarning): string {
  switch (warning.code) {
    case 'MALFORMED_FRONTMATTER':
      return 'frontmatterの区切りまたは書式を確認してください。'
    case 'MISSING_FIELD':
      return '必須項目です。'
    case 'INVALID_INTERVAL':
      return '終了日は開始日より後にしてください。'
    case 'UNRESOLVED_LINK':
      return 'リンク先を確認できません。'
    case 'INVALID_FIELD':
      if (
        warning.field &&
        [
          'valid_from',
          'valid_to',
          'occurred_at',
          'observed_at',
          'verified_at',
          'review_after'
        ].includes(warning.field)
      ) {
        return '日付またはタイムゾーン付き時刻の形式が正しくありません。'
      }
      return '値の形式が正しくありません。'
  }
}

export default function TemporalDetails({
  selectedNote,
  notes,
  asOf
}: TemporalDetailsProps): React.JSX.Element {
  const parsed = parseTemporalNote(selectedNote)
  const timeline = buildTemporalTimeline(
    subjectFor(selectedNote, parsed),
    notes,
    asOf
  )
  const warnings = [
    ...parsed.warnings,
    ...timeline.flatMap((entry) =>
      entry.path === selectedNote.path ? [] : entry.warnings
    )
  ]
  const incomplete =
    (parsed.kind !== 'normal' && !parsed.metadata) ||
    parsed.warnings.length > 0

  return (
    <section
      className="related-section temporal-details"
      aria-labelledby="temporal-details-heading"
    >
      <h2 id="temporal-details-heading">時間情報</h2>
      <p className="temporal-as-of">基準日 {asOf}</p>

      {incomplete && (
        <p className="temporal-incomplete">
          メタデータ不完全。本文の編集は続けられます。
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="temporal-warnings" aria-label="時間情報の警告">
          {warnings.map((warning, index) => (
            <li key={warningKey(warning, index)}>
              {warning.field ? `${warning.field}: ` : ''}
              {warningMessage(warning)}
            </li>
          ))}
        </ul>
      )}

      {timeline.length === 0 ? (
        <p className="related-empty">時間情報はありません</p>
      ) : (
        <ul className="temporal-list">
          {timeline.map((entry) => (
            <li className="temporal-entry" key={entry.path}>
              <strong>{noteName(entry.path)}</strong>
              <span className="temporal-entry-value">{entryValue(entry)}</span>
              <span className="temporal-entry-date">{entryDate(entry)}</span>
              <span className="temporal-badges">
                <span>{phaseLabel(entry)}</span>
                {entry.evaluation.kind === 'state' &&
                  entry.evaluation.reviewDue && <span>再確認期限超過</span>}
                {entry.supersededBy.length > 0 && <span>置き換え済み</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
