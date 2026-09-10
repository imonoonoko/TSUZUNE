# TSUZUNE Product Definition

## Register

Product

## User

TSUZUNE is a Windows-first personal knowledge workspace for one person. The user writes in Japanese, keeps durable local files, collaborates with Codex and ChatGPT, and wants the application to become more useful through everyday operation without turning note maintenance into a second job.

## Product Purpose

TSUZUNE lets the user write, connect, find, and reuse knowledge while ordinary Markdown remains the source of truth. It must be useful as a daily note application before AI is involved, and it must give AI bounded, source-backed context when AI is involved.

The product succeeds when:

1. Daily notes, project records, and decisions can be captured and retrieved without opening Obsidian.
2. Markdown remains readable and recoverable without TSUZUNE or an app-owned database.
3. External AI can retrieve source-backed context and make authorized, revision-checked updates while protecting original sources. Ordinary updates do not generate history notes.

## Adopted Direction — 2026-09-06

**自分の知識を手元に置き、日常の中でAIと安心して使い続けられること。**

Product value is judged by three everyday outcomes: starting to write without sorting first, returning to earlier thinking with its reasons and sources, and reducing repeated background explanation to external AI. Passing engineering checks establishes reliability; it does not establish daily usefulness or user acceptance.

Obsidian compatibility supports safe use of the same local Vault and familiar daily operations. Full feature parity is not a completion condition. Preserve the order of data safety, daily operations, structural expression, then explicitly selected extensions; select work within that order by observed user friction and these three outcomes.

Keep Markdown ownership, source protection, revision checks, keyboard access, accessibility, and proportionate production verification. Prefer existing capabilities and one small reversible improvement. Simplify code when the selected change exposes a concrete maintenance burden; file size alone does not authorize a broad refactor.

Observatory / LIFE Weather ended and was removed on 2026-09-06. Generative art is not the current product promise or implementation queue. Preserve its research and the distinction between the user's philosophy and any local software representation.

Current work and the first daily-use acceptance conditions belong only to [PLAN.md](PLAN.md#current-decision). Current summaries link to their owner; dated evidence remains identifiable as historical.

## Brand Personality

- Quiet, grounded, and trustworthy.
- Warm enough to feel personal, restrained enough to remain a working tool.
- Dense when information requires it, never visually noisy.
- Familiar in interaction and distinctive in identity.

## Reference Products

- Obsidian for local-first Markdown workflows, Wiki links, backlinks, and observable graph behavior.
- A well-kept personal workshop notebook for atmosphere: useful marks, calm materials, and evidence of continued use.

References are behavioral and experiential. TSUZUNE does not copy proprietary implementation details or reproduce another product pixel for pixel outside explicitly documented compatibility contracts.

## Anti-References

- Generic AI dashboards filled with decorative cards, gradients, and marketing language.
- Flashy glassmorphism, neon accents, or motion that competes with writing.
- Enterprise SaaS density, account-first onboarding, collaboration chrome, and telemetry surfaces.
- Strange reinvented controls where a familiar Windows interaction already exists.
- App-owned databases that lock the user's knowledge inside TSUZUNE.
- Manual sorting, tagging, or ranking as a mandatory daily maintenance ritual.

## Product Principles

1. **Local truth first.** Markdown is canonical; caches and indexes are replaceable.
2. **The tool recedes.** Writing, reading, and following a connection are always faster than configuring the workspace.
3. **Relationships stay legible.** Links, provenance, time, and current state are visible without surrounding the note with noise.
4. **AI work is explainable and bounded.** Updates follow explicit authorization, source protection, and revision checks. Proposal approval and failure recovery follow the operation contract; automatic version history is not promised.
5. **Familiar access is a feature.** Keyboard operation, screen-reader semantics, contrast, and Windows conventions are part of normal quality.
6. **Complexity must earn its place.** A new subsystem is added only when a real workflow cannot be served simply.

## Accessibility and Inclusion

- Target WCAG 2.2 AA contrast for text and interactive states.
- Every primary workflow must work with pointer and keyboard.
- Controls require accessible names and meaningful focus order.
- Meaning must never depend on color alone.
- Respect reduced-motion preferences and avoid decorative animation.
- Remain usable at common Windows display scales from 100% through 200%.
