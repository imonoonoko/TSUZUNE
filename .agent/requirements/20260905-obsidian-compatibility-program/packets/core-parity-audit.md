# Packet: Core Parity Audit

- objective: Obsidianのcore authoring／navigation公開surfaceを、TSUZUNEのcurrent sourceとtestsへ照合する。
- owner: 調査員。
- ownership: read-only。`src/`、`tests/`、`docs/reports/`、`PLAN.md`、`PROJECT_STATUS.md`の対象箇所。
- forbidden: file edit、TSUZUNE write、Git operation、browser操作、第三者plugin実行、推測だけの判定。
- canonical sources: Obsidian公式Help、current repository source/tests。歴史reportは補助証拠。
- output: surface、status、exact evidence path/test、freshness、user-visible gap、P0/P1候補をMarkdown表で返す。
- acceptance: `matched` はcurrent sourceとcurrent executable testの両方、またはcurrent isolated acceptanceがある行だけ。片方だけは `not_proven`。
- unseen check: save/restart、Japanese filename、collision、broken linkのうち該当する境界を最低一件探す。
- stop: exact evidenceが競合したら双方を列挙し、採否せず親へ戻す。

