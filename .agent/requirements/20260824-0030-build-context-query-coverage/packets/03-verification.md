# Packet 03 — independent verification pass

- Objective: 実装passと分離してrepository、本番配布、live品質、latencyを検証する。
- Ownership: read-only verification、production update、`results/03-verification.md`、`final-report.md`、TSUZUNE final writeback。
- Forbidden: failureを隠すtest変更、Git commit/push、中間状態のproduction Vault書込み、実行中TSUZUNEの強制終了。
- Source of truth: Task Contract、production receipt、再起動後のproduction MCP output。
- Acceptance: typecheck、full test、check:mcp、workflow verifier、production update、5ケース各予算16/16 markersかつ5/5 tasks、latencyの比較結果。
- Unseen boundary: production runtimeがreceiptと一致しstaleでないこと。
- Stop/escalation: production updaterがapp実行中または安全gate失敗を報告したら強行しない。
