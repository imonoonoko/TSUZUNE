# AI承認廃止・直接反映 — 2026-09-09

利用者は、承認時に「原典またはカテゴリが変更されたため変更案は失効しました。」となる問題に対し、人間の承認機能をなくして通常どおり変更することを選択した。状態所有先は[PLAN.mdのCurrent Decision](../../PLAN.md#current-decision)。

## 変更と保護境界

- 「AIとレビュー」画面、承認／却下／提案取得IPC、対象フォルダ設定、提案queueへの分岐を撤去した。通常ノートの作成・更新・patch・リンク追加は検証後に直接保存する。
- `create_derived_note`と互換名`propose_derived_note`は同じ直接作成経路を使う。待機中の原典・カテゴリ変更による承認失効は発生しない。保存直前の原典revision・カテゴリ再検査は続けるため、実行中の競合は保存せず拒否する。
- 原典のread-only、カテゴリ／topic／concept key、出典Wikiリンク、保存先衝突、同じ原典revisionとconcept keyの重複を検証する。同時作成は既存のファイルlockを再利用して直列化する。
- 旧`aiReviewPaths`は読取時に無視し、次の通常設定保存時に除去する。旧提案JSONは読み込まず、適用も削除もしない。古い案を新しい内容へ暗黙に適用しない。
- 原典、legacy履歴、既存のユーザーノート、Drive／trash／move／schedule等の権限は拡大しない。未承認の重要判断が必要な場合は会話で確認する。Git公開は対象外。

## 原因の確認

旧派生proposalは提案時の原典とカテゴリのrevisionを保持し、人間承認時の再検査でどちらかが変わると失効していた。今回の変更は利用者が選んだ承認待機の撤去であり、古いrevisionを許して強制上書きする修正ではない。報告された個別の失効案を再適用したとは扱わない。

## 実装検証

| 検証 | 結果と証明する範囲 |
|---|---|
| `npm run typecheck` | PASS。UI／preload／IPC／serviceの型整合 |
| UI関連2 files | 114 tests PASS。承認UIなし、通常設定・ノート編集の回帰 |
| MCP service／settings | 90 tests PASS。旧設定下の直接write、revision競合、原典保護、旧提案不変、同時重複防止、保存直前の原典／カテゴリ／保存先再検査 |
| `npm run build:mcp`、`npm run check:mcp` | PASS。公開schemaと互換名からの直接作成、原典非変更 |
| `npm test` | 113 files・1,217 tests PASS、1 file／1 test SKIP。承認専用テストを現行の直接保存契約へ置換した結果の件数 |
| 限定review・`git diff --check` | PASS。不要な承認処理の残存・余分な抽象化なし。既存dirty差分を保持 |

Skillは`ai-coding-operator`、`ponytail`、`ponytail-review`、`tsuzune`、`tsuzune-execution-record`を使用。親がservice／安全境界／統合を所有し、UI・文書の限定workerと本番境界のread-only scoutへ分担した。本番Vaultの書込みと最終判断は親だけが行う。

## 本番反映と完了判定

開始時の本番receiptは`2026-09-08T18:38:35.980Z`、`installed-and-verified`。exact archive `work/production-source-gD9Wgp`、1,614 files、digest `88d0b7a34645c73e6ed1883120a57c034b4e7ee367f7d9bc85846ed2a3421bc9`が開始時sourceと一致し、built／installedのexe・app.asarも一致した。既存dirty tree全体を未検証の本番baseと推定せず、このarchiveとの差分を今回の範囲として確認した。

本書と関係文書を確定後、`npm run production:update`を実行する。本番完了は[最新receipt](production-update-latest.json)がこのsource fingerprintに対応して`installed-and-verified`である時だけ成立する。gateはtypecheck、production tests、MCP検査、package、installer contract、隔離packaged／installed smoke、built／installedのexe・app.asar hash一致、本番profile不変、MCP登録を検証する。利用者の起動中アプリは終了させず、実Vaultをsmokeへ開かない。gate後にfingerprint対象文書へ結果を追記しない。

## 最終Vault同期の再開点

source検証時の呼出元MCPは`stale_runtime: true`（process開始 `2026-09-08T18:49:51.443Z`）。本番更新後も古いprocessが残る場合は、Codex再起動後に`runtime_info`と`delivery_info`を確認し、次の未同期分だけを実施する。型検査・テスト・本番更新の成功を同期のためだけに繰り返さない。

1. `AI承認廃止・直接反映`で重複検索し、一件の実施記録へ依頼・実装・この証拠・最新receiptの本番結果・残る利用者確認境界を保存する。
2. 現行`TSUZUNE-AI整理運用契約`の旧Review運用と旧提案の自動適用説明を今回の直接作成／旧提案不活性へ訂正する。既存の重要判断・原典処遇・scheduleの権限は維持する。
3. `TSUZUNEシステム設計`の現行Review説明、`TSUZUNE開発ロードマップ`の現在入口を更新する。必要な運用標準・資料入口・当日台帳は影響箇所だけ一度更新する。過去の採用・受入記録は書き換えない。
4. 各更新直前にfetchとrevision確認を行い、保存後の全文read-back、一意検索、リンク先とbacklinkを確認する。記録への導線を既存入口から確保する。

本書は再開点を残すrepo証拠であり、Vault同期済みの証明ではない。
