# Codex session handoff archive

このfolderの文書は、2026-08-11〜14に別sessionへ作業を継続するため作成された時点snapshotです。本文の`Reactivation Prompt`、`Current`、`Active track`、`Next Steps`は履歴証拠であり、現在の指示や承認ではありません。

再利用時は、先にrepository rootの[PLAN.md Current Decision](../../PLAN.md#current-decision)、[PROJECT_STATUS.md](../../PROJECT_STATUS.md)、`git status --short`で現物を確認してください。そのうえで、当時の判断理由・検証境界・失敗条件だけを必要な範囲で参照します。

| 日付 | Handoff | 当時の対象 | 現在の扱い |
|---|---|---|---|
| 2026-08-11 | [Templates, Graph actions, and Context reduction](2026-08-11-templates-graph-context.md) | Templates、Graph action、Context削減 | 実装・検証の履歴。旧Next Stepsは再開指示にしない |
| 2026-08-11 | [X1-S1 maintenance and Hooks context](2026-08-11-x1-s1b-hooks-context.md) | scan／AI更新no-op、Hooks候補 | maintenance証拠と候補判断の履歴。HooksはCurrent Decisionで再評価する |
| 2026-08-12 | [CP1-B Fresh Boundary Monitoring](2026-08-12-context-token-fresh-task.md) | fresh-task監視 | 当時のmonitoring packet。現在のContext判断は現行正本を優先する |
| 2026-08-13 | [Context／Token優先の次Track再選択](2026-08-13-context-token-next-track.md) | Context／token測定とTrack選択 | 測定・反証の履歴。旧Current Decision／Next Stepsは失効 |
| 2026-08-14 | [Drive Sync・Background Runtime・Icon Refresh](2026-08-14-drive-sync-background-icon.md) | Drive、常駐、Icon、dirty inventory | delivery境界の履歴。旧branch／HEAD／dirty件数／Next Stepsは失効 |

新しいhandoffをここへ置く場合も、完了または失効後はこの表で履歴扱いを明示します。可変なPrimary／Nextはhandoff archiveへ複製せず、常に`PLAN.md#current-decision`へ戻します。
