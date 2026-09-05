# Integrated evidence — TSUZUNE 履歴機能廃止

## Outcome

TSUZUNEは新しい履歴を生成・公開・参照する製品責務を持たない構成へ変更され、本番インストールまで検証された。通常ノートのrevision競合防止、原典保護、provenance、時間指定文脈は維持される。

## Changed artifacts

- MCP service/server、リンク操作、移動journal／Drive bridge
- MCP service・move・Drive・IPC tests、MCP contract/smoke
- 現行契約文書
- 未配線のHistory Store v2、履歴圧縮・計測コードと専用testsを削除

## Persistence

- fresh MCPで`stale_runtime:false`と`delivery_info:match`を確認した。
- `30_知識/TSUZUNE-履歴機能廃止・本番受入-実施記録-2026-08-31.md`を作成し、関係する6正本から到達可能にした。一意検索、read-back、6 backlinksを確認した。

## Stop boundary

- 既存`50_履歴`は変更・移動・削除していない。物理削除は別の明示承認gateである。
- Codex Desktopの現在の長寿命MCP接続は更新前processを保持するため、通常の次回利用前にDesktop再起動が必要。新buildのfresh process自体は検証済み。
