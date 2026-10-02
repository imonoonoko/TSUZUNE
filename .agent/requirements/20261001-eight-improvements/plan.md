# 8項目改善 — 実行状態

利用者が2026-10-01に採用した8項目計画を実装する。詳細契約は同日会話の採用計画。既存の5項目とdirty差分を保持する。

成功条件: 8項目の操作経路を実装し、保存保全・互換性・関連回帰を検証する。最終typecheck/test/check:mcpを実行し、実機未確認を区別する。2026-10-01の利用者による現ツリー全体採用で再構成待ちを解除し、production:updateのsource snapshotを新しい本番境界とする。

## 分担と順序

- links: coreリンク共通解決・移動保全・構造探索・Graph深さ・未リンク言及の純粋処理とfocused test。App/IPCは親が接続する。
- bases: core Bases parser/evaluator/全関数・Worker・BaseTableView・設定パネルとfocused test。親が依存を追加しIPC/App接続する。
- reading: Bookmark型/保存の専用moduleとLive Preview editor拡張、専用UI/test。shared/types・vault・Appの変更は親が接続する。
- parent: 設定保存・Bookmark/言及IPC、workspace V2/最大8pane、App統合、最終検証・資料・Vault記録。

全ownerは同一作業ツリーを共有し、他者の差分をrevertしない。本番Vaultは子から書き込まない。

## 検証・停止境界

各packet focused test、親のintegration typecheck/full test/check:mcp/build。隔離profileでUI smoke。日本語IME/Narrator等は実OSの実施証拠なしにPASSとしない。公式全関数の未対応を完了に読み替えない。

過去sourceの再構成は未完だが、現ツリー全体の本番採用は明示承認済み。正本資料はgate前に確定する。本番更新の結果は最新receiptと既存Vault実施記録で判定し、gate後にこの資料を変更しない。Git公開は対象外。

## 状態

- リンク: source実装・隔離検証済み
- Bases: source実装・隔離検証済み
- Bookmark / Live Preview: source実装・隔離検証済み
- ペイン / IPC / 統合: source実装・隔離検証済み
- 最終検証: 全1,705 PASS／1 SKIP。build（typecheck）・check:mcp・文書検査・whitespace検査PASS。隔離実Electron 15 checks PASS
- 実OS / 比較 / 本番: 日本語IME・Narrator・High Contrast・本人受入、固定Obsidian比較は未確認。本番全体採用は承認済み、必須gateの反映結果は最新receiptで判定

最終証拠・変更経路・再開条件は[実装報告](../../../docs/reports/eight-improvements-implementation-2026-10-01.md)と[関数対応表](bases-functions.md)。source完了境界の本番Vault記録と影響MOCは同期済み。本番採用の最終結果は同campaignへ統合する。Git公開は未実行。
