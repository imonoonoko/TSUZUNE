# TSUZUNE 全コードレビューとリファクタリング案

作成日: 2026-08-24
対象: 現在の dirty working tree（製品コードを変更せず監査）

## 結論

P0 はありません。型検査、全テスト、MCP 契約検査は合格しています。一方、現在の安全性・運用性に直接影響する問題を3件採用しました。

1. ノート保存の競合検知が更新日時中心で、同一サイズ・同一更新日時の外部変更を上書きできる。
2. `check:mcp` が登録済み MCP bundle を直接再ビルドし、実行中サーバーを自己 stale 化して同一セッションの TSUZUNE 書き戻しを止める。
3. 自律更新履歴を正本保存より先に作るため、正本保存失敗時に未適用更新の履歴が残り得る。

大きな保守性課題は `src/renderer/App.tsx` への状態・副作用・操作の集中です。ただし全面再設計は不要で、保存競合を扱う note session とタブ状態から順に、既存の振る舞いを保ったまま切り出すのが妥当です。

## 採用した所見

### [P1] 同一 metadata の外部変更を保存時に上書きできる

- 根拠: `src/shared/types.ts:68-73` の保存入力は `expectedModifiedAt` のみを持ち、`src/main/vault.ts:942-987` は開始時に更新日時、rename 前に更新日時とサイズだけを比較する。
- 再現境界: 読み込み後、外部プロセスが本文を同じバイト数に変更し、更新日時を元に戻すと、現在の検査を通過し得る。
- テスト不足: `tests/vault.atomic.test.ts:111-141` は更新日時が変わる競合だけを検証している。
- 最小の正しい修正: 読み込み時の本文 revision（SHA-256 等）を `SaveNoteInput` に渡し、保存開始時と rename 直前の現在本文を照合する。保存処理内だけで pre/post hash を取る案では、保存開始前に発生した同一 metadata 変更を検出できない。
- 必要テスト: 保存開始前の同一サイズ・同一 mtime 変更と、temp write 後の同一 metadata 変更の2境界。

### [P1 workflow] `check:mcp` が稼働中 MCP を自己 stale 化する

- 根拠: `package.json:84` の `check:mcp` は先頭で `build:mcp` を実行し、`scripts/build-mcp.mjs:8-18` が登録済み runtime と同じ `out/mcp/server.js` を更新する。
- ガード: `src/mcp/server.ts:180-215` は bundle の更新日時がプロセス開始より新しければ stale と判定し、書き込みを拒否する。
- 実測: 検査自体は新規子プロセスで全合格したが、直後の登録済み production MCP は `stale_runtime: true`、`delivery_info: mismatch` となり、本レビューの最終 TSUZUNE 書き戻しが拒否された。
- 最小の正しい修正: 契約検査用 bundle を一時・隔離パスへビルドし、各 checker にそのパスを渡す。登録済み `out/mcp/server.js` を触らない。
- 受入条件: 実行前後で既存 MCP の `process_started_at` を維持し、`stale_runtime: false` のまま全 checker が合格する。

### [P2] 正本保存失敗時に未適用の AI 更新履歴が残り得る

- 根拠: `src/mcp/service.ts:1332-1363` の `applyUpdateWithHistory` は `50_履歴/AI更新` の revision note を先に作り、その後で正本を `vault.saveNote` する。
- 影響: 外部編集、root 切替、権限・rename 失敗等で正本保存だけ失敗すると、対象へ適用されなかった更新について `kind: ai_revision` の履歴が残る。データ消失ではないが、監査意味が曖昧になる。
- 修正方針: 先に失敗テストを追加し、「更新 intent と適用 receipt を分ける」または Vault 層の一貫した commit primitive を設計する。単純な順序反転は、正本だけ更新され履歴がない反対側の不整合を作るため不可。履歴を補償 delete する案も現行の履歴不変契約に反する。

### [P3] `App.tsx` に note session と workspace state が集中している

- 根拠: `src/renderer/App.tsx` は 3,893 行、`useState` 62件、`useRef` 31件、`useEffect` 7件、ローカル callback 約86件。特に `src/renderer/App.tsx:208-335` の状態群と `src/renderer/App.tsx:552-859` の読み込み・保存・外部変更処理が強く結合している。
- 影響: 保存競合、タブ切替、watch event の変更時に広い状態機械を同時に理解する必要があり、回帰範囲が大きい。
- 段階案:
  1. `useNoteSession`: active note、content、dirty、保存、競合、外部変更だけを所有。
  2. `useWorkspaceTabs`: タブ集合、active tab、close/reopen、タブ別 view state を所有。
  3. 既存 UI テストを通し、App の state/callback 数が実測で減った時点で止める。全 handler の機械的 hook 化はしない。

