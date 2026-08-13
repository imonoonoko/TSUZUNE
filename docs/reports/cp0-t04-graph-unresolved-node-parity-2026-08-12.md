# CP0-T04 Global Graph unresolved-node parity

## 結論

CP0-T02で分離したGlobal Graphの未解決Wiki link差を閉じた。

- 未解決nodeの公開IDを`Missing Note.md`からObsidian 1.13.4と同じ`Missing Note`へ合わせた。
- Graph検索では、queryに一致したsource noteから伸びる未解決nodeを保持する。
- 解決済みの隣接noteは自動で広げず、既存の検索集合を維持する。
- CP0-T02と同じfixture、同じ7 queryのnode集合は修正後 **7/7一致**した。

CP0-T04は`pass`である。CP0-T02の`comparison.json`は修正前の歴史的証拠として改変せず、現在の回帰契約は`tests/graph.test.ts`を正本とする。

## 再利用した固定参照

- reference: Obsidian Desktop 1.13.4
- installer SHA-256: `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0`
- app.asar SHA-256: `51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`
- fixture: `fixtures/obsidian-graph-parity-vault`
- fixture 9 files combined SHA-256: `3AC87B1F134207B122E690A7E55D02B67935F23B726FF5F2CB70F12A1336D7D3`
- query matrix: [`query-matrix.json`](assets/graph-gp0-malformed-query/query-matrix.json)
- 修正前比較: [`comparison.json`](assets/graph-gp0-malformed-query/comparison.json)

固定参照では、`"Project`、`Project OR`、`(Project`、`/Project`の4件でObsidianだけが`Missing Note`を保持し、`/(?/`ではObsidianが`Missing Note`、TSUZUNEが`Missing Note.md`を返していた。`[status:Act`と`(`は両方0件だった。

## 根本原因

`resolveIndexedWikiLink`は未作成Markdown targetを正規化して`.md`を付ける。`buildWikiGraph`はその値を未解決nodeの`path`とedgeの`targetPath`へそのまま使っていたため、表示名は`Missing Note`でも公開node IDは`Missing Note.md`になっていた。

さらに`filterWikiGraph`は全nodeをqueryへ独立評価していた。未解決nodeにはnote本文がないため、sourceの`00_Home.md`が`Project`で可視になっても、そこから伸びる`Missing Note`だけが除外された。

## 最小変更

- `src/core/graph.ts`
  - 未解決Wiki nodeをGraphへ追加するときだけMarkdown拡張子を外す。
  - query評価後、可視sourceから伸びる`kind: unresolved`のtargetだけを可視集合へ加える。
- `tests/graph.test.ts`
  - 既存の未解決node契約を拡張子なしIDへ更新する。
  - 実fixtureを直接読み、固定7 queryのnode path集合をObsidian参照と比較する。

新規dependency、DB、index、Hook、設定、抽象化は追加していない。Ponytail reviewは`Lean already. Ship.`である。

## TDD証拠

1. identity RED: `Missing Note`を期待し、実際は`Missing Note.md`で1件FAIL。
2. identity GREEN: Graph生成時の未解決Wiki targetだけ拡張子を外し、16/16 PASS。
3. retention RED: source noteがquery一致しても未解決targetだけ欠落する1件FAIL。
4. retention GREEN: 可視sourceの未解決targetだけ保持し、17/17 PASS。
5. 最終的に同じfixtureと7 queryを一つの回帰検査へまとめ、16/16 PASS。

## 検証

- `npx vitest run tests/graph.test.ts`: 16 tests PASS
- `npx vitest run tests/wiki-graph-view.test.tsx tests/app.safety.test.tsx`: 98 tests PASS
- `npm run typecheck`: PASS
- `npm test`: 58 files / 520 tests PASS
- `npm run production:update`: PASS
  - production checks: 10/10 PASS
  - MCP smoke: 4 read tools / 3 write tools PASS
  - packaged／installed smoke: PASS
  - built／installed executable SHA-256: `686ba03e1c4ca54625e1a1c3ae9e430ff22e8a01292c324a8ee1425d5a423e61`
  - built／installed app.asar SHA-256: `a364db5b01d3c68ab9714770fadfd0e805c684bea0e87ca069ac5d25aa11faeb`
  - production profile: 57 files、更新前後digest一致
  - source fingerprint: `db4154e558a0d3594ad2eda41b39dc3a2cf92445f1e1efdf2b57b8a83abfedc6`

本番反映の機械可読な正本は[`production-update-latest.json`](production-update-latest.json)である。

## 残る境界

- Obsidian側はCP0-T02の固定offscreen captureを再利用し、今回fresh GUI captureは行っていない。
- 回帰検査はGraphの公開data seamを比較した。node位置、Force力学、pixel identity、物理入力、実OSアクセシビリティは今回の対象外である。
- candidateはHEAD `5266131`を基点にしたdirty working treeであり、commit固定ではない。現在の本番同一性はSemVerやHEADでなくproduction receiptのsource fingerprintを使う。
- host model-visible token、prompt cache、reasoning token、実費は公開されておらず、今回も推定していない。
