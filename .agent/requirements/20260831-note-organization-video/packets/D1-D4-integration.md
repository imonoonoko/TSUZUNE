# D1-D4 Integration Packet

## Objective

人間が分類せず `01_受信箱` へ投げ、AIは後から安全に整理提案するfirst sliceを、UX、現行経路、敵対的安全性、最小性の4視点で選ぶ。

## Evidence

- UX: 通常作成は `targetDirectory()` 依存。Idea formは自由captureには構造が多い。
- Code: `createAndOpenNote` はfolder確保、case-insensitive衝突回避、作成後readback、editor openを持つ。
- Safety: `preflight_move_entry` と `move_entry` は一件、fingerprint、protected path、collision、rollback、履歴なしを既に担う。
- Minimum: read-only proposal toolは意味判断を持たず、search/fetchと外部AIを重複包装する。

## Decision

Command Paletteに受信箱固定capture actionを一件だけ追加する。AI整理は既存toolで `提案 → 人間承認 → preflight → move → readback` とし、新しい整理APIは追加しない。

## Rejected

- 既存運用のみ: capture時の保存先判断が残る。
- proposal MCP: 重複責務であり、現時点の観測差がない。
- new screen / DB / embedded LLM / batch / Hook: first sliceの成功条件に不要。

## Residual boundary

意味分類の正しさはAIが自動確定しない。曖昧、機微情報、複数責務、Raw価値が不明な時は受信箱へ残す。
