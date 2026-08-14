# A2-1 通常検索演算子 実装報告

日付: 2026-08-15

branch: `agent/tsuzune-mcp-integration`

対象: Renderer の通常検索のみ

## 結論

Renderer 通常検索へ implicit AND、`-` 否定、`tag:`／`path:`／`file:` filter、quoted phrase を追加した。`searchNotes` は従来契約のまま残し、Renderer だけが `searchRendererNotes` を呼ぶため、MCP search の経路と挙動は変更していない。

実装は `src/core/search.ts` の純粋 parser と Renderer 専用検索入口、`src/renderer/App.tsx` の呼び替えだけである。新規 dependency、database、index、検索基盤は追加していない。

## 固定参照の状態

Obsidian公式releaseからDesktop 1.13.4 installerを取得し、隔離runtimeへ展開した。installer SHA-256 `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0`、asar SHA-256 `51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`、実行時version `1.13.4`を照合した。本番Vaultを使わず、コピーした匿名7-note fixtureと専用user-dataで通常のglobal Searchを操作した。

19-query matrixを完走した結果、fallbackとの差は `tag: project` と `-` 単独の2件だった。Obsidian実測を優先して実装・要件・JSON・testを同期し、次を正本として固定した。

- 要件: `.agent/requirements/20260815-0420-a2-1-search-operators/4_requirements.md`
- 結果集合: `docs/reports/assets/a2-1-search-operators/obsidian-1.13.4-query-results.json`
- 自動回帰: `tests/renderer-search-query.test.ts`

JSON の参照statusは `measured` である。添付 `diagram.svg` は否定queryのObsidian結果にも現れたが、TSUZUNE Rendererの対象はMarkdownノートなので、収集器で別記し結果path集合から除外した。

## 凍結した semantics

- 通常語は name、path、content の大文字小文字を区別しない部分一致。
- 空白区切りの各clauseをANDする。
- `-` は直後の通常語、phrase、filterを除外条件にする。`-` 単独は実測どおり結果なし。
- phraseは空白を含む連続substring。大文字小文字を区別しない。
- `path:` は拡張子を含むVault相対pathの部分一致。
- `file:` は拡張子を含むbasenameの部分一致。
- `tag:` は`#`省略可。完全tagと子tagに一致し、大文字小文字を区別しない。
- filterは候補集合だけを絞り、通常語scoreには加点しない。通常語ごとに従来scoreを加算する。
- 演算子のcolon直後の空白は許容し、`tag: project` は `tag:project` と同義。
- 未知演算子、空phrase、閉じていないquoteは通常語へ戻す。値なし `tag:` は実測どおり結果なし。

## Query matrix

| query | 結果path |
|---|---|
| `Project` | `00_Home.md`, `10_projects/Project Alpha.md`, `10_projects/Project Beta.md`, `20_knowledge/Distillation.md` |
| `Project active` | `10_projects/Project Alpha.md` |
| `Project missing` | `00_Home.md` |
| `Project -paused` | `00_Home.md`, `10_projects/Project Alpha.md`, `20_knowledge/Distillation.md` |
| `-excluded` | `80_excluded/Hidden.md`以外の6件 |
| `tag:project` | Project Alpha, Project Beta |
| `tag:#project/active` | Project Alpha |
| `TAG:PROJECT` | Project Alpha, Project Beta |
| `path:10_pro` | Project Alpha, Project Beta |
| `path:knowledge Distillation` | Distillation, Reference |
| `file:project` | Project Alpha, Project Beta |
| `file:alpha` | Project Alpha |
| `"Project Alpha"` | Home, Project Alpha, Project Beta |
| `"project alpha"` | Home, Project Alpha, Project Beta |
| `"知識を残す"` | Distillation |
| `tag:` | 0件 |
| `tag: project` | Project Alpha, Project Beta |
| `owner:Home` | 0件 |
| `-` | 0件 |

`Project missing` が Home に一致するのは、fixtureのHomeが `[[Missing Note]]` と Project linkを同時に含むためである。`path:knowledge Distillation` がReferenceにも一致するのは、その本文が `[[Distillation]]` を含むためである。

## 検証

1. `npm run typecheck`: PASS。
2. parser unit: PASS。空query、演算子のみ、`tag:`値の空白、日本語、大文字小文字、`-`単独、未知演算子、未閉quote、空phraseを固定。
3. search integration: PASS。匿名7-note fixtureと19-query結果集合をJSONから全件検証。
4. 回帰anchor: PASS。通常語 `Project` のRenderer専用入口の全 `SearchResult` が従来 `searchNotes` と同一。
5. 既存search tests＋`npm run check:mcp`: PASS。MCP smokeはread 6 tools／write 7 tools。
6. production tests: `NODE_OPTIONS=--max-old-space-size=6144` と `vitest run --maxWorkers=1` で65 files／655 tests PASS。
7. `git diff --check`: PASS。
8. Ponytail review: Lean。既存tag抽出・score・sortを再利用し、余計な抽象化、新規dependency、将来用基盤はない。空phraseが全件一致し得る問題はreview中にtestを追加して修正した。

## Scope監査

変更対象は次だけである。

- `src/core/search.ts`
- `src/renderer/App.tsx`
- `tests/renderer-search-query.test.ts`
- 本report、結果集合JSON、要件凍結文書

`src/mcp/service.ts`、build_context、Graph、FileTree、`50_履歴`除外、Drive、本番Vaultは無変更。commit、push、releaseは実行していない。

## 本番反映

利用者がTSUZUNEを閉じたことを確認後、`NODE_OPTIONS=--max-old-space-size=6144`で公式`npm run production:update`を完走した。

- production gate: 10/10 PASS
- 更新内全test: 65 files／655 tests PASS
- MCP smoke: read 6／write 7 tools PASS
- build／installed executable SHA-256: `627090dc24283b0e56e6b5f8629335b3c50f39c21dc1b103c21ef2758d6b364b`で一致
- build／installed app.asar SHA-256: `204b62945211b732eda8d1a56be694b8c056a6a02c7701160a06ccba67e6b99e`で一致
- production profile: 更新前後58 files、digest `8f422a6ff00cde2c55c7d7466e09d3f585f66ed22497a85521f73afecd097c62`でbyte-identical
- receipt: `docs/reports/production-update-latest.json`

本番反映は完了した。commit、push、releaseは未実施。

## 実機受入

固定Obsidian Desktop 1.13.4の隔離実測は完了した。fallbackとの差2件を反映後、結果集合JSONの19 queryを自動回帰で固定した。

本番反映後、利用者がinstalled TSUZUNEの通常検索で次を画面確認した。

- `tag:project`: 0件。現行Vaultに該当tagがないため妥当。
- `Project -paused`: 複数のProject一致結果を表示し、複合queryが動作。
- `file:alpha`: 0件。現行Vaultに該当basenameがないため妥当。
- `"Project Alpha"`: 完全phraseを含む1件を表示。

installed Renderer検索の実機受入をPASSとする。
