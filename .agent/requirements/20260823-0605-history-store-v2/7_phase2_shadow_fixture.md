# Phase 2 Shadow Fixture

## Objective

既存Markdown履歴の公開契約を変えず、隔離fixture内でv2 intentをcanonical更新前に永続化し、更新後のexact-byte read-backが一致した場合だけreceiptを永続化する。

## In Scope

- 実際の`VaultMcpService.autonomousUpdateNote()`をshadow runnerのcallbackとして使う。
- legacy Markdown履歴とv2 intent／receiptが同じ更新を表すことをfixtureで検証する。
- update failure、read-back mismatch、stale revisionをintent-onlyとして残す。
- v2 recordはexclusive createで既存fileを上書きしない。

## Out of Scope

- `src/mcp/service.ts`へのproduction wiring。
- 本番Vault、既存`50_履歴`、production profileの変更。
- `include_history`、fetch、as_of readerの変更。
- retention、migration、削除、delta、pack、SQLite、Git／GitHub。
- `note_link_add`、entry-move履歴のv2化。

## Acceptance

1. 成功時、legacy Markdown history、intent、receiptが存在し、intentから旧bytesをexact restoreできる。
2. receiptとcanonical read-backは`committed`と検証される。
3. update失敗、read-back mismatch、stale revisionではreceiptを作らず、intentだけが残る。
4. stale revisionではcanonical外部更新を保持し、legacy historyを作らない。
5. Phase 2完了時も`service.ts`の既定production経路は無変更。

## Stop Boundary

shadow fixtureの証拠が揃ってもproduction writer接続へ自動移行しない。writer統合には、receipt write failure、crash recovery、保存場所、reader互換、production updateの別gateが必要である。
