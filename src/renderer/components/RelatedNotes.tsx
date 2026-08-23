import { useState } from 'react'
import type { NoteDocument, ResolvedWikiLink } from '../../shared/types'

interface RelatedNotesProps {
  outgoing: ResolvedWikiLink[]
  backlinks: NoteDocument[]
  temporal: React.ReactNode
  onOpen: (path: string) => void
  onMissing: (target: string) => void
}

const contextTabs = ['links', 'backlinks', 'temporal'] as const
type ContextTab = (typeof contextTabs)[number]

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
  const [activeTab, setActiveTab] = useState<ContextTab>('links')
  const resolved = outgoing.filter((link) => link.status === 'resolved')
  const missing = outgoing.filter((link) => link.status === 'missing')
  const ambiguous = outgoing.filter((link) => link.status === 'ambiguous')
  const invalid = outgoing.filter((link) => link.status === 'invalid')

  const selectTabFromKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const currentIndex = contextTabs.indexOf(activeTab)
    let nextIndex: number | null = null

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % contextTabs.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + contextTabs.length) % contextTabs.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = contextTabs.length - 1
        break
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = contextTabs[nextIndex]
    setActiveTab(nextTab)
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#context-tab-${nextTab}`)
      ?.focus()
  }

  return (
    <aside className="related-panel" aria-label="ノートの文脈">
      <div className="related-panel-tabs" role="tablist" aria-label="ノートの文脈">
        <button
          type="button"
          id="context-tab-links"
          className="related-panel-tab"
          role="tab"
          aria-label={`リンク ${outgoing.length}件`}
          aria-selected={activeTab === 'links'}
          aria-controls="context-panel-links"
          tabIndex={activeTab === 'links' ? 0 : -1}
          onClick={() => setActiveTab('links')}
          onKeyDown={selectTabFromKeyboard}
        >
          リンク <span aria-hidden="true">{outgoing.length}</span>
        </button>
        <button
          type="button"
          id="context-tab-backlinks"
          className="related-panel-tab"
          role="tab"
          aria-label={`バックリンク ${backlinks.length}件`}
          aria-selected={activeTab === 'backlinks'}
          aria-controls="context-panel-backlinks"
          tabIndex={activeTab === 'backlinks' ? 0 : -1}
          onClick={() => setActiveTab('backlinks')}
          onKeyDown={selectTabFromKeyboard}
        >
          バックリンク <span aria-hidden="true">{backlinks.length}</span>
        </button>
        <button
          type="button"
          id="context-tab-temporal"
          className="related-panel-tab"
          role="tab"
          aria-selected={activeTab === 'temporal'}
          aria-controls="context-panel-temporal"
          tabIndex={activeTab === 'temporal' ? 0 : -1}
          onClick={() => setActiveTab('temporal')}
          onKeyDown={selectTabFromKeyboard}
        >
          時間
        </button>
      </div>

      <div
        id="context-panel-links"
        className="related-tab-panel"
        role="tabpanel"
        aria-labelledby="context-tab-links"
        hidden={activeTab !== 'links'}
      >
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
      </div>

      <div
        id="context-panel-backlinks"
        className="related-tab-panel"
        role="tabpanel"
        aria-labelledby="context-tab-backlinks"
        hidden={activeTab !== 'backlinks'}
      >
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
      </div>

      <div
        id="context-panel-temporal"
        className="related-tab-panel"
        role="tabpanel"
        aria-labelledby="context-tab-temporal"
        hidden={activeTab !== 'temporal'}
      >
        {temporal}
      </div>
    </aside>
  )
}
