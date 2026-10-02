# 画像スクロールと画面整理 — 2026-10-02

## 統合後の現在の受入境界

2026-10-02（JST）、利用者は検証済み候補を普段使うTSUZUNEへ反映する提案に「いいよ」と回答した。これにより、この確定候補のproduction:updateと隔離installed受入・EXE／app.asar hash・通常profile保全・既存MCP登録確認まで承認済み。以下の承認待ち・今回install対象外の記述は前段検証時の履歴として読む。導入結果は今回source fingerprintに対応するexcluded receiptで判定し、この記載だけで本番反映済みとはしない。実Vault内容変更、Drive同期の有効化・実転送、認証や永続アクセスの拡張、公開push、個人クリップボード変更は引き続き対象外。

比較対象の本番は2026-10-01T16:47:22.347Zのowner receipt。Drive自動同期と画像スクロール／一覧・空画面改善はその本番へ反映済み。exact archive（1,737 files、digest `d6936c5545a32e88a62bb17e5063177687b166caa32ed9ff4cf73cbb199dc529`）とinstalled EXE／app.asar hashを独立照合した。隔離候補は`work/release-candidate-manager/source-final`で、追加タブ／表示改善を含み、本番未反映。候補に残る`production-update-latest.json`は以前のbaseline受領書であり、現在の本番や候補導入の証明には使わない。

候補だけの追加は、各ペイン一つのタブ列、非activeペインをactiveへ切り替えないタブfocus／close（保存失敗時は保持）、同名ノートのfolder区別、overflow一覧・active tab reveal・keyboard操作、選択／close表示、Propertiesとfilepathの折りたたみ、local graph／headerの整理。以前の11pathは3path（PaneActionsMenu、PaneLayout、pane-actions-menu test）が本番と同一、残る8pathに追加差分がある。8path全体が未配布という意味ではない。Quick Memoや無関係なroot変更は取り込まない。

統合候補はtypecheck、全体1,778 PASS／1 SKIP、check:mcp、check:current-decisionに合格。既存Google application build設定を保持してpackageし、実候補EXEを隔離userData／sessionDataとfixture Vaultで起動した。90回のwheel入力で3画像DOM維持・loading再出現0・末尾到達・本文不変を確認し、同名タブのfolder区別・overflow focus復帰・分割／非activeタブfocusとclose・日本語入力保存を確認。package内MCP server／workerの契約・節取得・knowledge-flowもfresh fixtureで合格。main／MCP／preload／shared／coreとpackage metadataは16:47本番sourceから変更していない。

入力／保存／名前変更と同名衝突時のデータ保全、編集とLive Previewでの合成ClipboardEvent画像保存・invalid画像保全も隔離fixtureで確認した。実packageの90 wheel eventsではtop=max=2,854、3 image nodes保持、loading=0。クリップボードの内容保存や実Ctrl+Vを証明するものではない。

検証証拠は元workspace基準の`work/release-candidate-manager/`にある`final-gate.json`、`package-acceptance.json`、`packaged-ui-smoke.json`、`packaged-mcp-smoke.json`、`production-comparison.json`。これらは候補snapshot外のローカル証拠であり、文書確定後の最終source fingerprint・ゲート結果は`final-gate.json`で判定する。

文書確定後のゲートが通れば残るのは導入判断と承認後のinstalled受入。実ノートでの利用者確認は別層。実Drive転送・実接続でのオフライン復帰、物理Windows IME、実クリップボードからのCtrl+V、利用者の元ノート／入力症状の受入は未確認。fixture／mock／CDPと利用者確認を分ける。今回の追加検証では個人クリップボードを操作しない。

以下は画像スクロールUI ownerの前段実装・gate前記録。基準receipt・旧候補・件数・再開手順は当時の履歴であり、現在の候補へ古いUI-only packageを適用しない。

## 原因と変更

