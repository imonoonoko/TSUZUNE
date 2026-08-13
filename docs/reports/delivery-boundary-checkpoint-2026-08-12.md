# Delivery Boundary Checkpoint — 2026-08-12

## 結論

P0は完了した。次の製品sliceを始める前に、dirty working treeを「本番受領済みの製品変更」「本番機能ではない評価コード」「証拠・計画資料」へ分け、現在のソースに対する検証を一度だけ実行した。

このcheckpointは本番更新ではない。commit、push、package、installer実行、再インストール、MCP再登録、releaseは行っていない。installed v0.5.0の受領書は更新せず、過去の受入時点を示す証拠として保持する。

## 固定点と現在の差

| 項目 | 確認結果 | 境界 |
|---|---|---|
| 開発基点 | branch agent/tsuzune-mcp-integration、HEAD 5266131f6e2c38afc39b46fe9083c9e1fef39577 | dirty treeのため、commitだけで現行sourceを表さない |
| 既存の本番受領書 | 2026-08-11T16:06:03Z、v0.5.0、dirty source 705 files、digest 2844ebc657af246874bfeefd8406ac3f1d91918f0286006c7810509ff1f7c0aa | 当時のsource／installの固定点であり、後続のworking treeを自動的に受入しない |
| 今回検証したsource snapshot | このcheckpoint文書を書き始める前に、receiptと同じ除外規則で723 files、digest 7c46ead9df82ef1f0f420ad85ac48bd0de8f7921c7bdddd73967c155a36c446e | この後に追加したP0文書更新は含まない。production receiptではない |
| installed binary | TSUZUNE.exeとresources/app.asarのSHA-256はreceiptのinstalled hashと一致 | installed program binaryはreceipt時点のまま |
| 本番profile | 57 filesだが、現在digestはa8b01766d7fb1e2c312eb468f185d41fdbad7f125705640591e4ea07f95ea793で、receipt時の324efbd9ab308ddeba9b6f3202877f7d9717d480ef433b2169606586e3a3973cとは一致しない | receipt後に通常のElectron profile filesが更新された事実だけを記録する。P0はprofileを書かず、原因や製品挙動への影響を推測しない |

profileの最新更新時刻はreceipt後であり、これは「受領書時点にprofileが不変だった」ことと矛盾しない。以後の本番更新では、profileをbefore/afterで比較する既存gateを改めて通す。

## Delivery分類

| 区分 | 対象 | 受領書との関係 | 今回の扱い |
|---|---|---|---|
| A. 本番受領済み製品変更 | X1-S1a creation-time sidecar no-op: src/main/vault.ts、tests/vault.creation-times.test.ts | receiptのdirty source snapshotとX1-S1a reportが受入範囲を示す | 現行sourceでtargeted regressionと全suiteを再確認 |
| A. 本番受領済み製品変更 | X1-S1b revision-aware autonomous no-op: src/mcp/service.ts、src/mcp/server.ts、tests/mcp-service.test.ts、scripts/check-mcp.mjs | receiptのdirty source snapshotとX1-S1b reportが受入範囲を示す | 現行sourceでMCP smokeを含め再確認 |
| A. 本番受領済み製品変更 | X1-T1 structured-only build_context: src/mcp/server.ts、scripts/check-mcp.mjs、fixture check scripts | receiptのdirty source snapshotに含まれる。local Codex Desktop stdioだけが受入host | 12 callの再構成fixtureを再確認。ChatGPT remote MCP／host tokenは対象外 |
| B. 本番機能ではない評価 | Hooks retrieval shadow: src/core/retrieval-shadow.ts、tests/retrieval-shadow.test.ts、tests/fixtures/retrieval-shadow-corpus.ts | receipt後の未追跡sourceであり、本番受入範囲ではない | production build_contextの候補・順位を変更せず、改善1／回帰1／不変1の停止判断として維持 |
| C. 証拠・計画・診断 | Windows accessibility baseline、Priority Reset、BM25 assessment、GP0-3b-p診断、handoff、requirements packages | 製品codeとは別。receiptを更新しない | 計画と未証明境界の記録として保持 |

X1の詳細な機能契約と当時の本番gateは、[X1-S1a report](x1-s1a-creation-time-sidecar-noop-2026-08-11.md)、[X1-S1b report](x1-s1b-revision-aware-autonomous-noop-2026-08-11.md)、[X1-T1 report](x1-t1-structured-only-transport-2026-08-12.md)、および[production receipt](production-update-latest.json)を正本とする。

## 今回実行した検証

| Check | 結果 |
|---|---|
| npm run typecheck | PASS |
| npx vitest run tests/vault.creation-times.test.ts tests/graph-timeline.test.ts tests/mcp-service.test.ts tests/retrieval-shadow.test.ts | 4 files / 35 tests PASS |
| npm run test:production with NODE_OPTIONS=--max-old-space-size=6144 | 58 files / 519 tests PASS |
| npm run check:mcp | PASS（4 read tools / 3 write tools） |
| node scripts/check-x1-t1-desktop-fixture.mjs | PASS。fixture digest 8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e、12/12 structured-only、fixture write 0 |
| git diff --check | error 0。既存dirty fileに対するCRLF warningのみ |
| installed TSUZUNE.exe / app.asar hash | receiptと一致 |

既定のheapで既知のworker OOMを再現する必要はないため、既存のproduction検証と同じ6 GiB設定をこの検査プロセスだけに使った。これはpackageやinstalled appを変更しない。

## 残る境界

- 現在のprofile digestはreceiptと違う。installed binaryが一致することは確認できたが、profile差分を今回のsource testや本番受入と混同しない。
- Windows accessibilityの実Graph keyboard flow、720px幅、100〜200%拡大、screen reader、High Contrastは未実測のままである。DOM／UI Automationの証拠を実OS受入に読み替えない。
- ChatGPT remote MCPとhost model-visible tokenは未計測。X1-T1のwire byte削減をtoken、費用、恒常的品質の削減とは呼ばない。
- Hooks shadowは新しい製品trackを正当化しない。行動ログ、SQLite、BM25、Retrieval Graph、vector DBは追加しない。

## 次の順序

P1として、[Windows accessibility baseline](windows-accessibility-baseline-2026-08-12.md)の手動packetを実施する。P2の7日dogfoodは並行観測として開始できるが、新機能の着手理由にはせず、記録だけを残す。P1で修正が不要なら、次の製品sliceはGraph Filters/Searchである。
