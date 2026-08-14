# CP0-T02 Global Graph malformed query parity

## 結論

固定7 queryのObsidian 1.13.4参照captureを取得し、TSUZUNEと比較した。

- query入力、Graph再表示、アプリ再起動後の保持: **7/7一致**
- visible error表示: **7/7一致**（両方とも7件すべて表示なし）
- 実在noteのnode集合: **修正後7/7一致**
- raw Graph node ID集合: **2/7一致、5/7差あり**

`/(?/` のcompile-invalid regexは、Obsidianが検索制約を適用せず全nodeを維持するのに対し、TSUZUNEは修正前に0件へ閉じていた。`matchesGraphQuery`で`SyntaxError`だけをfail-openにし、通常のparser errorはfail-closedのまま維持した。

残る5件のraw差は、malformed parserではなく未解決link nodeの扱いである。Obsidianは検索時も`Missing Note`を残すが、TSUZUNEは4件で除外し、全node表示時もIDを`Missing Note.md`として持つ。この差は`filterWikiGraph`とunresolved node identityの別責務なので、CP0-T02では修正しない。

## 固定条件

- reference: Obsidian Desktop 1.13.4（既存固定binary hash検証を使用）
- candidate: TSUZUNE working-tree build
- fixture: `fixtures/obsidian-graph-parity-vault` の隔離copy
- window: `-32000, -32000` の画面外、非表示、taskbar除外
- lifecycle: query入力 → Graph close/reopen → 別processでapp restart
- 通常Vault、通常Obsidian profile、fixture原本、product sourceをcapture中に変更しない

## Matrix結果

| case | query | 実在note | raw node | error | lifecycle | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| unclosed-quote | `"Project` | 一致 | `Missing Note`だけObsidianに残る | 一致 | 一致 | different |
| trailing-or | `Project OR` | 一致 | `Missing Note`だけObsidianに残る | 一致 | 一致 | different |
| unclosed-paren | `(Project` | 一致 | `Missing Note`だけObsidianに残る | 一致 | 一致 | different |
| unclosed-regex | `/Project` | 一致 | `Missing Note`だけObsidianに残る | 一致 | 一致 | different |
| unclosed-property | `[status:Act` | 一致 | 一致（0件） | 一致 | 一致 | matched |
| invalid-regex | `/(?/` | 修正後一致 | unresolved IDの`.md`差だけ | 一致 | 一致 | different |
| expressionless-paren | `(` | 一致 | 一致（0件） | 一致 | 一致 | matched |

詳細値は [`comparison.json`](assets/graph-gp0-malformed-query/comparison.json) と各caseの`observation.json`を正本とする。

## Product change

- `src/core/graph-query.ts`: regex compile時の`SyntaxError`だけを「制約なし」として扱う。
- `tests/graph-query.test.ts`: `/(?/` と `/[/` をfail-open、`(`をfail-closedとして固定。
- capture script 2本: 固定case/queryを隔離出力へ渡し、node集合とerror表示を観測する専用modeを追加。通常captureの既存断言は変更していない。

## Verification

- `node --check scripts/probe-obsidian-graph-search-persistence.mjs`: PASS
- `node --check scripts/capture-graph-gp0-3b-search-restart.mjs`: PASS
- regression RED: `npx vitest run tests/graph-query.test.ts` → 2 FAILを確認
- regression GREEN: `npx vitest run tests/graph-query.test.ts` → 12 PASS
- `npm run build`: PASS
- `npm run test:production`: 58 files / 519 tests PASS
- `npm run check:mcp`: 4 read tools / 3 write tools PASS
- `npm run production:update`: PASS（v0.5.0、10/10 production checks、installed-and-verified）
- installed hash: built / installed の `TSUZUNE.exe` と `app.asar` が一致
- production profile: update前後で57 files / digest一致、変更なし
- Obsidian capture: 7/7 `reference-captured`
- TSUZUNE capture: 7/7 `captured`、全caseで隔離process残存0

本番反映の機械可読な正本は [`production-update-latest.json`](production-update-latest.json) とする。検証時刻は2026-08-12 04:51 JST、source fingerprintは `9830ae856f83790a89883d904c043e194358a02e20b08bd7bbdbfa8d603be7c3` である。

## 判定と次の境界

CP0-T02は **different** として完了する。compile-invalid regexのparser差は閉じたが、Global Graph Search全体のraw parityは未完である。

次に扱う場合は、`filterWikiGraph`におけるunresolved nodeの保持条件と、`Missing Note` / `Missing Note.md`のidentityを一件の別taskとして固定する。今回のparser修正へ混ぜない。
