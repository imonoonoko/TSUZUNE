# Canonical plan: search readability and overlay dismissal

## Task contract

- **objective:** 内容検索をひと目で理解できる表示へ整え、コマンドパレットやノート選択など一時画面を、内部操作を壊さず背景クリックでも閉じられるようにする。
- **deliverables:** 検索ペインの情報階層改善、対象ダイアログのtrue-backdrop dismissal、pointer／keyboard回帰test、隔離Electronでの実画面証拠、本番受入とTSUZUNE最終記録。
- **constraints:** Markdown正本と検索意味論を変えない。新規dependency、共通modal基盤、schema／IPCを追加しない。既存のEscape、focus復帰、未保存確認、保存中close抑止を維持する。dirty worktreeと既存変更を保全し、production appを強制終了しない。
- **success:**
  1. Search viewで入力、検索条件、状態／件数、結果またはempty stateが視覚的に分離され、1440／900／720 CSS pxで重なりや横overflowがない。
  2. Command Palette、Quick Switcherおよび監査で安全と判定した一時dialogは、背景クリックで既存close経路を通り、dialog内部クリックでは閉じない。
  3. focused／full／typecheck／build／MCP／isolated UI／production gateが通り、profileとMarkdownが変わらない。
- **lane:** Orchestrated。dialog契約監査と検索UX監査を独立packetにし、親agentがtest-first実装、統合、検証、本番反映、TSUZUNE書戻しを所有する。
- **evidence:** current source/diff、focused tests、isolated Electron captures、production receipt、post-restart runtime/delivery、TSUZUNE read-back。
- **stop:** dirty draftや進行中保存を無確認で破棄する必要があるdialog、またはschema／IPC／検索engine変更が必要な候補は自動実装せずHeldにする。

## Execution

1. [x] 現行dialog close経路とSearch viewの実装／test／画像を監査する。
2. [x] 公開挙動の失敗testを先に追加し、最小実装でgreenにする。
3. [x] pointer、keyboard、responsive、empty／results stateを隔離Electronで確認する。
4. [x] 独立review、repository gates、本番更新を完了する。
5. [x] TSUZUNE final-boundary writebackとread-backを完了する。

## Verified boundary

- 検索は見出し、対象範囲、条件chip、空状態、結果件数、タイトル、2行抜粋、パス、鮮度を分離した。検索engine／ranking／IPCは不変。
- Command Palette、Quick Switcher、Bookmark、Rename、Move、Quick Note、Human Note、Settings、Googleをtrue-backdrop dismissalへ統一し、busy／dirty guardを維持した。
- `npm test`: 873 passed、1 skipped。`npm run build`、`npm run check:mcp`、`git diff --check`通過。
- 隔離Electron: 1440／900／720 px、検索領域180px以上、横overflowなし、内側クリック維持、背景クリック終了、focus復帰、fixture Markdown digest不変。
- `npm run production:update`: installed-and-verified。built／installed executableとapp.asarのhash一致、production profile digest不変。
