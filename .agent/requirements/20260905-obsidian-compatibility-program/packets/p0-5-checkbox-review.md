# P0-5 Independent Review

- Role / model / reasoning: verification, gpt-5.6-terra / high. Strength: cross-source defect review with preservation constraints; escalate baseline mismatch. Parent owns final integration and any corrections.
- Subject / baseline: current source checkbox additions versus exact pre-task copies under work/checkbox-20260905/before; record SHA256 of reviewed files. Historical git diff includes unrelated work and is not the review baseline.
- Ownership: read-only src/core/frontmatter.ts, MarkdownEditor.tsx, MarkdownPreview.tsx, styles.css and relevant tests. No product, test, docs or Vault writes; no app launch, Git, production or settings operations.
- Objective: Find data-loss, boolean coercion, malformed-YAML, readonly/save-conflict, accessibility and regression defects introduced by this delta. Bound is note-local top-level booleans only. Review full nearby call paths only as necessary.
- Acceptance: defect-first report with exact fixtures/lines and severity; optional targeted existing tests, do not repeat full suite. Confirm code hash at end. A pre-existing issue is not a blocking introduced defect without evidence of worsening.
- Unseen boundary: choose a preservation case not covered by the named UI tests and reason through or probe it without modifying repository files.
- Ponytail review: apply C:/Users/Humin/.agents/skills/ponytail-review/SKILL.md after correctness; report only actionable complexity introduced by this delta.
- Stop: return ambiguity or contract expansion to parent. Do not independently declare production parity or authorize release.
