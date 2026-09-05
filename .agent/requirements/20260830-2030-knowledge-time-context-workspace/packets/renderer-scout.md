# Packet: Renderer scout

- objective: Identify the exact renderer insertion points for B, while preserving Activity Rail, Vault tree, and right context area.
- ownership: `src/renderer/App.tsx`, renderer components/styles and adjacent tests; read-only inspection only.
- forbidden: file edits, visual redesign outside approved B, new dependency, replacing existing shell.
- source of truth: `../plan.md`, current renderer, approved B mock.
- acceptance: report workspace/view state model, Activity Rail control path, selected-note/open-note path, right-panel relationship, relevant CSS breakpoints, and minimal files that need edits.
- unseen boundary check: cover no selected note, switching back to editor, keyboard naming/focus, and <=900px layout.
- stop/escalation: return to root if existing shell cannot host B without cross-cutting rewrite.

