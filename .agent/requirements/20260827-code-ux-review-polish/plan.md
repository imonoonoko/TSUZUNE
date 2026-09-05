# Canonical plan: current UI code review and UX polish

## Task contract

- **objective:** 現在のObsidian寄りworkspace shell、Settings、主要navigationをコードと実操作の両面からreviewし、根拠が明確な操作感・UX改善を最小差分で反映する。
- **deliverables:** 優先度付きreview結果、選択した修正と回帰test、1440／900／720 CSS pxとkeyboardの隔離検証、本番受入、最終evidence packet。
- **constraints:** Markdown正本、保存schema、security/OAuth契約を変えない。新規dependencyを加えない。dirty worktreeと既存変更を保全する。Git公開やproduction appの強制終了を行わない。存在しない機能を設定項目として見せない。
- **success:**
  1. 現行shell／Settings／主要navigationに、検証済みP0/P1を残さず、採用したP2が実測可能な摩擦を減らす。
  2. pointerとkeyboardの主要導線が1440／900／720で発見可能かつ一貫し、overflowやMarkdown変更を起こさない。
  3. focused/full/build/MCP/UI/production gateとinstalled hash/profile境界が通る。
- **lane:** Orchestrated。コードcorrectness、interaction UX、accessibility/test gapを独立packetとして並列監査し、親agentが統合・実装・本番反映・TSUZUNE書戻しを所有する。
- **evidence:** current source/diff、isolated UI capture、automated tests、production receipt、post-restart runtime/delivery、TSUZUNE read-back。
- **stop:** 現行interaction surface、schema、IPC、認可を越える修正やproduct判断が必要な候補はHeldに置き、自動実装しない。

## Execution

1. 現行source、diff、test、isolated captureからreview対象を確定する。
2. correctness、interaction、accessibilityを独立に監査し、P0〜P3と再現根拠を統合する。
3. P0/P1と、小さく一貫した高確度P2だけをtest-firstで実装する。
4. focused/full/build/MCP、keyboard、1440／900／720、Markdown不変を検証する。
5. production update、post-restart確認、TSUZUNE final-boundary writebackを行う。

