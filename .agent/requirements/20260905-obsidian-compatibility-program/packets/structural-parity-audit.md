# Packet: Structural Parity Audit

- objective: Graph／local graph／Canvas／Bases／excluded files／bookmarksの公開surfaceを、TSUZUNEのcurrent source、tests、既存fixture証拠へ照合する。
- owner: 正本・文脈監査員。
- ownership: read-only。`src/`、`tests/`、`.agent/requirements/`、`docs/reports/`、`PLAN.md`、`PROJECT_STATUS.md`の対象箇所。
- forbidden: file edit、TSUZUNE write、Git operation、browser操作、第三者plugin実行、歴史PASSの現在正本化。
- canonical sources: current repository source/tests、Obsidian公式Help。fixture reportはas-of付き補助証拠。
- output: surface、status、exact evidence、current-vs-historical contradiction、freshness、P0/P1候補をMarkdown表で返す。
- acceptance: source/test/evidenceの主語とbaselineを明記し、directory exclusion、unresolved links、aliases、restart persistenceを別行にする。
- unseen check: excluded fileがFile tree／Search／Graph／backlinksへ与える影響をsurface別に確認する。
- stop: Obsidian実機だけで確定可能な挙動は `Research` とし、推測で埋めない。

