# Full-text Search P0-3/R3 Acceptance

日付: 2026-08-18（JST）
状態: implemented, installed, and verified

## 結論

Obsidian級Daily Workspaceの第3 sliceとして、既存のpersistent Vault searchを「内容を検索」として本番TSUZUNEへ反映した。`Ctrl+Shift+F`で左sidebarをrevealして入力欄へfocusし、既存の`Ctrl+K`は互換aliasとして維持する。`tag:`、`path:`、`file:`、quoted phrase、negationは既存parser／rankingをそのまま使い、結果にtitle、path、modified time、match周辺excerptと肯定語の意味的強調を表示する。

新しいindex、database、BM25、embedding、recent-search永続化、外部AIは追加していない。今回の目的は既存の検索能力を、少ない差分で日常利用できる入口と証拠に揃えることである。

## 実装境界

- `src/renderer/App.tsx`: global shortcutの`Ctrl+Shift+F`を既存`focusVaultSearch`へ接続。`Ctrl+K`を維持し、search inputとCommand Palette commandを「内容を検索」へ統一。operatorのinline helpと`aria-keyshortcuts`を追加。
- `src/renderer/components/FileTree.tsx`: 既存`parseRendererSearchQuery`と`segmentJapaneseQuery`を再利用し、肯定のterm／phraseだけをexcerpt内で`mark.search-match`にする。除外語と`tag:`／`path:`／`file:`は強調しない。
- `src/renderer/styles.css`: `mark`に太字／下線を与え、色だけに依存しない。既存excerptのellipsis／nowrap契約は変えない。
- `tests/app.safety.test.tsx`／`tests/file-tree.test.tsx`: shortcut、reveal／focus、ラベル、help、肯定phraseのみのsemantic markを固定。
- `scripts/check-full-text-search-ui.mjs`: 本番buildを隔離Vault／隔離profileで起動し、shortcut、focus、operator query、result metadata、強調style、Markdown digestを検査。

## TDDと複雑さ境界

1. `Ctrl+Shift+F`のREDは、左sidebarが閉じたままで検索入力が現れない理由で失敗した。既存shortcut handlerの1分岐だけでGREEN化した。
2. search label／helpのREDはaccessible nameが旧「Vaultを検索」のままで失敗し、表示・accessible name・shortcut表示を同じ語彙へ揃えてGREEN化した。
3. excerpt強調のREDは`mark.search-match` 0件で失敗し、既存parserの肯定clauseだけを使う小helperでGREEN化した。

`ponytail-review`は`Lean already. Ship.`。既存parser、既存ranking、既存focus helper、標準の`mark`を再利用でき、新規依存や将来用abstractionはない。

## 検証

- focused App／FileTree: `86 PASS`。
- 全体: `765 PASS / 1 SKIP`（75 test files PASS、1 test file SKIP）。
- `npm run typecheck`: PASS。
- `npm run build`: PASS。
- `npm run check:mcp`: PASS。Codex／Freebuff 15 tools、direct 17 tools、read 9／write 8。
- `git diff --check`: exit 0。既存working treeのLF→CRLF予告のみ。
- 対象working treeは開始前からdirty。無関係な差分をrevert／commitせず、公式production gateで同一snapshotを受入した。

## 隔離Electron画面受入

`fixtures/obsidian-graph-parity-vault`と`work/full-text-search-ui-userdata`を使い、メイン画面を画面外で起動した。

- 左sidebarを閉じた状態から`Ctrl+Shift+F`を送り、sidebar展開とsearch input focusを確認。
- queryは`"Project Alpha" tag:#project/active -nonexistent`。結果は1件で、name、Vault-relative path、最終更新、match周辺excerptを確認。
- `markTexts` は`["Project Alpha"]`のみ。除外語とtag filterはmarkされない。computed styleはfont weight `700`／underline。
- fixture Markdown SHA-256は前後とも`99261427a78c3246518b4c8812544c5d510840ec5d129ec21413d01e5f9ab047`で不変。

機械可読結果は[capture-result.json](assets/full-text-search-2026-08-18/capture-result.json)、画面は[01-full-text-search.png](assets/full-text-search-2026-08-18/01-full-text-search.png)を正本とする。

## 本番受入

`npm run production:update`は10/10 checksをPASSした。

- installed version: `0.5.0`
- source fingerprint: 1,043 files、`e13eefc1f3f246665e833e8ecd34b2ff3f7104304a6e92e75166d1d1aaf61374`
- installer SHA-256: `2c7fe7db12de4efac31b37c407bbd7eadbcab708eaa303031a40f355e644f3ef`
- executable SHA-256: `deb0c737fad6398bedc15d63f096fe707a5cae385da2774ac83eda0c77f6aeac`
- `app.asar` SHA-256: `0f9ff2803831ad4cca5a97f380cba074d8f2ee19b0fbed6a02a4d60bd1274a34`
- built／installed executableと`app.asar`: 一致。
- `%APPDATA%\TSUZUNE`: 58 files、前後digest `15626ba4a95fd863ee87eaf319311481bb1632d47b079fb5c6eaa1fbebd25794`で不変。
- packaged／installed isolated smoke、silent install、Codex MCP再登録: PASS。

機械可読な最終境界は[production-update-latest.json](production-update-latest.json)を正本とする。この受入後の文書同期は製品binaryを変更しない。

## 残る受入境界

- 実WindowsのNarrator／NVDA、100〜200% DPI、High Contrast、物理keyboard、IME確定入力は未実測。隔離Electron／DOM testを実機assistive-technology受入とは呼ばない。
- recent search、新index、BM25、embedding、検索行動ログは、実利用で反復する詰まりが計測されるまで追加しない。
- P0-4/R4 FileTreeは要件化済みのstaged候補だが、現役sliceとしては未選定。
