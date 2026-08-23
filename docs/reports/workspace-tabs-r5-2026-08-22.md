# Workspace Tabs R5 受入記録（2026-08-22）

## 結論

R5 Workspace Tabs のキーボード操作とARIA連結は `R5-READY`。既存のApp内タブ状態と読込・保存経路を再利用し、永続化・pin・並べ替え・recently closed・split view・新規依存は追加していない。

## 実装境界

- roving `tabIndex`、安定したtab ID、`aria-selected`、`aria-controls`、tabpanelの`aria-labelledby`
- `ArrowLeft` / `ArrowRight` の循環フォーカス、`Enter` / `Space` の選択
- `Ctrl+Tab` / `Ctrl+Shift+Tab`、`Ctrl+1..8`、`Ctrl+9`、安全な `Ctrl+W`
- modalまたはテキスト入力が所有する `Ctrl+W` はタブを閉じない
- active tabを閉じた後は隣接tabを選択してフォーカスし、最後のtab後はラベル付きempty stateを表示
- 長いtab名は既存の省略表示を維持し、完全な`title`とaccessible nameを持つ

## 検証

- focused: `npx vitest run tests/app.safety.test.tsx --maxWorkers=1 -t "workspace tabs"` → 2 passed
- App全体: `npx vitest run tests/app.safety.test.tsx --maxWorkers=1` → 82 passed
- full: `npm test` → 770 passed / 1 skipped
- `npm run typecheck` → passed
- `npm run check:mcp` → passed
- `git diff --check -- src/renderer/App.tsx tests/app.safety.test.tsx scripts/check-daily-workspace-phase-a.mjs` → whitespace errorなし（既存のLF/CRLF warningのみ）
- `npm run production:update` → installed-and-verified、10/10 checks passed

## 隔離Electron受入

- 実行対象: インストール済み `TSUZUNE.exe`
- executable SHA-256: `853173efd7c84ec20a1a1db62c256ab53ec8690b9ec45760af450b889a8462d3`
- viewport: 1440×900 / 720×768
- 720px時のdocument幅: 720px
- 117文字の日本語tab名: 省略表示、完全な`title`、accessible nameを確認
- keyboard / ARIA: verified / verified
- fixture Markdown digest: before/after一致
- 残存TSUZUNE process: 0

証拠:

- [R5 result](assets/workspace-tabs-r5-2026-08-22/r5-result.json)
- [R5 screenshot](assets/workspace-tabs-r5-2026-08-22/a6-tabs-baseline.png)
- [production update receipt](production-update-latest.json)

## 途中で検出した境界

初回の実機R5検証で、既存の`beginOperation()`が外したフォーカスをmicrotaskで戻すとbusy解除描画より早く、Enter選択後のtabフォーカス復帰が失敗することを検出した。復帰だけを次のtaskへ送る最小修正後、単体・隔離実機の両方でPASSした。

Phase BおよびR6以降は未着手。
