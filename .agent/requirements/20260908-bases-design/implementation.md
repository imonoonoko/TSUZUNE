# A6 Bases候補一覧 — 実装・受入

2026-09-09の「開始」により、[chooser-design.md](chooser-design.md)の候補一覧を実装する。設計の機能・除外・保護・受入条件を引き継ぐ。作業中の状態はこの文書、全体の優先順位は[PLAN.md](../../../PLAN.md)が所有する。

## 作業契約

- Goal: Vault内のBaseを、path入力なしで一覧・検索・選択して既存表へ開ける。
- Success: (1) 両入口・検索・更新・手入力・keyboard/focusが動く、(2) 保存・非同期・除外・path境界のA6-01〜10をfixtureで確認する、(3) 必須gate・隔離packaged/installed受入・最終Vault同期まで完了する。
- Context: 既存table/parser/workspaceを維持する。開始時sourceは `work/a6-base-chooser-implementation-20260909/before-source` に保存、fingerprintは同 `before.json`。全1618ファイルを対象とし既存dirty差分を保持する。
- Constraints: 新DB/cache/daemon/Hook/依存・MCP API・Base編集・Git公開は対象外。本番Vault操作と最終採否は親のみ。通常profileを自動操作しない。
- Risk / approval: ユーザーの実装開始とrepo契約に基づくproduction:updateを行う。dirty sourceの昇格前にreceiptの完全source archiveと作業開始snapshotを照合する。実Vault・未知の差分・稼働中本番への強制終了・scope拡張が必要なら依存操作を停止する。
- Evidence: 設計第7節の受入、focused tests、typecheck / npm test / check:mcp、production receipt、隔離installed操作。本番反映後の結果はexcluded receiptとVault記録に保存する。

## Work packets / orchestration

| Packet | Owner / ownership | State | Acceptance |
|---|---|---|---|
| API | backend Agent: src/main/vault.ts、src/main/ipc.ts、src/preload/index.ts、src/shared/types.ts、tests/vault.integration.test.ts、tests/vault.bases-list.test.ts、tests/ipc.workspaces.test.ts、tests/preload.graph-view-state.test.ts | verified | 専用listBases APIとroot/除外/リンク/非書込み、focused 56 tests PASS |
| Chooser component | component Agent: BasePathDialog.tsx、styles.css、tests/base-path-dialog.test.tsx | verified | 部品7test PASS。手入力切替時focusも確認 |
| UI integration | CEO-01: App.tsx、App tests、必要なAPI mock | source verified | 取得世代・保存・focus、部品込み125 testsと隔離source操作PASS |
| Independent review | 読取専用Agent。correctnessとPonytail review | verified | 未提示child junction差替えを修正後に独立再検証。残るP1/P2なし |
| Delivery / record | CEO-01: 最終docs、production gate、isolated installed、Vault write | receipt boundary | 下記の完了条件とexcluded evidenceで判定する |

各制作Ownerは他者の変更をrevertしない。API型は `listBases(expectedVaultPath: string): Promise<Result<string[]>>`。相対pathの配列だけ返す。UIからroot指定や除外規則の権限を追加しない。親が統合し、focused確認後に全体gateへ進む。指摘・gate failureは関係する所有範囲だけ修正して再検証する。

## Integration and verification

製品sourceの実装と独立reviewは完了。証拠の共通directoryは `work/a6-base-chooser-implementation-20260909/`。本番反映は下記receiptの成立まで区別する。

| 受入 | 検証済みsource証拠と範囲 |
|---|---|
| A6-01 | `tests/vault.bases-list.test.ts`、App／component tests。日本語・空白・大文字拡張子・同名別folder、path保持・順序・singleton・NFKCとAND検索 |
| A6-02 | Vault testsと独立 `review/independent-final-review.md`。dot／history／symlink／junction／除外、rootとchild差替えを拒否。40_情報源の通常Baseは候補可 |
| A6-03 | Vault filesystem spyと隔離操作の前後hash。本文scan／creation-times／bookmark reconciliationなし。clean状態の一覧・検索・cancelで保存を発生させない |
| A6-04 | Vault／IPC tests。未選択、expected root不一致、A→B→A、選択切替中の結果を拒否 |
| A6-05 | App遅延Promise tests。close／reopen、旧requestの成功・失敗、除外設定変更で古い一覧とerrorを採用しない |
| A6-06 | App／component testsと `runtime-lsVDaa/result.json`。両入口、検索、更新、新規／消失、選択維持 |
| A6-07 | App／component testsと同runtime。上下・Enter・Tab循環・Escape・focus復帰／移動。IMEはcompositionイベントのguardまでで、実OS日本語IMEは未確認 |
| A6-08 | App testsと同runtime。dirty flush成功後のopen、IO_ERROR／FILE_CHANGED／busy／compositionの入力保全とretry、Vault世代のguard |
| A6-09 | App tests、既存readBase atomic tests、同runtime。選択後の消失、構文診断、修復と再読込、二重tab防止 |
| A6-10 | App／workspace testsと同runtime。手入力・dot拒否・明示除外path、Base→note編集、path-only checkpointとprocess再起動復元 |

独立reviewでchild directoryを`lstat`後・`readdir`前にjunctionへ差し替える未提示ケースが発見された。rootから対象directoryまでを列挙後と候補採用前に再検査する修正後、独立fixtureをPASSと確認した。OS filesystemのatomic snapshot保証には拡張しない。

全体testの途中で既存bookmarkケースがOOMとなった。100ms保存待ちの単体fixtureとCPU profileから、test API mockに残っていた旧0〜100 graph設定が現行の変換に直接渡ることが原因と判明した。本番のsettings読取は既に移行処理済み。8箇所を現行defaultへ揃え、保存待ち中もgraphが動く回帰を既存testへ残した。同一待ち条件が768MiBでもPASSへ変わった。製品のgraph／bookmark実装は変更していない。診断証拠は `memory-prof.txt`、`memory-forces.log`、`memory-settings.log`。

typecheck、check:mcp、focused API／UI、current-decisionとsource buildはPASS。全体testは既定の単一worker・通常heap設定で115 files／1,253 tests PASS、既存1 SKIP。最終結果は `npm-test-passed.log`、作業開始snapshotとの差分とlocal link確認は `task-delta.json` が所有する。既存dirty差分は保持し、Git公開はしていない。

## Delivery completion predicate

初期sourceと既存production完全archiveの照合は `production-base-audit.json` がPASS。製品sourceは一致し、差分は先行する設計・整理の5文書だけだった。今回差分は開始snapshotからの許可path検査で限定する。

以下の全条件が成立すれば本件は完了となる。gate実行後の結果はexcluded artifactとVault記録へ保存し、このfingerprint対象文書を追記しない。

1. `docs/reports/production-update-latest.json` が今回sourceのproduction gate全件PASS、built／installedのexe・app.asar完全一致、通常profile不変とMCP登録を示す。
2. 同directoryの `runtime-installed.log` がinstalled本体を隔離Vault／profileで操作したPASS結果を指し、一覧からのopen、保存、診断回復、workspace復元、通常profile不変を証明する。
3. fresh MCPでdelivery matchと最終Vault同期を確認し、`30_知識/TSUZUNE-A6-Bases候補一覧-実装本番受入-2026-09-09.md` のread-back・一意性・到達リンクを検証する。接続がstaleなら同期内容をexcluded `vault-sync-plan.json` に保持し、Codex再起動後に未完了分だけ再開する。

利用者本人の操作確認と実OS日本語IMEは自動受入に含めない。次機能は別の明示選択で決め、現在の検討順はPLANと候補索引が所有する。
