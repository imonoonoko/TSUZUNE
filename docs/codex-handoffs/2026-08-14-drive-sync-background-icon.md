# Codex Session Handoff: Drive Sync・Background Runtime・Icon Refresh

## Reactivation Prompt

```text
We are continuing from this handoff:
C:\Users\Humin\Documents\Codex\TSUZUNE\docs\codex-handoffs\2026-08-14-drive-sync-background-icon.md

Read that document first, then inspect the current repo state. Do not assume the old chat context is available. Continue from the Next Steps section, verifying what still applies before changing files or global config.
```

## Context

- Repo/path: `C:\Users\Humin\Documents\Codex\TSUZUNE`
- Branch: `agent/tsuzune-mcp-integration`
- Handoff作成時HEAD: `6b8c55e`。`origin/agent/tsuzune-mcp-integration`とahead 0／behind 0
- Current goal: Drive同期を日常利用可能な速度と安全境界へ改善し、TSUZUNEを通知領域で常駐させ、MCPからも同期preview／明示applyを扱えるようにする。直近のIcon Refreshは完了し、次のPrimary Trackは未選定
- Product boundary: ローカルMarkdownが原本。TSUZUNE本体にAIを内蔵せず、外部AIがMCP経由で知識基盤を利用する
- User constraints: TSUZUNEを共通知識基盤として開始時に参照し、重要な決定・検証・残課題を書き戻す。不要な新規基盤や依存を増やさない。Drive apply、分類apply、commit、pushは境界と対象を確認してから行う

## Current Truth

- Installed production: v0.5.0、`installed-and-verified`
- 最新receipt: `docs/reports/production-update-latest.json`
  - verified at `2026-08-14T11:13:11.121Z`（20:13 JST）
  - source base commit `6b8c55e`、dirty sourceを明示
  - source fingerprint 922 files
  - typecheck、tests、MCP、package、installer、packaged／installed smoke、installed hash、MCP再登録の10/10 checks PASS
  - 63 files／626 tests PASS、MCP 6 read＋7 write、production profile 57 files不変
  - built／installed EXE hash `8470ca332de399cc166b8ccf6c877e6bc046ee399e1c1014a92c35c4e279c56f`
- Handoff作成時のworking treeはdirty 42 status entries。内訳はtracked差分26 pathsとuntracked 16 paths。これはinstalled sourceへ含まれるが、Git commit／pushは未実施
- `PLAN.md`は現役Primary Track 0、Icon Refresh完了、次slice未選定を正本としている

## What Changed

### Google connection and Drive baseline

- Google再接続時のcanonical userinfo scopeを同値として受け入れる修正を本番反映した
- 既存Drive Vaultへ接続し、初回同期後の再確認で送信0／受信0／競合0／保持0のclean baselineを確認した
- 長いUTF-8 pathをGoogle Drive `appProperties`へ入れてHTTP 403 `propertyLengthLimitExceeded`になった問題は、124-byte以内だけ`tsuzunePath`へ保存し、長いpathはDrive descriptionへ退避する最小修正で解消した
- 修正後の実同期は送信443／受信0／競合7／保持0で完了し、その後のpreviewは0／0／0／0になった

### Drive Sync performance and move tracking

- S1 metadata-first preview: 同一remote versionでは本文downloadとhash再計算を省略し、preview取得本文をapplyで再利用する
- S2 Drive Changes API: change tokenとremote metadata cacheを保存し、初回full scan後は差分metadataだけを列挙する。HTTP 410だけfull scanへfallbackする
- Installed実測は初回bootstrap約7秒、Changes差分経路約1秒。精密benchmarkではなく日常操作の目視受入値
- S3 Explicit Note Move: アプリ内の単一Markdown移動／名前変更を同じDrive file IDのmetadata-only relocationとして扱う実装と自動testは本番反映済み
- S3のinstalled実機「移動1件 → apply → 次preview 0件」は未受入

### MCP and background runtime

- 起動中のTSUZUNE本体が保持する既存Drive Sync serviceをMCPへ橋渡しした。MCP側にGoogle tokenや重複同期engineは持たせない
- Direct serverは13 tools、Codex Desktop登録は10 tools。`preview_drive_sync`はread-only、`apply_drive_sync`はpreviewの`planId`と再検査を必須とし、確認対象
- Windowsの×は終了ではなくウィンドウを隠す動作へ変更。通知領域の終了操作だけが明示終了
- ウィンドウを隠した後もTSUZUNE processとMCP Bridgeが生存し、背景previewが送信12／受信0／移動0／競合0／保持16でPASS。applyは未実施
- Windowsログイン時の自動起動は今回の契約外

### Icon Refresh

- 旧woven-loopを、知識の接続と鈴音を表すInterwoven Bellへ更新した
- app／installer用と小サイズtray用を別asset化し、旧829,501-byte PNGは削除した
- installed実機でWindowsタイトルバー、アプリ内ヘッダー、タスクバー、通知領域の4 surfaceをユーザー目視し、すべてPASS
- 目視証拠は `docs/reports/assets/tsuzune-icon-refresh-2026-08-14/` の3画像へ保存済み
- RepositoryとTSUZUNE Vaultのstatus／UX noteは「Icon Refresh完了」へ更新済み

## Files Touched Or Investigated

### Drive／background／MCP

