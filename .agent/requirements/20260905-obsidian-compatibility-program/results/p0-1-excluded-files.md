# P0-1 Excluded Files Evidence Packet

As of: 2026-09-05  
Subject: current dirty source checkout; installed TSUZUNE 0.6.0 is a different delivery.

## Outcome

Obsidian互換性Programの最初のP0として、Excluded filesをVault scan時に一律削除する挙動を、surface-specificな表示契約へ変更した。

- Renderer snapshot／File Explorer: directory、Markdown、attachmentを保持する。
- Search／Graph: persisted patternに一致するexisting fileを表示しない。
- Graph resolution: 全fileでlinkを解決してからexcluded nodeと接続edgeを除去するため、excluded existing targetを未解決nodeへ誤変換しない。visible source由来の別の未解決nodeは保持する。
- Quick Switcher／editor link suggestions: candidateを削除せず、通常candidateの後へ安定的に配置する。
- MCP: 既存のfiltered scanを維持し、AI retrievalの狭い開示境界を変えない。
- Linked backlinks: 公式保証が明示するunlinked mentionsと同一視せず、変更しない。

## Changed Artifacts

- `src/main/ipc.ts`
- `src/core/graph.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/QuickSwitcherDialog.tsx`
- `src/renderer/components/MarkdownEditor.tsx`
- `tests/ipc.graph-settings.test.ts`
- `tests/graph.test.ts`
- `tests/quick-switcher-dialog.test.tsx`
- `tests/markdown-editor.test.tsx`
- `tests/app.safety.test.tsx`
- compatibility programのledger／state／plan/status artifacts

## Verification

- RED: 新規5 testsは変更前の挙動に対して意図どおり5件FAIL。
- Focused GREEN: 5 files / 141 tests PASS。
- Related renderer/MCP safety: 3 files / 102 tests PASS。
- Full suite: 102 files PASS / 1 SKIP、986 tests PASS / 1 SKIP。
- Typecheck: PASS。
- Independent verifier: combined 8 files / 243 tests PASS with 8 GiB heap。既定heapでの同時実行はOOM。
- `git diff --check`: PASS。既存のLF/CRLF warningのみ。

## Delegation Record

- `non_life_repo_scout`／core parity調査: authoring、files、Properties、workspaceの証拠をread-only分類。Propertiesとworkspace restartを次候補として採用。
- `state_01_life_weather`／STATE-01文脈監査: Graph、Canvas、Bases、Excluded filesをread-only照合。scan-level exclusionを最上位P0とする提案を採用。
- `obsidian_official_scout`／公式仕様調査: Obsidian Helpだけから機能面と反模倣境界を整理。互換台帳のofficial baselineへ採用。
- `verify_excluded_files_parity`／VERIFY-01: changed sourceと8-file suiteをread-only独立検証。PASSを採用。
- `prototype_launch_scout`: LIFE Weatherからscope変更前の調査であり、今回の互換性成果には不採用。prototype／browserは操作していない。

全Agentにproduction TSUZUNE write、Git、production update、対象外code変更を禁止した。親AgentがTask Contract、実装、統合、未提示境界、repository／TSUZUNE書戻しを所有する。

## Remaining Boundary and Next

- Source implementationのみ。本番反映、Git delivery、fresh Obsidian GUI recaptureは未実施。
- 次のPrimary sliceはProperties authoring foundation。一つのscalar propertyを周辺YAML非破壊で追加／編集／削除し、保存・再読込を固定してからlist／typed valuesへ広げる。
- その次はNamed Workspacesのsave/load/restart、Canvas file round-trip minimum、Properties安定後のBases。
- community plugin無制限runtime、cloud Sync／Publish模倣、LIFE Weatherはこのwork itemの外。
