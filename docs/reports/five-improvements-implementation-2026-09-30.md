# TSUZUNE 5項目改善 — source実装と隔離検証（2026-09-30）

利用者が選択したMarkdown表示 → リンクプレビュー → ショートカット設定 → Basesセル編集 → Properties全体管理を実装した。本番反映は停止中。実行範囲と再開点は[PLAN Current Decision](../../PLAN.md#current-decision)が所有する。

## 利用できる操作

| 項目 | sourceの実装 |
|---|---|
| Markdown | 現在ノート基準の相対 `.md` リンク、同一／別ノートの見出し移動。ATX／Setext、見出し名優先、重複slug連番。Outlineのsource offsetを保持。保存失敗で移動せず、リンク切れの理由を表示する |
| 表・タスク | `remark-gfm` 4.0.1を[公式のplugin導入方法](https://github.com/remarkjs/react-markdown#use-a-plugin)で追加。表と読み取り専用チェックボックス |
| プレビュー | Preview内のWiki／Markdownノートリンクにhover／focusで最大400文字。見出し指定は該当節、指定なしは本文先頭。snapshotを使いEscapeで閉鎖。「開く」は保存確認を通る通常の移動経路 |
| ショートカット | 設定画面で主要操作の組合せを登録／解除／復元。衝突・編集／OS予約キーを拒否し永続化。固定handlerを共通dispatchへ統合。IME／repeat／modal／busyをガード |
| Bases | `file.*`以外のノートPropertyセルを編集し、変更前後をプレビューして保存／取消。保存後にfilter／sortを再評価。解析できないセルはソース編集へ移動 |
| Properties | Vault別の宣言型6種と観測値を分離。型不一致・空値・解析不可を表示。宣言のみではMarkdownを書き換えない。対象を明示選択した型変換／名前変更にプレビューとrevisionを必須化 |

## 保存と型の境界

セル／一括処理は共通のmain `previewPropertyChanges`／`applyPropertyChanges` IPCを使う。対象scopeと全選択revisionを再検証し、競合・複雑YAML・重複キー・名前衝突では書込み0件で停止する。開始後の失敗は保存済みを残して残りを停止し、失敗／未処理の再プレビューから再開する。ノート単位のatomic writeを既存Vault保存へ接続した。MCPの書込み権限は拡張していない。

日付は厳密な `YYYY-MM-DD`、日時はISO文字列。時刻・秒／小数秒・既存offsetを保持し、timezoneを補完しない。曖昧な日付、datetimeの切り捨て、listの結合、複数要素のscalar化は拒否する。BOM・CRLF・コメント・本文を保つ。名前変更はキーだけを変更し、宣言型を新名へコピーして旧名も残す。Basesの列／filter／sort参照は影響一覧だけを表示する。

通常の可視ノートだけが対象で、除外設定・隠しpath・原典・履歴は保護する。未保存編集・Vault切替中・設定未取得では編集開始を止める。値の変換によって全Vaultの宣言型を自動変更しない。

## 検証

- `npm run build`（typecheckを含む）、`npm test`、`npm run check:mcp`、`npm run check:current-decision`、`git diff --check`を実行。最終件数は[results](../../.agent/requirements/20260930-five-improvements/results.md)と `work/five-improvements-20260930/final-tests.json` を参照。
- focused testsは日本語／空白リンク、重複見出し、GFM、focus／Escape、hotkey衝突／IME／repeat、セル保存後sort、日付、日時offset、BOM／CRLF／コメント／本文、preflight競合、部分完了、設定Vault分離を扱う。
- source-built Electronの隔離profile／匿名fixture Vaultで実画面・preload・main IPCを通した。GFM、focus preview／Escape、リンク移動後H2 focus、実IPC変換／キー変更、セル保存後filter、再起動後hotkey／型設定を確認。通常 `%APPDATA%/TSUZUNE/settings.json` のSHA256不変。profile全ファイルの比較やinstalledの受入ではない。
- `runtime/first.json`、`restart.json`、`cell.png` は同work directory。実OSの日本語IME・Narrator・High Contrast・720px／200%・本人の操作性は未確認。synthetic IMEテストを実OS受入とはしない。
- 途中の実画面で見出しfocusの再描画による消失を発見し、pending状態を解除した後の描画でfocusするよう修正した。本文先頭のpreview保持とSetext下線除去、suffixを含む見出しとのslug衝突も回帰対象とした。

## 本番反映の停止理由

9月21日のexact source archiveのdigestは確認できた。9月24日へ変わった12候補のうち10件は候補sourceと一致したが、当時の `PLAN.md`／`PROJECT_STATUS.md` が欠けるため、9月24日の全体fingerprintは再構成できない。[監査入口](current-state-reconciliation-2026-09-30.md)と `work/five-improvements-20260930/production-base-audit.json` を参照する。

ユーザーの指定どおり `production:update` を実行していない。packaged／installed smoke、built／installed EXE・app.asar一致、通常profile全体不変、MCP再登録、本人受入は未実施。本番Vaultの値を検証で変換していない。現在dirty tree全体の暗黙promotionも行っていない。

再開にはproduction-equivalent source境界の確認が必要。その後、repository文書を確定して本番gateと隔離packaged／installed受入へ進む。既存の未commit差分は保持し、所有外baselineファイルの保全結果を `preservation.json` に保存する。
