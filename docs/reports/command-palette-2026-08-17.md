# Command Palette P0-2 Acceptance

日付: 2026-08-17（JST）
状態: implemented, installed, and verified

## 結論

Obsidian級Daily Workspaceの第2 sliceとして、`Ctrl+P`のCommand Paletteを本番TSUZUNEへ反映した。日本語labelとstableな英語keywordから12件の安全な既存操作を検索し、shortcut、現在状態、利用不可理由を文字で確認してから実行できる。Arrow／Home／End／Enter／Escape、単一modal、背景`inert`、起点focus復帰をQuick Switcherと共通化した。Markdown正本、既存action handler、Paper／Thread Tealを維持し、新規依存やplugin architectureは追加していない。

## 実装境界

- `src/renderer/components/CommandPaletteDialog.tsx`: NFKC正規化した複数token AND検索、combobox／listbox／option、最大50件、keyboard操作、no-result、disabled reason。
- `src/renderer/App.tsx`: `Ctrl+P`と表示ボタン、現在状態を反映する12 command、既存create／open／search／sidebar／view／Graph／Bookmarks／Settings handlerへの接続、modal間のfocus handoff。
- `src/renderer/styles.css`: Quick Switcherと同じtransient-layer語彙、shortcut pill、状態／利用不可表示、選択の色以外の識別、forced-colors輪郭。
- `scripts/check-command-palette-ui.mjs`: 本番buildを隔離Vault／隔離profileで起動し、wide／main-window最小幅、focus、`inert`、英語keyword検索、sidebar実行、Escape復帰、横overflow、Markdown digestを検査。

最初のcommand setは、新規ノート、今日のノート、ノートを開く、Vault検索、左右sidebar、編集、プレビュー、ローカルGraph、Vault Graph、Bookmarks、Settingsの12件とした。rename、move、trashなどの破壊・変更操作とplugin管理は含めていない。

## 公開挙動

- `Ctrl+P`はブラウザ／Electronの印刷を抑止し、非modal・非busy状態でCommand Paletteを1枚だけ開く。
- queryは日本語label、英語keyword、表示shortcutを対象に、空白区切りの全tokenが一致するcommandだけを元の順序で表示する。
- active commandは`現在:`、実行できないcommandは`利用不可:`と理由を表示し、色だけに依存しない。
- disabled commandは選択されてもEnter／clickで実行せず、paletteを閉じない。
- Quick Switcher、Settingsへ移るcommandはmodalを重ねず、最終的なEscapeでCommand Paletteを開いた正確な起点へfocusを返す。
- 左sidebarが閉じている時のVault検索はsidebarを開いて検索欄へfocusし、既に開いている時は同期的にfocusする。

## 検証

- component: Command Palette dialog `6 PASS`。
- App統合: shortcut／単一modal／focus／disabled／sidebar／Quick Switcher handoff／既存handler接続 `6 PASS`。
- 全体: `755 PASS / 1 SKIP`（75 test files PASS、1 test file SKIP）。
- `npm run typecheck`: PASS。
- `npm run build`: PASS。
- `npm run check:mcp`: PASS。Codex／Freebuff 14 tools、direct 16 tools、read 8／write 8。
- scoped `git diff --check`: whitespace error 0。改行コードのLF→CRLF予告だけを確認。
- 独立Ponytail／accessibility review: P0／P1指摘0。12件のcommand配列をrenderごとに作る点は、現規模ではmemo化より単純さを優先した。

## 隔離Electron画面受入

隔離fixture `fixtures/obsidian-graph-parity-vault`と隔離userDataで、本番buildをbackground-safeに検査した。

- wide target `1440x900`、main-window最小target `760x768`。
- palette 1枚、input focus、12 options、選択1件、背景`inert`を確認。
- `sidebar`で左右sidebarの2件だけへ絞り込み、Enterで左sidebarを閉じ、再表示後のEscapeで起点へfocus復帰。
- wide／最小幅ともdocumentとlistの横overflow 0。
- fixture Markdown SHA-256は前後とも`99261427a78c3246518b4c8812544c5d510840ec5d129ec21413d01e5f9ab047`で不変。

機械可読結果は[capture-result.json](assets/command-palette-2026-08-17/capture-result.json)、画面は[wide initial](assets/command-palette-2026-08-17/01-wide-initial.png)、[wide filtered](assets/command-palette-2026-08-17/02-wide-sidebar-filtered.png)、[minimum-width filtered](assets/command-palette-2026-08-17/03-narrow-sidebar-filtered.png)を正本とする。fixtureは起動時にノート選択済みのため、disabled表示はElectron検査では`not-tested`とし、component／App統合testで固定した。

## 本番受入

`npm run production:update`は10/10 checksをPASSした。

- installed version: `0.5.0`
- source fingerprint: 1,037 files、`d58207ba14dfe277ff4a60e247856332017713d1625aaae0aa88c768c306f878`
- installer SHA-256: `b0c0c2fb4a98ad1cfec02e2408127903d3e19026635ac6dc3269cf6c1de2b5e9`
- executable SHA-256: `dc19225f78891acd18a26326c66a49413a7899b0a997a4bb51454de7ed1ada72`
- `app.asar` SHA-256: `de7eafb59dd762fc8173f40c305fbefe633f8ed9839d8cce2260c7fcbdd81dc8`
- built／installed executableと`app.asar`: 一致。
- `%APPDATA%\TSUZUNE`: 58 files、前後digest一致、不変。
- packaged／installed isolated smokeとCodex MCP再登録: PASS。

機械可読な最終境界は[production-update-latest.json](production-update-latest.json)を正本とする。

## 残る受入境界

- 次のsliceはR3 Full-text Search。`Ctrl+Shift+F`、既存検索operatorのinline help、excerpt／path／modified timeを一つの検索surfaceとして受入する。
- 実WindowsのNarrator／NVDA、100〜200% DPI、High Contrast、物理keyboard、IME確定入力は未実測。隔離Electron／DOM testを実機assistive-technology受入とは呼ばない。
- commandの追加、recent／usage順、hotkey編集、plugin command登録は実利用の詰まりが観測されるまで追加しない。
