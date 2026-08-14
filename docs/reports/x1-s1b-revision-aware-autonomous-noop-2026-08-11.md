# X1-S1b Revision-aware Autonomous Update No-op

更新日: 2026-08-11
状態: installed-and-verified（製品コード）

## 結論

`autonomous_update_note`は、`fetch`で得た`expected_revision`が現在のrevisionと一致し、渡された本文が現在本文と完全に同一な場合だけ、更新を行わず`unchanged: true`を返す。no-opでは`history_path`を省略し、対象Markdown、`50_履歴/AI更新`、stable canonical creation-time sidecarを変更しない。

stale revisionは本文一致の判定より先に`FILE_CHANGED`として拒否する。`expected_revision`を渡さない既存呼出は互換性のため従来どおり履歴を作り、本文を保存する。内容が異なる呼出も既存どおり更新前本文・理由・出典を履歴へ残し、通常更新のresponse shapeには`unchanged`を追加しない。

実装は`VaultMcpService.autonomousUpdateNote`の既存revision guard直後、履歴path生成・directory作成・履歴作成・`saveNote`より前の一分岐に限定した。MCP output schemaでは`unchanged`と`history_path`をoptionalにし、存在しない履歴pathを返さない。

## 回帰証拠

- `tests/mcp-service.test.ts`は、対象のmtimeを`fetch`前に固定し、fresh revisionと同一本文で、`unchanged: true`、revision不変、対象本文／mtime不変、stable sidecarのbytes／mtime不変、AI履歴directory不在を確認する。
- 同じtestは、revision guardなしの同一本文呼出が従来どおり履歴を作ることと、外部変更後は現在本文を渡してもstale revisionが先に`FILE_CHANGED`になることを固定する。
- `scripts/check-mcp.mjs`は、実stdio経路で通常のAI更新後、返却revisionと同一本文による`unchanged: true`、`history_path`省略、対象mtime不変を確認する。
- `npx vitest run tests/mcp-service.test.ts` — 1 file / 18 tests PASS。
- `npm run typecheck` — PASS。
- `npm run check:mcp` — 4 read tools / 3 write tools PASS。
- `npm test`は既定4 GiB V8 heapでworker OOMとなったため、ソースを変更せずこの検証プロセスだけ`NODE_OPTIONS=--max-old-space-size=6144`で再実行し、57 files / 513 tests PASS。

## 本番受入

2026-08-11 20:41 JSTに、`NODE_OPTIONS=--max-old-space-size=6144`をこのgateプロセスだけへ与えた`npm run production:update`が完了した。全513 tests、10/10 production checks、packaged／installed smoke、build／installed EXE・`app.asar` hash一致、production profile 57 filesのdigest不変、MCP再登録を確認した。

インストール済み本番、source fingerprint、packaged／installed hash、production profile、MCP再登録の事実は、[production-update-latest.json](production-update-latest.json)を唯一の正本とする。hashをこのreportへ複製しない。この本番受入段落とPLAN／PROJECT_STATUSの最終追記はacceptance後の文書のみの更新であり、receiptのsource fingerprintには含まれない。

## 非対象と境界

- 呼出前の`snapshot()`／全Vault scanは残る。欠損、壊れた、非canonicalなcreation-time sidecarはscan中に作成または修復され得るため、普遍的なzero-writeやscan回避は主張しない。
- `update_note`、明示的なcreate/update、通常Graph／searchの対象、`50_履歴/AI更新/`の扱い、Raw Source／会話ログの既存境界は変更していない。
- DB、cache、BM25、閲覧／検索行動ログ、共起グラフ、read path最適化、性能・token削減の主張は行わない。

## 関連

- [X1-S1 planning boundary](../../PLAN.md#current-transition-queue)
- [MCP integration](../mcp-integration.md)
- [X1-S1a creation-time sidecar no-op](x1-s1a-creation-time-sidecar-noop-2026-08-11.md)
- [Latest production receipt](production-update-latest.json)
