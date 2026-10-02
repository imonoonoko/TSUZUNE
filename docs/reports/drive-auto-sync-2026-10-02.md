# Google Drive自動同期の実装・受入境界

2026-10-02（JST）。利用者はGoogle Drive連携強化の優先点として「自動同期（手動操作を減らす）」を選択した。

## 統合後の現在の受入境界

2026-10-02（JST）、利用者は検証済み候補を普段使うTSUZUNEへ反映する提案に「いいよ」と回答した。これにより、この確定候補のproduction:updateと隔離installed受入・EXE／app.asar hash・通常profile保全・既存MCP登録確認まで承認済み。以下の承認待ち・今回install対象外の記述は前段検証時の履歴として読む。導入結果は今回source fingerprintに対応するexcluded receiptで判定し、この記載だけで本番反映済みとはしない。実Vault内容変更、Drive同期の有効化・実転送、認証や永続アクセスの拡張、公開push、個人クリップボード変更は引き続き対象外。

比較対象の本番は2026-10-01T16:47:22.347Zのowner receipt。Drive自動同期と画像スクロール／一覧・空画面改善はその本番へ反映済み。exact archive（1,737 files、digest `d6936c5545a32e88a62bb17e5063177687b166caa32ed9ff4cf73cbb199dc529`）とinstalled EXE／app.asar hashを独立照合した。隔離候補は`work/release-candidate-manager/source-final`で、追加タブ／表示改善を含み、本番未反映。候補に残る`production-update-latest.json`は以前のbaseline受領書であり、現在の本番や候補導入の証明には使わない。

同期コードは16:47本番sourceと同一で、統合候補に保持した。競合停止・offline／retry／backoff・手動との共存は全体testのmock／fixtureで検証し、実候補packageのtrusted IPC設定保存・未接続待機・invalid設定拒否・opt-outを確認。全体1,778 PASS／1 SKIP、typecheck、check:mcp、check:current-decisionとpackage内MCPの3集約検査に合格。個人Vault・認証・永続アクセス設定は変更していない。

検証証拠は元workspace基準の`work/release-candidate-manager/`にある`final-gate.json`、`package-acceptance.json`、`packaged-ui-smoke.json`、`packaged-mcp-smoke.json`、`production-comparison.json`。これらは候補snapshot外のローカル証拠であり、文書確定後の最終source fingerprint・ゲート結果は`final-gate.json`で判定する。

残る境界は確定sourceの最終ゲート確認と候補導入判断。承認後の導入・installed受入は別作業。実Drive転送・実接続でのオフライン復帰、物理Windows IME、実クリップボードからのCtrl+V、利用者の元ノート／入力症状の受入は未確認。fixture／mock／CDPと利用者確認を分ける。今回の追加検証では個人クリップボードを操作しない。

以下は自動同期ownerの前段実装・gate前の記録。配布path・件数・gate手順は当時の記録として保持し、現在の候補状態と取り違えない。

## 使い方と動作

Google Drive同期画面の「このVaultを自動同期する」で有効にする。初期設定はオフ。初回は手動の「同期内容を確認」→適用で接続先と内容を確認する。その後はTSUZUNEの起動中、保存後約5秒と同期終了から約1分後の確認によりローカル／Drive双方の変更を同期する。通知領域に置いた状態でも続き、アプリを終了すると止まる。

競合を検出した回は全体を適用せず、該当パスを表示する。手動同期で解決した後の確認で再開する。削除の自動伝播は行わない。Google未接続と初回未同期は待機。通信失敗は1、2、4、8、最大10分の間隔で再試行し、保存のたびに失敗の再試行を早めない。

## 実装境界

- 既存DriveSyncServiceのPreview→Applyとledger、適用前のローカル／remote再確認を再利用した。保留中の手動planを保持し、自動同期後に古くなった手動planは既存guardが拒否する。
- 既存main processのtimer一つを用いる。同期は既存Vault操作とGoogle操作のqueueで直列化し、Vault切替との競合、重複実行、終了後の待機操作開始を防ぐ。
- Vault別設定、trusted IPC、preload通知、設定UIを追加。自分の保存に対するwatcher通知が抑制される経路でも保存成功後に通知する。
- 追加依存、別daemon、Windows自動起動、外部scheduler、新OAuth権限、MCP公開操作の追加はない。既存の認証情報と本番Vault設定は変更しない。

## 配布対象

元checkoutには並行する未配布変更がある。直前receipt（2026-10-01T15:31:24.173Z）のexact source archive、1,726 files／digest `3090f674e8a1c51ab06fa70e3f2727688cfdb54ba53c44512a0cd4a0ce5d2994`を基準とし、今回所有差分だけを`work/drive-auto-sync/source-isolated`へ適用した。元checkoutの並行変更を保持する。

証拠入口は`work/drive-auto-sync/source-audit.json`。非所有pathのhash一致、所有差分の追加／削除行一致、予期しないsource pathがないことを検証する。本番gate直前に再照合する。導入結果は[production-update-latest.json](production-update-latest.json)のproductionSourceRootとsource fingerprint、installed-and-verifiedで判定する。この文書はgate前に確定し、gate後の導入結果を追記しない。

## 検証と証明範囲

- typecheck、全体テスト1,769 PASS／1 SKIP、check:mcp、buildに合格。ログは`work/drive-auto-sync/{tests,mcp,build}.log`。
- runnerの時計制御、保存後debounce、定期確認、接続／初回待機、Vault別設定、単一実行、backoff、終了待ち、競合停止を確認。既存同期service fixtureで双方向更新、手動plan保持、失敗時のデータ保全を確認。
- 隔離Electronでrenderer／preload／trusted IPCによるオン／オフ、再起動後の設定保持、未接続時の待機、元ノート保全を確認。`work/drive-auto-sync/electron-evidence.json`と画面証拠。installed binaryや実Google要求を使用した検証ではない。
- packaged／installed smoke、EXE／app.asar hash、既存profile保全、MCP登録はproduction:updateの結果をreceiptで確認する。本番アプリが起動中なら強制終了せず、保存・通知領域から終了後に行う。
- 実Driveでの保存後自動同期、通信障害からの実接続復帰、利用者の日常操作は未確認。fixtureや設定UIの成功を実Drive受入と読み替えない。

作業状態と停止線は[作業定義](../../.agent/requirements/20261002-drive-auto-sync/plan.md)、現在の採用判断は[PLAN.md](../../PLAN.md)を参照する。
