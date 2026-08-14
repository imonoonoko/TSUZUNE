# CP1-B-02 — Markdownノートの「フォルダで表示」

## 結論

**PASS。** 固定済みObsidian 1.13.4比較に存在する実在Markdownノートの`フォルダで表示`を、TSUZUNEの既存安全経路へ接続した。

## 根拠と変更

- 固定参照: `docs/reports/assets/graph-gp0-node-context-menu/comparison.json`。`00_Home.md`のメニューに`フォルダで表示`が有効表示される。
- 既存製品経路: `revealVaultFile`はVault相対pathを`resolveFileForOpen`で検証してから`electron.shell.showItemInFolder`へ渡す。添付専用APIではない。
- 原因: Rendererのメニュー表示と呼出前guardだけが`attachment`へ限定していた。
- 修正: 実在する`note`または`attachment`を同じ既存経路で扱う。tag／unresolvedは引き続き拒否する。
- 追加しなかったもの: 新規IPC、抽象化、依存関係、OS Explorerの実起動、保留中のinternal File Explorer操作。

## 検証

- `vitest run tests/wiki-graph-view.test.tsx tests/app.safety.test.tsx tests/ipc.graph-settings.test.ts`: **3 files / 109 tests PASS**
- `tsc -b tsconfig.node.json tsconfig.web.json --pretty false`: **PASS**
- 対象差分の`git diff --check`: **PASS**
- Ponytail review: **Lean already. Ship.**

## CP1-B監視

- sample: **2/3**
- result: **PASS**
- elapsed: **304,072 ms**
- tool calls: **23**
- retries: **2**
- input: **2,879,456**
- cached input: **2,810,624**
- output: **5,581**
- reasoning: **1,513**

品質は維持したが、この長大継続taskも約288万inputを要した。fresh境界の有効性を一般化するには、残る自然task 1件を同じ契約で観測する。

本番TSUZUNEの既存プロジェクトノートはrevision guard付きで同期し、revision `sha256:1663208bc53266355aa0d7e56fb73ba0f016bfbb158340e168dde374845bf471`となった。

## 未証明

- Windows Explorerが実際に起動し、対象ファイルを選択表示する実OS受入
- 物理入力、screen reader、High Contrast、multi-DPI、pixel identity
- `ファイルエクスプローラでファイルを表示`（internal File Explorer）はGP0-3b-pの保留を維持
