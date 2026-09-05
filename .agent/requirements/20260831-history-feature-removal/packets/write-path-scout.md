# Packet: write-path-scout

- Objective: TSUZUNEで新規履歴を生成する全実行経路をcall graphとして特定し、履歴なしでも維持すべきmutation safetyと、削除可能な履歴専用実装を分離する。
- Context: 利用者は履歴機能そのものの廃止を選択した。既存`50_履歴`データの物理削除は未承認。
- Files / sources: `src/mcp/service.ts`、`src/mcp/server.ts`、`src/core/vault.ts`、リンク・move・classification関連sourceと直接のtests。
- Ownership: read-only repository investigation。
- Do: entry point、caller、write ordering、revision guard、history callback、返却shapeを追跡し、file:line付きで分類する。
- Do not: 編集、Git write、test実行、production操作、TSUZUNE書込み、既存履歴削除。
- Expected output: must-remove / must-preserve / ambiguous の表と、最小安全diffの提案。
- Verification: `rg`で全callerを逆引きし、少なくともautonomous update、patch、link add、moveの未提示境界を確認する。
- Stop / escalation: 履歴を外すとcanonical mutationのatomicityやrevision競合防止が失われる場合、修正案を広げずrootへ返す。

