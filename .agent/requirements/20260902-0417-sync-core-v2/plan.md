# TSUZUNE Sync Core v2 Plan

State owner for this Planned lane.

## Task Contract

- objective: TSUZUNEで画像・PDFを安全に取り込み、既存Google Drive経路でbyte-identicalに同期できるようにする。
- deliverables: 添付import／Obsidian互換embed挿入、binary-safe Drive adapter／service、focused tests、検証結果。
- constraints: Markdown正本、既存dirty worktree保護、有料service・専用server・従量課金API・新依存なし、Drive削除伝播なし、利用者のTSUZUNEを強制終了しない。
- success: 既存fileを上書きせず画像・PDFをVaultへ取り込める。編集中ノートへ`![[path]]`を挿入できる。添付がDriveとの間でbyte-identicalに往復し、部分fileを正本pathへ残さない。実Driveの標準MIME型を扱い、削除なしの最終previewで残件0を確認する。
- lane: Planned。
- evidence: source、focused Vitest、typecheck、full regression、MCP check、production receipt、live Drive preview／apply。
- stop: 修正版を本番反映し、削除なしのlive Drive同期が残件0になること。

## Status

- [x] discovered: 既存Drive `fileId`と`pendingMoves`を再利用できることを確認。
- [x] contracted: 無料運用を必須条件にし、F2をstable logical IDとmove＋editへ限定。
- [x] executing: provider非依存plannerとDrive serviceをTDDで実装。
- [x] verifying: focused 51 tests、typecheck、全98 files／944 tests、check:mcp、task-owned diffを確認。
- [x] persisted: 同一campaignのTSUZUNE実施記録を更新し、一意検索・read-backを確認。
- [x] complete: F2 success条件を満たし、F3へ再開可能。
- [x] discovered: 現行は画像・PDFを認識・外部openできるが、import入口と添付同期がないことを確認。
- [x] contracted: F3を画像・PDF import、embed挿入、binary Drive同期へ限定。PDF内部viewerは除外。
- [x] executing: test-firstでVault import、embed挿入、binary-safe Drive同期を縦切り実装。
- [x] verifying: focused 99 tests、typecheck、全98 files／950 tests、check:mcp、task対象diffを確認。
- [x] persisted: 同一campaignのTSUZUNE実施記録を更新し、一意検索・read-backを確認。
- [x] complete: F3 source／fixture success条件を満たした。本番反映はdirty whole-tree昇格のOwner承認待ち。
- [x] executing: Owner承認済みのdirty source tree全体を本番へ昇格し、live Drive applyを開始。680件中222件を反映後、長いPNGパスの標準MIME型で停止。
- [x] verifying: 実機と同じ長いPNGパス・`image/png`応答でREDを再現し、添付対象拡張子とGoogle固有形式拒否を維持した最小修正後、focused 62 tests、typecheck、全99 files／951 tests、check:mcpを確認。再接続previewで前回POST由来の同一パス重複を検出し、MD5一致時だけ1件として扱う回復処理を追加。focused 63 tests、typecheck、全99 files／952 tests、check:mcpを再確認。
- [x] persisted: 修正版のproduction receiptとlive Drive最終previewを同一campaignの実施記録へ統合。
- [x] complete: 修正版の本番昇格と削除なしのlive Drive残件0を確認。
- [x] discovered: 初回458件の新規uploadが直列実行とfileごとの約1.7 MB台帳書換えで約22分を要したことを確認。
- [x] contracted: 既存Drive経路の新規作成だけを最大4並列・batch単位checkpointへ変更。retry、別service、DB、dependencyは追加しない。
- [x] executing: 新規作成の限定並列と部分失敗後の再開処理をTDDで実装。
- [x] verifying: 全回帰とproduction gateを確認。最終plan反映を含むdelivery一致を再確認する。
- [ ] persisted: 性能follow-upの最終証拠を同一campaignの実施記録へ統合する。
- [ ] complete: 高速化版を本番反映し、再開安全性とdelivery一致を確認する。

## Roadmap

| State | Slice |
|---|---|
| Complete | F1 provider-neutral planner foundation（本番反映済み） |
| Complete | F2 stable identity and move-plus-edit（本番反映済み） |
| Complete | F3 attachments（本番反映済み。live Drive初回同期残件0） |
| In progress | Drive新規upload性能follow-up（最大4並列・batch checkpointを本番反映済み。最終delivery再確認中） |
| Next | 最終receiptのdelivery一致を確認後、同一TSUZUNE実施記録へ証拠を統合 |
| Held | F4 history、F5 auto runner |
| Research | E2EE remote format、retention、mobile background constraints |

