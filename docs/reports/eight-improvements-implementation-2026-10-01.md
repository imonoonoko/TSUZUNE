# TSUZUNE 8項目改善 — source実装・隔離検証（2026-10-01）

利用者が採用した8項目を、前回5項目の実装へ接続しsource実装・隔離検証を完了した。Markdownを正本とし、既存の未commit変更を保持した。2026-10-01、利用者が現在ツリー全体の新本番採用を明示承認した。本番更新結果は[最新receipt](production-update-latest.json)、最終運用記録は同campaignのVault実施記録で判定する。Git公開は対象外。実行順と再開条件は[PLAN Current Decision](../../PLAN.md#current-decision)が所有する。

## 変更した操作

| 項目 | 実装と保全境界 |
|---|---|
| 単体ノート移動 | 参照元だけでなく移動ノート自身の相対Markdownリンク・画像・添付・欠落先も元のVaultパスへ補正。URL範囲だけを置換し表示名・タイトル・fragment・BOM・改行・周辺本文を保持。コード・外部URL・自己見出しを除外し、既存preflight／復旧へ接続。フォルダの警告は維持 |
| 共通リンク | Wiki／inline Markdown／使用中referenceリンクを共通情報へ解決。source範囲・fragment・参照元を保持し、バックリンク・出リンク・Graph・Context・移動件数・MCP読取へ接続。見出し欠落とノート欠落を分離し辺を重複させない。既存frontmatter Wiki索引を保持。Markdown欠落先を自動作成しない |
| Bases | 列数制限撤廃、複数table view、列順／表示名、複数sort、入れ子条件。AST数式・型フィールド・数式参照／循環・リスト式・日付／期間・regex・File／Link、組込み／カスタム集計、1項目group。全体／group集計を表示。停止可能Workerで計算し結果はノートへ保存しない |
| Bases設定 | GUIからview／列／条件／sort／formula／summary／groupを編集し、設定差分と結果のプレビュー成功後だけ保存。人間用previewBaseChanges／applyBaseChangesでscope・revision再読取・atomic write。YAML ASTのsource範囲を編集し未知設定・コメント・未編集部分・BOM／CRLFを保持。重複キーや保全できない変更は停止 |
| Bookmark | 安定ID付きfile／heading／search。旧形式を互換読込し、同一ノートの複数見出しを個別保存。連番slugを解決し、消失時は理由と先頭を開く選択肢。検索は現在の可視snapshotで再実行。旧file callback／操作APIも保持 |
| Live Preview | Source／Live Preview／Preview。CodeMirror装飾・Widgetで見出し・強調・リンク・コード・引用・リスト・表・画像・taskを表示し、選択範囲はsourceを露出。IME中は更新凍結。本文・コピー・Undo／Redo・Outline offsetを保持。taskは読み取り専用、リンクは保存確認経路 |
| 分割workspace | 最大8ペインの水平／垂直分割、ペイン別tab／mode／scroll、tab移動・focus・close。V1を単一ペインV2へ移行。ノート別共有draftを保持し同じノートの編集は1つ、追加表示はPreview。中央／sidebarをpointer・keyboardで調整し名前付き配置と再起動へ保存。保存失敗・競合ではclose／Vault切替／移動停止 |
| 未リンク言及 | ファイル名・aliases一致を他本文から抜粋。英数字word boundary、日本語substring候補。link／code／frontmatter／HTMLコメント除外。曖昧な対象は選択。1件を選んだ時だけmainでrevision・範囲・一致・可視性を再確認してWikiリンク化。未保存・原典・履歴・除外への書込みを停止 |
| Local Graph | 既定1、深さ1〜3の方向付きBFS。循環・重複除外、探索辺と選択した近傍間の辺。Markdown辺を含め、深さ・方向を含む表示設定をworkspaceへ保存。言及は自動edge化しない |

数式関数・型フィールドの固定仕様とテスト対応は[公式仕様対応表](../../.agent/requirements/20261001-eight-improvements/bases-functions.md)へ集約する。公式仕様の対象以外を「全面Obsidian互換」と呼ばない。

日付の宣言型を評価へ渡し、既存日時のoffset／精度を保持する。セル編集は前回のProperty IPCを再利用し、filter／sort／group／summaryを再評価する。計算列とfile.*は読み取り専用。MCPにはBases保存・言及リンク化の書込みを公開していない。

## 検証と観測

最終 `npm test` は **1,705 PASS／1 SKIP、失敗0**。`npm run build`（typecheckを含む）、`npm run check:mcp`、`npm run check:current-decision`、`git diff --check` はPASS。担当ソースを固定した後に全体gateとbuildを再実行した。自動テストのraw JSON／logは除外済み `work/eight-final-tests.json`、`work/eight-final-tests.log`、`work/eight-final-check-mcp.log`、`work/eight-final-build.log`。実画面 **15 checks PASS／console error 0** の証拠は[隔離Electron結果](eight-improvements-isolated-evidence-2026-10-01.json)と同JSONのhash付き画像／bundle参照。

- focused: 実main移動、Unicode／空白／reference／画像／fragment、URL範囲保全、競合／復旧、frontmatter既存索引、MCPのsource相対解決、Graph方向／深さ。
- Bases: 全関数の正常／異常／組合せ、優先順位／循環、Worker停止（時間のかかるregexを含む）、日付／offset、集計／group、GUI preview失敗時保存禁止、コメント／未知設定／BOM／CRLFのsource保全、競合／readonly file。
- 編集／配置: Bookmark旧形式とtyped callback、slug消失、選択／IME synthetic event／コピー／Undo、8pane上限／復元、共有draft、切替中のautosave／競合／再編集、activepane shortcutsとscroll。
- 実Electron: 匿名fixture Vaultと専用profile、実preload／main IPC／bundled Worker／CodeMirror、readonly task／通常相対画像（count／complete／naturalWidth）／table、GUI Base preview非write→save、8ペインのV2保存→renderer再読込でtree・ID・tabs・mode・比率・幅一致、keyboard separator、720px・200%のoverflowによる配置維持を確認した。通常profile・本番Vaultは開いていない。隔離fixture／profileは検証後に削除した。OSプロセス再起動のV2保存・読取契約はworkspace service／IPC回帰で確認し、このrenderer再読込を実プロセス再起動と呼ばない。

最初の全体回帰で旧Bookmark callback、V1期待値、frontmatter Wiki索引の回帰を発見し修正した。実画面では通常相対Markdown画像の読込不良を発見し、既存のVault画像IPCへ接続した。YAML全体再出力による未編集部分の変化は、元sourceへの範囲編集へ改めた。修正後のgateを最終結果として扱う。

## 未確認と本番採用境界

実OSの日本語IME入力、Narrator読み上げ、Windows High Contrast切替、本人の操作性は未確認。compositionの自動テストやforced-colors emulationはこれらの代わりにならない。720px／200%は実Electronの自動操作で確認し、本人受入とは分ける。

固定参照Obsidian 1.13.4 runtimeは現存を確認できず、8項目の同一fixture比較は **not compared**。公式仕様・対応表とTSUZUNE fixtureの検証はあるが、Obsidian実行結果との一致は未証明。

9月24日の本番相当sourceは12候補中10件まで一致し、当時のPLAN／PROJECT_STATUSが欠落。[再構成監査](current-state-reconciliation-2026-09-30.md)と[前回の停止境界](five-improvements-implementation-2026-09-30.md)は当時の証拠として保持する。2026-10-01、利用者が「現在の作業ツリー全体を新しい本番として採用する」を選択したため、再構成待ちを解除した。既存dirty変更も含めてproduction:updateのsource archive／fingerprintを新本番の境界とする。必須gateでpackaged／installed隔離smoke、EXE／app.asar一致、通常profile全体不変、MCP登録更新を確認する。実OS未確認をこれらのPASSで代替しない。

本番Vaultの値をテスト変換しない。旧receiptを除外済みworkへ保持し、新receiptはproduction:updateが成功した結果だけで生成する。Git公開は行わない。gate後はfingerprint対象資料を変更せず、結果は除外されたreceiptと既存Vault実施記録へ保存する。必要なsource修正が発生した場合はgateを再実行する。

最終境界を本番Vaultの `30_知識/TSUZUNE-8項目改善-実装と隔離検証-実施記録-2026-10-01.md` に記録し、影響する既存project／MOC 6件を各1回更新した。revision検査付きの保存後に全文read-back、一意検索、6件のbacklinkを確認済み。原典の開発資料台帳と、今回変更対象でない知識シナジー地図は更新していない。
