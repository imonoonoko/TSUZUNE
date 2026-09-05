# VERIFY-R5／VISUAL-R5／CEO-01 最終検証

## Independent review

- P0: なし。
- P1: なし。
- P2: なし。
- 視覚判定: accept。0秒の散在、10秒の二方向、20秒の三群、30〜40秒の一時的大合流、50秒の再分散、60秒の別構成を確認。固定四象限、固定群数、固定経路、恒久中心収束は未検出。
- 実装判定: accept。指定source hash、bounded deterministic simulation、real-note provenance、semantic-free境界、UI lifecycle／accessibility、receipt対応を確認。

## Resolution

- 初期の恒常中心力は中心崩壊したため棄却。
- 全粒子pairwise引力は一つの連続雲に留まったため棄却。
- 固定四象限tideは配置が読めたため棄却。
- 最終版は、72 frameごとに生成される有限寿命の移動tide、15〜35%の部分参加、late release、非参加粒子のdensity回避へ変更。
- display nameをfield identityから外し、名称更新ではmotionをresetせずmetadataだけ同期するtestを追加。
- acceptanceをdense 0〜60秒の7時点とsingleton、compact、pause／static reflow／resume、direct-open、source／build SHA-256へ更新。

## Final evidence

- `npx vitest run tests/observatory.test.ts tests/observatory-view.test.tsx --maxWorkers=1`: 2 files / 17 tests PASS。
- independent `npx vitest run tests/observatory.test.ts tests/observatory-view.test.tsx tests/app.safety.test.tsx --maxWorkers=1`: 3 files / 115 tests PASS。
- `npm run typecheck`: PASS。
- `node --check scripts/run-observatory-acceptance.mjs`: PASS。
- `npm test`: 101 files PASS / 1 SKIP、973 tests PASS / 1 SKIP。
- `npm run acceptance:observatory`: build、dense、singleton PASS。
- dense: `work/observatory-acceptance-dense-GOfLfz/acceptance-result.json`。
- singleton: `work/observatory-acceptance-singleton-pGzjo4/acceptance-result.json`。
- unseen: epsilon／iota／kappa／lambdaを各2,000 frame。RMS 0.306〜0.440、2〜6群、最大群11〜45。名称全置換＋900 linksでもmotion invariant。

自動検証の残る未知は、工房主が実Vaultの画面を60秒以上眺めて楽しめるか、30〜40秒の一時的大合流を良いリズムと感じるかだけである。installed productionとGit deliveryも未実施であり、機械的PASSに置換しない。

本番TSUZUNE実施記録は、MCP client再起動後に `stale_runtime: false` を確認し、fresh revisionで既存一件へ更新した。current revisionは `sha256:e28e1ae3457dc2e9e79eb3fcde275477aa9e0c1663442d30318706afd5d8e6f8`。全6647文字のread-back、exact search 1件、`10_プロジェクト/TSUZUNE.md` からのbacklink 1件を確認した。
