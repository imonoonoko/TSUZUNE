# Drive Sync MCP Bridge (2026-08-14)

## 結果

起動中のTSUZUNE本体が持つ既存Drive Sync serviceを、Codex DesktopのTSUZUNE MCPからpreview／applyできる経路へ接続した。Google認証情報と同期実装はMCP側へ複製しない。

## 契約

- `preview_drive_sync`は同期planと件数を返すだけで、送信、受信、移動、競合処理を適用しない。
- `apply_drive_sync`はpreviewで返した`planId`を受け取り、既存serviceの再検査を通ったplanだけを適用する。
- Codex登録ではpreviewを自動、applyを確認対象にする。
- TSUZUNE本体が停止中ならfail-closedとし、MCPだけでGoogleへ接続しない。
- bridgeは`127.0.0.1`とrandom capabilityを使い、state fileへGoogle tokenを保存しない。
- UIとMCPは同じ同期serviceと直列queueを共有する。
- Windowsの×では保存確認後に通知領域へ隠し、bridgeを維持する。通知領域の「終了」でだけ本体、watcher、bridgeを終了する。自動同期は追加しない。

## 検証

- `npm run typecheck`: PASS
- focused tests: 2 files／13 tests PASS
- `npm run test:production`: 63 files／626 tests PASS
- `npm run check:mcp`: 6 read tools／7 write tools PASS
- `npm run production:update`: 10/10 checks PASS。2026-08-14 04:08 JSTにinstalled v0.5.0へ反映し、built／installed hash一致、production profile 57 files不変、MCP再登録を確認した。
- Ponytail review: 新規依存、重複Google client、重複同期engine、auto-syncを追加せず、既存preview／apply経路を再利用した。

## 残る受入

- Codex Desktop再起動後の実runtime previewはPASS。初回は送信11／受信0／移動0／競合0／保持16を返し、applyは未実施。
- notification tray常駐をproduction updateし、インストール版へ通常のclose要求を送るとウィンドウだけが消え、TSUZUNE processが生存した。背景状態のMCP previewも送信12／受信0／移動0／競合0／保持16でPASSした。送信増分1件は直前のTSUZUNE AI更新履歴であり、applyは未実施。
- Windowsログイン時の自動起動は今回の契約に含めない。TSUZUNEを起動した後にウィンドウを閉じても常駐する範囲だけを受入した。
- commit／pushは未実施。
