# Google Drive自動同期

2026-10-02（JST）。利用者はGoogle Drive連携強化の優先点として「自動同期（手動操作を減らす）」を選択。

## 対象と停止線

既存TSUZUNEプロセス内で、Vaultごとの明示設定、保存後約5秒の同期、約1分間隔のDrive確認、競合停止、通信失敗時の再試行、状態表示を追加する。初期設定はオフ、初回は手動Preview→Apply。バックグラウンド常駐中も継続する。外部scheduler、Windows自動起動、新しいOAuth権限、新しい同期engine、削除伝播の自動化、Git公開は対象外。

## 成功条件と証拠

1. 有効にしたVaultで、保存後と定期確認により既存Preview→Applyを自動実行する。runnerの時計制御テスト、既存ledgerによる双方向同期テスト、設定保存とUIテストで確認。
2. 競合時の無変更、削除非伝播、stale plan拒否、単一実行、失敗後のbackoff、手動plan保持、Vault切替・終了時の境界を守る。同期service回帰とrunner／IPCテストで確認。
3. verified exact production archiveへ今回所有差分だけを追加し、typecheck・全テスト・MCP・build・隔離packaged／installed smoke・hash／profile保全を確認する。production receiptを導入結果の正本とする。実Driveでの自動同期と利用者操作確認は別層で、fixtureから成功と推測しない。

## 状態と再開

2026-10-02（JST）、利用者は検証済み候補を普段使うTSUZUNEへ反映する提案に「いいよ」と回答した。これにより、この確定候補のproduction:updateと隔離installed受入・EXE／app.asar hash・通常profile保全・既存MCP登録確認まで承認済み。以下の承認待ち・今回install対象外の記述は前段検証時の履歴として読む。導入結果は今回source fingerprintに対応するexcluded receiptで判定し、この記載だけで本番反映済みとはしない。実Vault内容変更、Drive同期の有効化・実転送、認証や永続アクセスの拡張、公開push、個人クリップボード変更は引き続き対象外。

比較対象の本番は2026-10-01T16:47:22.347Zのowner receipt。Drive自動同期と画像スクロール／一覧・空画面改善はその本番へ反映済み。exact archive（1,737 files、digest `d6936c5545a32e88a62bb17e5063177687b166caa32ed9ff4cf73cbb199dc529`）とinstalled EXE／app.asar hashを独立照合した。隔離候補は`work/release-candidate-manager/source-final`で、追加タブ／表示改善を含み、本番未反映。候補に残る`production-update-latest.json`は以前のbaseline受領書であり、現在の本番や候補導入の証明には使わない。

自動同期のmain／IPC／設定実装は16:47本番sourceと同一で、統合候補にも保持した。fixtureのtrusted IPC設定保存・再起動保持・未接続待機・disable、mockの競合停止・offline／backoff／再試行・手動plan共存を確認。統合全体は1,778 PASS／1 SKIP、typecheck・check:mcp・check:current-decisionに合格し、実候補packageの設定操作とMCPも隔離検証した。[同期受入境界](../../../docs/reports/drive-auto-sync-2026-10-02.md)。

検証証拠は元workspace基準の`work/release-candidate-manager/`にある`final-gate.json`、`package-acceptance.json`、`packaged-ui-smoke.json`、`packaged-mcp-smoke.json`、`production-comparison.json`。これらは候補snapshot外のローカル証拠であり、文書確定後の最終source fingerprint・ゲート結果は`final-gate.json`で判定する。

この文書を含む7pathの確定後は最終ゲート結果を確認して導入判断を待つ。今回install／公開／認証変更／個人Vault変更／実Drive送信は行わない。承認後のproduction:updateは確定source snapshotに対し実施し、本番アプリが動作中なら強制終了しない。実Drive転送・実接続でのオフライン復帰、物理Windows IME、実クリップボードからのCtrl+V、利用者の元ノート／入力症状の受入は未確認。fixture／mock／CDPと利用者確認を分ける。今回の追加検証では個人クリップボードを操作しない。
