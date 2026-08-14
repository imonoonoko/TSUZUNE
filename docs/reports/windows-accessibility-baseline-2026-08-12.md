# Windows Accessibility Baseline — 2026-08-12

## Scope

Installed TSUZUNE v0.5.0のWindows accessibility treeと、Graph UIの既存DOM regressionを確認した。これは実Windows accessibility受入の完了報告ではない。

## Evidence

| Area | Result | Evidence boundary |
|---|---|---|
| App shell / primary control names | PASS | 実Windows UI Automation treeに`TSUZUNE`、named header actions、`Vaultファイル` tree、`グラフビュー` button、Markdown editorが存在した |
| Graph node keyboard open | DOM PASS / Windows SKIP | `tests/wiki-graph-view.test.tsx`がEnterでnodeを開く回帰を確認。実Windows Graph遷移はautomationのcoordinate geometry不足で未確認 |
| Graph pan/zoom keyboard | DOM implementation present / Windows SKIP | `WikiGraphView.tsx`に`+`、`-`、`0`、矢印、Shift+矢印 handlerがある。実Windows操作は未観測 |
| Visible focus | source contract present / Windows SKIP | global 2px focus-visible outlineを確認。physical displayで未観測 |
| 100% / 200% display scale | SKIP | Windows表示倍率を変更せず、実測していない |
| Screen reader | SKIP | Narrator/NVDAの音声出力と読み上げ順を観測していない |
| High Contrast | SKIP | Windows High Contrastで観測していない |

## Verification

- `npx vitest run tests/wiki-graph-view.test.tsx`: 42 tests PASS.
- `npm run typecheck`: PASS.
- `git diff --check`: PASS（既存dirty filesのCRLF warningのみ）。

## Conclusion

現時点で確認できたのは、installed appが基本的なWindows accessibility treeを公開し、GraphのDOM keyboard回帰が通ることまでである。実Windows Graph flow、倍率、screen reader、High Contrastは未証明であり、PASSとして扱わない。

次の作業は、実Windows手動packetで上記SKIPを測定すること。失敗が確認された場合だけ、最小の修正sliceを要件化する。
