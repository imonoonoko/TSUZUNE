# CP0-T05 Excluded files MCP retrieval

## 結論

TSUZUNEのアプリ全体設定`userIgnoreFilters`が、通常UIだけでなく本番MCPの検索・Context取得にも適用されるようにした。

- 修正前のMCPは`lastVaultPath`だけをsettingsから読み、`vault.scan()`を無引数で呼んでいた。
- 修正後はsettingsから同じ`userIgnoreFilters`を読み、既存`VaultService.scan(filters)`へ渡す。
- 公開回帰では、`Projects`を除外したsettingsを使うMCP `search`が対象ノートを0件とし、`buildContext`も対象本文を含めない。
- 明示`--vault`は従来どおりapp settingsから独立し、fixture／smoke／benchmarkへ本番除外設定を混入させない。

CP0-T05は`pass`である。ただし、これはTSUZUNE内部の全体設定契約をMCPへ接続した判定であり、Obsidian 1.13.4のManage UIや全surface parityが一致したという判定ではない。

## 固定した差

TSUZUNEの設定画面は「除外するファイル」をVault全体の設定として保存し、対象を一覧・検索・リンク・グラフから除外すると説明している。rendererはfilter済みsnapshotを共有するため、通常の検索・Wiki link・Graphでは設定が効く。

一方、`VaultMcpService.snapshot()`はsettings-selected Vaultでも`vault.scan()`を無引数で呼んでいた。そのため、本番アプリで除外したノートをMCP `search`と`build_context`が再取得できた。検索層やContext builderに後段フィルタはなく、settings読取境界で配列を捨てることが根本原因だった。

## 最小変更

- `src/mcp/vault-source.ts`
  - settings-selected Vaultでは`lastVaultPath`と`userIgnoreFilters`を一度に解決する。
  - 既存`parseUserIgnoreFilters`を再利用する。
  - 明示`--vault`は空のfilter配列を返し、従来の隔離挙動を維持する。
- `src/mcp/service.ts`
  - 解決済みfilterを既存`VaultService.scan`へ渡す。
- `tests/mcp-service.test.ts`
  - settings-selected VaultでMCP search／Contextから除外ノートが消える公開回帰を追加する。

新規dependency、filter実装、DB、index、Hook、cache、将来用serviceは追加していない。Ponytail reviewは`Lean already. Ship.`である。

## TDD証拠

1. RED: `userIgnoreFilters: ["Projects"]`を保存したsettingsをMCPへ渡しても、`search("AI連携")`が`Projects/TSUZUNE.md`を返し、1件FAILした。
2. GREEN: source resolverで既存filterを保持してscanへ渡す最小修正後、同じ公開テストがPASSした。
3. 周辺回帰: MCP service、excluded-files、settingsの3 files／32 testsがPASSした。

## 検証と本番反映

- 対象回帰: 1 test PASS
- 周辺回帰: 3 files / 32 tests PASS
- `npm run typecheck`: PASS
- `npm run check:mcp`: 4 read tools / 3 write tools PASS
- `npm run test:production`: 58 files / 521 tests PASS
- `npm run production:update`: 10/10 checks PASS
  - packaged／installed smoke: PASS
  - built／installed executable SHA-256: `a38583c68f51f1b4d398f2e92f067ef1d17a99b8c1b881b50ca664185e3f06e6`
  - built／installed app.asar SHA-256: `b72f9184933e0c445c20ba2d0b18cbce882e68fb12edca6cba20b030ab2e9ad1`
  - production profile: 57 files、更新前後digest一致
  - source fingerprint: `36f470fc9834a11f99a2793a075841ad43370ae6051de549ba20f24a43cf386b`

本番反映の機械可読な正本は[`production-update-latest.json`](production-update-latest.json)である。

## 残る境界

- Obsidian 1.13.4のExcluded files Manage UIと適用後集合を示す固定captureは存在しない。fresh参照を取るまでUI parityを主張しない。
- TSUZUNE scannerはnote／attachmentを除外するが、directory一覧はfilterしていないため、除外folderが空folderとしてFileTreeへ残る。この挙動の正否も固定参照なしに変更しない。
- 今回の回帰はMCP `search`と`build_context`を固定した。全tool・全UI surfaceのObsidian一致を証明したものではない。
- candidateはHEAD `5266131`を基点にしたdirty working treeであり、commit固定ではない。本番同一性はproduction receiptのsource fingerprintとinstalled hashを使う。
- model-visible token、prompt cache、reasoning token、実費はhostから公開されておらず、推定していない。