### [P3] dialog の `requestAnimationFrame` を破棄していない

- 根拠: `src/renderer/components/HumanNoteCaptureDialog.tsx:74-77` と `:92-95`。
- 修正: frame id を保持して cleanup で cancel するか、callback 内で対象要素の接続を確認する。共通 abstraction は不要。

### [P3] packaged startup checker に到達不能分岐がある

- 根拠: `scripts/check-packaged-startup.mjs:100-117` の非 Windows 分岐内に、再度 `process.platform === 'win32'` を判定する branch がある。
- 修正: 到達不能な `taskkill` 部分約6行を削除し、非 Windows は `child.kill()` のままにする。

## 採用しなかった候補

- bookmark 更新競合: `VaultService` 単体では read-modify-write だが、現在の信頼済み IPC 経路は `src/main/ipc.ts:51-61` の global queue で直列化されている。現行 defect としない。
- self-save event が外部変更扱いになる: `src/main/watcher.ts:101-145` が mtime・size・SHA-256 で own write を抑止し、IPC 保存時にも登録される。現物経路で反証された。
- 外部 HTTP/HTTPS Markdown 画像: 現行資料で既存表示経路を保つ決定がある。privacy policy を変更する時だけ再検討する。
- MCP 件数の hard-code: common 16 / direct 18 は現在の明示的 product contract であり、重複除去の対象にしない。
- graph probe scripts の一括 framework 化: 各 script は異なる証拠シナリオを持つ。反復故障や保守負担が観測されるまで Held。
- 依存関係削除: package dependencies には現行の呼び出し元があり、未使用 dependency は確認されなかった。

## 推奨ロードマップ

### Slice 1: 安全境界と書き戻し経路

独立した小さい変更として、次の順で進める。

1. `check:mcp` を隔離 bundle へ変更し、同一セッションの production MCP を stale にしない。
2. `SaveNoteInput` に本文 revision を導入し、同一 metadata 競合の regression tests を追加する。
3. 自律更新履歴と正本保存の commit semantics を失敗テストから確定する。

各変更で `npm run typecheck`、`npm test`、`npm run check:mcp` を通す。MCP 製品変更はその後 `npm run production:update` の別ゲートが必要。

### Slice 2: Renderer の局所分割

`useNoteSession`、次に `useWorkspaceTabs` の順で抽出する。新しい state manager、DB、event bus、依存 package は追加しない。既存テストが通り、責務集中が実測で下がれば停止する。

### Slice 3: 小さな cleanup

到達不能6行の削除と RAF cleanup のみ。機能拡張へ広げない。

### Held / Research

- `VaultService` / `McpService` 全面分割
- graph evidence tooling の共通 framework
- coverage threshold の導入
- 外部画像の policy 変更
- 新 runtime、DB、cache、daemon、Hook

いずれも今回の監査完了を自動着手条件にしない。明示選択または反復する実害の観測が必要。

## 検証結果

- `npm run typecheck`: PASS
- `npm test`: PASS（77 files passed / 1 skipped、824 tests passed / 1 skipped）
- `npm run check:mcp`: PASS（common/freebuf 16、direct 18、read smoke 10、write smoke 8、delivery / stale guard 各 gate 合格）
- `git diff --check`: error なし。既存の LF -> CRLF warning のみ。
- production update: 未実行（レビュー・文書のみで製品コード変更なし）
- Git commit / push / PR: 未実行

## Ponytail audit

delete: 非 Windows 分岐内の到達不能な `taskkill` 分岐を削除し、`child.kill()` だけを残す。`scripts/check-packaged-startup.mjs:107`

net: -6 lines, -0 deps possible.

## 実行境界

- 本レビューで製品コードは変更していない。
- dirty working tree は開始時のまま保全した。
- production TSUZUNE の開始 context は確認済み。
- 最終実施記録は未同期。`npm run check:mcp` による自己 stale 化で登録済み MCP が write を fail-closed したため、ガードを迂回していない。本報告の P1 workflow がその原因と修正案を記録する。