- `src/main/google-drive.ts`
- `src/main/drive-sync-service.ts`
- `src/core/drive-sync.ts`
- `src/main/mcp-drive-sync-bridge.ts`
- `src/mcp/drive-sync.ts`
- `src/mcp/server.ts`
- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/shared/types.ts`
- `src/renderer/App.tsx`
- `scripts/check-mcp.mjs`
- `scripts/register-codex-mcp.ps1`
- `tests/google-drive.test.ts`
- `tests/drive-sync-service.test.ts`
- `tests/mcp-drive-sync.test.ts`
- `tests/ipc.graph-settings.test.ts`
- `tests/app.safety.test.tsx`

### Icon／release

- `src/renderer/assets/tsuzune-app-icon.svg`
- `src/renderer/assets/tsuzune-app-icon.png`
- `src/renderer/assets/tsuzune-tray-icon.svg`
- `src/renderer/assets/tsuzune-tray-icon.png`
- deleted: `src/renderer/assets/tsuzune-woven-loop.png`
- `package.json`
- `tests/release-config.test.ts`
- `scripts/update-production.mjs`
- `docs/reports/production-update-latest.json`

### Plans and evidence

- `PLAN.md`
- `PROJECT_STATUS.md`
- `DESIGN.md`
- `README.md`
- `docs/INDEX.md`
- `docs/mcp-integration.md`
- `docs/windows-production.md`
- `docs/reports/drive-sync-metadata-first-s1-2026-08-14.md`
- `docs/reports/drive-sync-changes-s2-2026-08-14.md`
- `docs/reports/drive-sync-explicit-note-move-s3-2026-08-14.md`
- `docs/reports/drive-sync-mcp-bridge-2026-08-14.md`
- `docs/reports/tsuzune-icon-refresh-2026-08-14.md`
- `docs/reports/cp1-c-07-production-classification-apply-packet-2026-08-14.md`
- `docs/migrations/o2-production-classification-apply-plan.json`
- `docs/migrations/o2-production-classification-apply-packet.json`

## Commands And Checks Already Run

- `npm run typecheck`: PASS
- `NODE_OPTIONS=--max-old-space-size=10240 npm run test:production`: 63 files／626 tests PASS
- `npm run check:mcp`: PASS。direct MCP 6 read＋7 write
- `npm run build`: PASS
- `npm run production:update`: 10/10 checks PASS、installed v0.5.0更新、build／installed hash一致、profile 57 files不変、MCP再登録PASS
- Icon小サイズ確認: app 16／24／32／48／64px、tray 16／20／24／32pxをlight／dark背景でPASS
- Installed visual acceptance: タイトルバー、アプリ内ヘッダー、タスクバー、通知領域PASS
- `git diff --check`: handoff直前PASS
- Ponytail review: 新規同期engine、Google client、auto-sync、画像runtime、新依存は追加せず、既存経路を再利用。Icon旧assetは削除

## Known Issues

- Working treeはdirty 42 entries。installed productはこのdirty sourceを検証済みだが、Git上のclean checkpointではない
- S3 Explicit Note Moveは自動testと本番反映まで完了したが、installed実機の移動1件→0件受入が残る
- CP1-C-07 classification apply packetは、clean sync baseline後のremote 5 objects previewを再固定していない。本番classification applyは禁止
- Drive削除伝播、添付同期、移動＋本文編集の同時解決、モバイルclientは未実装の別slice
- Windowsログイン時自動起動は未実装で、背景常駐受入の範囲外
- Git操作時に複数ファイルのLF→CRLF warningが出る。`git diff --check`はPASSしており、現時点で製品失敗ではない

## Open Decisions

- dirty 42 entriesをどの単位でcommit／pushするか。少なくともDrive S1/S2/S3、MCP Bridge＋Tray、Icon Refresh、evidence／receiptをレビュー可能な境界へ分ける
- commit後、同一内容のclean sourceから公式`production:update`を再実行し、clean commitを指すreceiptへ更新するか
- 次のPrimary Trackを、S3 live acceptance、Drive削除／添付、移動＋編集、mobile shellのどれにするか
- CP1-C-07を再previewして承認候補へ戻すか。実行する場合もread-only再固定と明示承認が先

## Next Steps

1. このhandoff、`PLAN.md`、`PROJECT_STATUS.md`、`docs/reports/production-update-latest.json`を読み、`git status --short`、branch、HEAD、ahead／behindを再確認する
2. dirty 42 entriesの現物差分を、Drive S1/S2/S3、MCP Bridge／Tray、Icon、docs／receiptの所有境界でレビューする。既存変更を捨てたり一括復元したりしない
3. ユーザーがcommit／pushを指示した場合だけ、論理単位でcommitし、origin同期後に必要ならclean sourceの公式`production:update`を再実行する
4. S3を閉じる場合は、復元可能な単一テストノートで移動preview 1件を確認し、Drive applyの明示確認後だけ適用して、次preview 0件とstable file IDを検証する
5. CP1-C-07は触らず、次のPrimary Trackをユーザーと再選定する。候補は削除／添付、移動＋編集、mobile shell。Context／BM25／Hooksは既存resume条件までheld

## Do Not Touch / Be Careful

- `git reset --hard`、`git checkout --`、広範なclean、42-entry dirty treeの破棄をしない
- Drive applyをpreviewなし、古い`planId`、またはユーザー確認なしで実行しない
- CP1-C-07 classification applyを実行しない。remote preview再固定と別承認が必要
- Google tokenをMCP process、repo、Vault note、reportへ保存しない
- `50_履歴`、原典、監査ログを通常ノートとして上書きしない
- TSUZUNE／MCP processを所有確認なしに停止しない
- Installed production、Git HEAD、dirty sourceを同じ意味として扱わない
