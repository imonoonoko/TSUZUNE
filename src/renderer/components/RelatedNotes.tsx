import type { NoteDocument, ResolvedWikiLink } from '../../shared/types'

interface RelatedNotesProps {
  outgoing: ResolvedWikiLink[]
  backlinks: NoteDocument[]
  temporal: React.ReactNode
  onOpen: (path: string) => void
  onMissing: (target: string) => void
}
function Section({
  title,
  children,
  empty
}: {
  title: string
  children: React.ReactNode
  empty: boolean
}): React.JSX.Element {
  return (
    <section className="related-section">
      <h2>{title}</h2>
      {empty ? <p className="related-empty">ありません</p> : children}
    </section>
  )
}

export default function RelatedNotes({
  outgoing,
  backlinks,
  temporal,
  onOpen,
  onMissing
}: RelatedNotesProps): React.JSX.Element {
  const resolved = outgoing.filter((link) => link.status === 'resolved')
  const missing = outgoing.filter((link) => link.status === 'missing')
  const ambiguous = outgoing.filter((link) => link.status === 'ambiguous')
  const invalid = outgoing.filter((link) => link.status === 'invalid')

  return (
    <aside className="related-panel" aria-label="関連ノート">
      {temporal}

      <Section title="リンク先" empty={resolved.length === 0}>
        {resolved.map((link) => (
          <button
            type="button"
            className="related-link"
            key={`resolved:${link.target}`}
            onClick={() => link.resolvedPath && onOpen(link.resolvedPath)}
          >
            {link.alias ?? link.target}
          </button>
        ))}
      </Section>

      <Section title="バックリンク" empty={backlinks.length === 0}>
        {backlinks.map((note) => (
          <button
            type="button"
            className="related-link"
            key={note.path}
            onClick={() => onOpen(note.path)}
          >
            {note.name}
            <small>{note.path}</small>
          </button>
        ))}
      </Section>

      <Section title="未作成" empty={missing.length === 0}>
        {missing.map((link) => (
          <button
            type="button"
            className="related-link is-warning"
            key={`missing:${link.target}`}
            onClick={() => onMissing(link.target)}
          >
            ＋ {link.alias ?? link.target}
          </button>
        ))}
      </Section>

      <Section title="曖昧" empty={ambiguous.length === 0}>
        {ambiguous.map((link) => (
          <div className="ambiguous-link" key={`ambiguous:${link.target}`}>
            <strong>{link.alias ?? link.target}</strong>
            <span>{link.candidates.length}件の候補</span>
            {link.candidates.map((candidate) => (
              <button type="button" key={candidate} onClick={() => onOpen(candidate)}>
                {candidate}
              </button>
            ))}
          </div>
        ))}
      </Section>

      {invalid.length > 0 && (
        <Section title="無効" empty={false}>
          {invalid.map((link) => (
            <div className="invalid-link" key={`invalid:${link.target}`}>
              <strong>{link.alias ?? link.target}</strong>
              <span>{link.reason}</span>
            </div>
          ))}
        </Section>
      )}
    </aside>
  )
}