## Evidence

- focused: 3 files／48 tests PASS。
- typecheck: PASS。
- full regression: 98 files PASS、1 file SKIP、941 tests PASS、1 test SKIP。
- TSUZUNE: `30_知識/TSUZUNE-Sync-Core-v2基盤・採用判断-実施記録-2026-09-02.md`を作成し、一意検索・read-back・関連ノート導線を確認。
- boundary: source実装済み。本番未反映。packaged／installed／live Driveは未検証。
- F2 RED: Core 2 testsとService 2 testsが旧挙動で期待どおりFAIL。
- F2 focused: 3 files／51 tests PASS。
- F2 full regression: 98 files PASS、1 file SKIP、944 tests PASS、1 test SKIP。
- F2 MCP boundary: PASS。新dependency・有料service・専用server・従量課金APIなし。
- F2 TSUZUNE read-back: revision `sha256:959bb1d4179b80eb5f7b497f7d5433b44ff8519d9e99f8b1b937040f851dfae3`、一意検索1件。
- F3 focused: 5 files／99 tests PASS。画像・PDF import、embed挿入、binary upload／download／conflict copy、外部変更保護を確認。
- F3 typecheck: PASS。
- F3 full regression: 98 files PASS、1 file SKIP、950 tests PASS、1 test SKIP。
- F3 MCP boundary: PASS。新dependency・有料service・専用server・従量課金APIなし。
- F3 task対象diff check: whitespace errorなし。改行コード警告のみ。
- F3 TSUZUNE read-back: revision `sha256:58471f7023e941783430c3aa724b3723ced48a15bdf4d89b983966dc5b34d1be`、一意検索1件。
- F3 boundary: source実装済み。本番未反映。packaged／installed／live Drive／実複数端末は未検証。
- Initial production promotion: `docs/reports/production-update-latest.json`でdelivery match、built／installed executableと`app.asar`一致、profile unchanged、MCP refreshを確認。
- Live apply: initial 680 uploadsから222 uploadsを反映。残り458 uploads（添付36、Markdown 422）、download／move／conflict／trashは0。削除伝播は無効のまま。
- Live failure RED: 長い実パスのPNGを`image/png`で返すfixtureが既存実装の`Google DriveからMarkdownメタデータを取得できませんでした。`を再現。
- Live MIME fix focused: `tests/google-drive.test.ts`と`tests/drive-sync-service.test.ts`の62 tests PASS。
- Live MIME fix verification: typecheck PASS、99 files中98 PASS／1 SKIP、951 tests PASS／1 SKIP、check:mcp PASS。
- Duplicate recovery: 前回失敗したPOSTがDrive上では成功していたため同一PNGパスが2件存在。MD5一致時だけ台帳ID優先／ID順で1件として扱い、MD5欠落・不一致は従来どおりfail closed。Drive上の余分なfileは削除しない。
- Duplicate recovery verification: focused 63 tests PASS、typecheck PASS、99 files中98 PASS／1 SKIP、952 tests PASS／1 SKIP、check:mcp PASS。
- Duplicate recovery final: production昇格とlive Drive residual apply／final preview残件0を確認済み。
- Performance RED: 新規5件の最大同時createが1、batch途中失敗時は後続成功fileが作成されず、追加2 testsが期待どおりFAIL。
- Performance focused GREEN: `tests/drive-sync-service.test.ts`と`tests/google-drive.test.ts`の65 tests PASS。新規5件でも最大同時createは4、4件中1件失敗後の再起動previewは失敗1件だけ。
- Performance typecheck: PASS。
- Performance full regression: 98 files PASS、1 file SKIP、954 tests PASS、1 test SKIP。
- Performance MCP boundary: PASS。
- Performance task diff check: whitespace errorなし。改行コード警告のみ。
- Performance Ponytail review: 追加dependency・retry・設定・抽象layerなし。削除対象なし。
- Performance production gate: typecheck、production tests 954、MCP、package、installer contract、packaged／installed smoke、built／installed hash、MCP再登録がPASS。production profileは60 filesで不変。
- Performance boundary: source／fixture／installed production検証済み。最終plan反映を含むdelivery一致とTSUZUNE write-backは未確認。