利用者が画像のあるPreviewを下へスクロールすると、画像が毎回「読み込み中」へ戻ると報告した。Appはスクロール位置をworkspaceへ保存して再描画する。その際ReactMarkdownへ毎回新しいimg／a／heading component関数を渡していたため、画像・リンクをunmount／mountし、readVaultImageを繰り返した。画像が短いloading spanに戻ると文書の高さが縮み、スクロール位置が変わった。

component型をmodule scopeで固定し、既存propsはReact Contextから取得する。画像DOMとリンクfocusを保ち、callbackは最新propsを使う。画像readのpromise rejectionもloadingのまま残さない。cache、DB、新依存、画像の非表示化は追加しない。URL制限・読取IPC・Markdown本文は変更しない。

常時表示の分割toolbarを各ペインの「…」メニューへ移した。既存PaneActionsMenuを再利用し、split／close／next／move、最大8ペイン、保存失敗時の停止を維持する。keyboard arrows／Home／End／Escape・focus復帰・IME guardがある。単一ペインの強い外枠を減らし、複数ペインではactiveの上線を表示する。ファイル一覧は更新日を非表示にし、名前を最大2行にして横scrollを減らす。選択がないとき下部の名前変更／移動／ごみ箱を出さない。空画面は検索・新規作成へ案内し、既存Vaultにも「最初のノート」と表示しない。

## 検証

- 変更前に回帰testで画像DOM再作成とリンクfocus消失を再現。既存インストール版の隔離fixtureへ実CDP wheel入力を30回送り、loading再出現18回と画像DOM交換を確認した（work/preview-ui/baseline-smoke.json）。
- 修正版の同じ実wheel検査で末尾へ到達し、loading再出現0回、3画像のDOM維持、本文不変を確認。メニューのEscape focus復帰と720pxで画像の表示維持も確認（work/preview-ui/source-smoke.json）。OSの物理ホイール・本人ノートは別層。
- focused regressionは画像表示、Live Preview、ペイン保存／移動とmenu操作。全体test／typecheck／check:mcp／文書・workflow検査と本番gateの結果は最新receipt、最終証拠はwork/preview-ui/final-delivery-evidence.jsonへ残す。検査用Screenshotはfixtureだけを使う。
- 検査harnessではhidden windowのscreenshot待ちが長かったため、既存captureと同様に検査windowだけを画面外でshowInactiveしてcaptureした。製品コードへ検査都合の変更は加えない。

## 配布と未確認層

基準は2026-10-01T15:31:24.173Zのverified receiptとexact source archive。1,726 files、digest3090f674e8a1c51ab06fa70e3f2727688cfdb54ba53c44512a0cd4a0ce5d2994を照合した。今回のrenderer・UI・検査・文書差分だけを追加する。既存rootのQuick Memoや別の並行変更を暗黙に昇格しない。借用する既存menu／pane helperも今回scopeで明示する。scope監査はwork/preview-ui/source-sync-final.json。

検査中に別チャットのGoogle Drive自動同期が本番導入されたため、2026-10-01T16:38:06.964Zのverified receipt／exact archive（1,733 files、digest b9c86e5c34d38054acd971395883cff832cab5d36323cdae47679647bd77e0c9）とinstalled hashを照合し、今回差分をその本番へ重ねた。未配布のroot全体は取り込まない。最初の全体検査で空画面の旧文言を期待する2件が失敗し、新文言へ合わせて同じ安全動作のassertを保持した。更新後の全体検査は1,761 PASS／1 SKIP。Drive導入後の再統合と本番gateでも全体検査する。

production:updateは本番アプリが閉じられてから行い、強制終了しない。隔離packaged／installed、exe／app.asar一致、通常profile不変、MCP登録を確認し、installed binaryでも同じ実wheel検査を行う。本番Vaultを自動試験に使わない。gate後にfingerprint対象文書を変更せず、結果はexcluded receiptと必要なVault正本へ一度同期する。Git公開はしない。実Windows日本語IME／Narrator／High Contrastと本人の元ノート操作は未確認であり、fixture結果と分ける。
