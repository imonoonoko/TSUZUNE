# Drive Sync Explicit Note Move S3 (2026-08-14)

## 結果

TSUZUNE内で明示的に移動・名前変更した同期済みMarkdownノートを、次回の手動Drive同期で同じGoogle Drive file IDのまま新pathへ移す製品経路を実装した。別端末で同じfile IDのpath変更を受け取った場合も、旧ローカルノートを新pathへ移す。

## 固定した契約

1. 移動は本文hashの一致から推測せず、TSUZUNE内の明示操作と既存Drive file IDだけで識別する。
2. ローカル操作時にネットワークへ接続せず、同期台帳へ保留して従来どおりpreview／applyで反映する。
3. Drive側はmetadata-only `files.update`を使い、本文とparentを再送・変更しない。
4. previewには`旧path → 新path`を「移動」として表示する。
5. 台帳記録に失敗したローカル移動は旧pathへ戻し、片方だけ進んだ状態を通常成功として返さない。
6. 短pathと長いUTF-8 pathの切替では、`appProperties.tsuzunePath`とdescriptionの古い側を明示的に消す。
7. 移動と本文編集、移動先衝突、file ID／version driftは推測せず停止する。

## 対象範囲

- 単一Markdownノートのアプリ内移動
- 単一Markdownノートのアプリ内名前変更
- 別端末由来の、同じDrive file IDを保った純粋なpath変更

対象外はフォルダ一括移動、添付ファイル、削除伝播、移動と本文変更の同時解決、MCP `move_note`、バックグラウンド自動同期、モバイルclientである。

## 検証

- typecheck: PASS
- focused Drive／IPC／UI: 4 files／106 tests PASS
- production test gate: 62 files／624 tests PASS（2 workers、Node 6 GiB）
- production update: 10/10 checks PASS。installer install、packaged／installed smoke、MCP再登録、build／installed hash一致を確認
- installed production: 2026-08-14 03:43 JST更新。production profile 57 files不変
- `git diff --check`: PASS
- Ponytail review: Lean already。新規依存、汎用event bus、hash move inferenceなし
- 単一worker全件は6 GiB・8 GiBとも61/62 files通過後に既知の累積OOM。製品判定は公式`test:production`の2-worker全件PASSを使用

## 根拠

Google Drive API v3は`files.update`のpatch semanticsを提供し、`appProperties`の個別entryは`null`で削除できる。これを利用してmetadataだけを移動し、長いUTF-8 pathの124-byte制限回避と旧path除去を両立した。

## 残る受入

- installed appで1件を移動し、previewが移動1件、apply後が0件になる実機確認
- commit・pushは未実施
