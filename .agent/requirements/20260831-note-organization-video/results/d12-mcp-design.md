# D12 — MCP設計結果

- 現行の`list_directory`、`fetch`、`search`、`build_context`、`get_backlinks`、`patch_note`、`preflight_move_entry`、`move_entry`で最初のlossless organizerは成立する。
- source codeと`tests/entry-move.test.ts`は`01_受信箱`を含む通常領域から`10/20/30/40`へのmoveを許可している。既存のシステム設計noteにある「通常領域から40だけ」という記述はstaleである。
- moveはcollision、source/destination fingerprint、保護境界、link impactをpreflightし、pending journal、readback、rollback/recoveryを持つ。
- v1で新しいmeaning APIやbatch mutationは不要。新しいread-only候補inventoryは実測摩擦が出た時だけ再検討する。
- automaticは同filenameの一件moveとreadbackまで。merge、delete、rename、split、contradiction、low confidenceは例外へ返す。

