# Packet: contract-scope-scout

- Objective: 履歴機能廃止がMCP公開契約、test、script、document、temporal/as-of挙動へ与える影響を分類し、auto-generated audit historyと通常の時間知識を混同しない削除matrixを作る。
- Context: 利用者は履歴機能そのものの廃止を選択した。既存`50_履歴`データの物理削除は未承認。
- Files / sources: `src/mcp/server.ts`、`src/core/temporal.ts`、renderer temporal UI、`tests/**`、`scripts/**`、`package.json`、README/docs、既存History Store v2 requirements。
- Ownership: read-only repository investigation。
- Do: public schema/description/result fields、test fixtures、obsolete scripts/code/docs、temporal metadata dependenciesをfile:line付きで分類する。
- Do not: 編集、Git write、test実行、production操作、TSUZUNE書込み、既存履歴削除。
- Expected output: remove-now / retain-independent / needs-user-decision のmatrixと、TDDで先に失敗させる公開挙動の提案。
- Verification: `rg`で`50_履歴`、`include_history`、`history_path`、history store、temporal statusの参照を相互確認する。
- Stop / escalation: 時間文脈そのものを削除しないと契約整合が取れない場合、実装せずrootへ返す。
