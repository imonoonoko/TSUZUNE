# X1-S1a Creation-time Sidecar No-op

更新日: 2026-08-11
状態: installed-and-verified（製品コード）

## 結論

安定したVaultの二度目以降の`scan()`で、`.tsuzune/graph-file-times.json`の内容が既にTSUZUNEのcanonical JSONと完全一致する場合は、temp file→renameの置換書込みを行わなくなった。論理作成日時`createdAt`とGraph Timelineが使う時系列の意味は維持する。

実装は`VaultService.writeCreationTimes`に限定した。保存予定のcanonical JSONを作り、既存sidecarがregular fileかつ同じbytesならreturnする。欠損、壊れたJSON、不正値、非canonicalな順序、削除済みpathを含むregistryは従来どおり正規化して保存する。`updateCreationTimes`で論理mapだけを比較しないため、既存のsoft repair契約を失わない。

## 回帰証拠

- `tests/vault.creation-times.test.ts`は、初回scan後にsidecarのmtimeを固定過去時刻へ設定し、二度目のscan後もbytes、mtime、`createdAt`が不変であることを確認する。現行の無条件renameではこのテストがredになることを先に確認した。
- `tests/graph-timeline.test.ts`を同時に実行し、`createdAt`に基づくTimeline順序の既存契約を再確認した。
- targeted: `npx vitest run tests/vault.creation-times.test.ts tests/graph-timeline.test.ts` — 2 files / 11 tests PASS。
- `npm run typecheck` — PASS。
- `npm test` — 57 files / 510 tests PASS。
- `npm run check:mcp` — 4 read tools / 3 write tools PASS。

## 本番受入

`npm run production:update`の既定4 GiB V8 heapでは、隔離`test:production`のworkerがOOMし、package/install前で停止した。ソースを変更せず、この実行だけ`NODE_OPTIONS=--max-old-space-size=6144`を与えて同じgateを再実行した結果、57 files / 510 tests、10/10 production checks、packaged／installed smoke、built／installed EXE・`app.asar` hash一致、production profile 57 filesのdigest不変、MCP再登録を通過した。

機械可読な本番固定点は[production-update-latest.json](production-update-latest.json)を正本とする。このreport、INDEX、PLAN、PROJECT_STATUSの追記はacceptance後の文書のみの更新であり、receiptのsource fingerprintに含まれない。hashはここへ複製しない。

## 非対象と次の境界

- `autonomous_update_note`の同一本文no-op、AI履歴抑止、MCP response contract変更は未実装。
- known pathのfetch/create/updateから全Vault scanを避ける変更は、profileで必要性が出るまで着手しない。
- `50_履歴/AI更新/`の通常Graph／search扱いは変更していない。
- BM25、SQLite、永続cache、閲覧／検索行動ログ、共起グラフ、性能・token削減の主張は行わない。

## 関連

- [X1-S1 planning boundary](../../PLAN.md#current-transition-queue)
- [MCP integration](../mcp-integration.md)
- [Latest production receipt](production-update-latest.json)
