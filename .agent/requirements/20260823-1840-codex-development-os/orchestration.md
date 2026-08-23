# Orchestration

## Goal

既存User Skillsを協調するCodex Development OSへ移行し、日常開発で実際に使える契約と検証済みSkill差分を完成させる。

## Packet 01 — Architecture audit

- Objective: 現行Skillとglobal AGENTSの責務重複、欠落、移行対象を証拠付きで特定する。
- Ownership: read-only。`C:\Users\Humin\.codex\AGENTS.md`と主要User Skills。
- Do not: 編集、TSUZUNE書込み、repo変更、外部検索。
- Output: 採用すべき責務境界、削除または移動すべき重複、見落としrisk。
- Verification: file pathとsectionを示す。

## Packet 02 — Migration and acceptance audit

- Objective: 3 laneとTask Contractを現行運用へ移す時のcompatibility、失敗mode、forward testを設計する。
- Ownership: read-only。requirements、主要User Skills、validator契約。
- Do not: 編集、TSUZUNE書込み、製品test、外部検索。
- Output: migration順、realistic test case、stop条件、rollback可能性。
- Verification: 各受入条件に対応するcheckを示す。

## Parent integration

1. 現行正本と両packetを統合し、Task Contractを確定する。
2. global AGENTSと必要最小の主要Skillだけを更新する。
3. validator、静的整合検査、独立forward testを実行する。
4. requirementsへfinal reportを残す。
5. TSUZUNE実施記録と現在ロードマップをfinal boundaryで一度同期する。

## Safety

- 既存dirty worktreeを巻き戻さない。
- TSUZUNE製品codeを変更しない。
- plugin/system Skillを変更しない。
- 新dependencyを追加しない。
- subagentは本番TSUZUNEへ書き込まない。
