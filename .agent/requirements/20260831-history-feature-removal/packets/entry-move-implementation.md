# Packet: entry-move-implementation

- Objective: AI moveの監査履歴生成と`history_path`公開を廃止し、履歴ファイルに依存せず同等以上に安全なcrash recoveryを維持する。
- Context: 自動監査履歴は廃止。既存`50_履歴`は未承認のため変更しない。rootは並行してMCP service/serverを編集する。
- Files / sources: `src/main/entry-move.ts`、`src/main/mcp-drive-sync-bridge.ts`、`tests/entry-move.test.ts`、`tests/fixtures/entry-move-crash.test.ts`。
- Ownership: 上記4 fileのみ編集可。`src/mcp/server.ts`、その他source/tests/docs、Git、production、TSUZUNEはroot所有。
- Do: 公開挙動testをREDにしてから、`prepared -> filesystem -> ledger` journalだけでdiscard/rollback/commitを判定する最小実装へ変更する。AI/humanとも、destination content一致 + ledger-after + durable `ledger` stageだけをcommittedとする。crash-before-ledger-stage-writeはrollbackする。監査path、audit stage、audit renderer、audit directory作成、move resultの`history_path`、move専用の未使用reason/source_refsを削除する。
- Do not: 既存`50_履歴`を削除・移動・書換えしない。revision/fingerprint/content check、Drive ledger rollback、40_情報源/legacy 50保護を弱めない。新規storage/dependencyを追加しない。他者のdirty changeをrevertしない。
- Expected output: task-owned diff、RED/GREEN commandと結果、recovery semantics、残リスク。
- Verification: `npx vitest run tests/entry-move.test.ts --maxWorkers=1`。未提示境界として、crash直後のjournal stageが`filesystem`だがledgerはafterのケースがrollbackすること、`ledger` stageはcommitすることを確認する。
- Stop / escalation: journalだけで一意にcommit/rollback分類できない状態がある、または公開schemaの同時変更が必要なら、所有範囲を広げずrootへ返す。
