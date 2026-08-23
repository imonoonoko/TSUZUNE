# Quick Switcher P0-1 Acceptance

日付: 2026-08-17（JST）
状態: implemented, installed, and verified

## 結論

Obsidian級Daily Workspace要件の最初のsliceとして、`Ctrl+O`のQuick Switcherを本番TSUZUNEへ反映した。現在sessionの最大20件MRU、タイトル／Vault相対path／本文の決定的検索、重複タイトルのpath表示、Arrow／Home／End／Enter／Ctrl+Enter、明示的な新規ノート作成、Escapeと起点focus復帰を提供する。Markdown正本、既存のopen／tab／create経路、Paper／Thread Tealを維持し、新規依存は追加していない。

## 実装境界

- `src/renderer/components/QuickSwitcherDialog.tsx`: combobox／listbox、session MRU、最大50件の描画、keyboard操作、no-match状態。
- `src/renderer/components/QuickNoteCreateDialog.tsx`: 名前と作成先の確認、作成path preview、validation、focus trap。
- `src/renderer/App.tsx`: `Ctrl+O`と表示ボタン、既存open／new-tab／create handlerへの接続、MRU、正確なfocus復帰。
- `src/main/vault.ts`: 10,000ノートでWindowsの`EMFILE`を起こしていた無制限scanを、順序を保つ16件batchへ限定。
- `src/renderer/styles.css`: 既存tokenだけを使う640px transient layer、狭幅対応、forced-colors選択輪郭。

永続MRU、非Markdown tab、Command Palette、full-text search再設計、aliases専用modelはこのsliceへ含めない。現在の`NoteDocument`はalias fieldを公開していないため、alias一致は測定・主張していない。

## 検証

- TDD: scan同時読込は修正前`96`並列でFAIL、修正後最大`16`でPASS。
- focused: Quick Switcher／新規作成／App統合 `84 PASS`。
- Vault関連: concurrency／scan race／integration `31 PASS`。
- 全体: `743 PASS / 1 SKIP`。
- `npm run typecheck`: PASS。
- `npm run build`: PASS。
- `npm run check:mcp`: Codex／Freebuff共通14 tools、direct 16 tools、read 8／write 8でPASS。
- 隔離Electron: 1440×900と720×768で単一modal、combobox focus、背景inert、選択、横overflowなし、Escape後の`開く`focus復帰、fixture Markdown 7件の前後SHA-256一致を確認。

画面証拠:

- [wide initial](assets/quick-switcher-2026-08-17/01-wide-initial.png)
- [wide filtered](assets/quick-switcher-2026-08-17/02-wide-filtered.png)
- [narrow filtered](assets/quick-switcher-2026-08-17/03-narrow-filtered.png)
- [capture result](assets/quick-switcher-2026-08-17/capture-result.json)

## 10,000ノート性能

決定的generatorで作成した10,000 Markdownを隔離userDataの実Electronで開き、1 warm-up後に日本語本文、path、重複title prefix、title、本文の5 queryを各6回、計30回測定した。

| 指標 | 結果 | 基準 |
|---|---:|---:|
| cold open → workspace ready | 3,881.8 ms | 検索基準とは分離 |
| query p50 | 17.8 ms | 記録のみ |
| query p95 | 26.1 ms | 150 ms以下 |
| query max | 26.8 ms | 記録のみ |

順序は全queryで決定的、全30入力はcommit済み、DOM候補は最大50件、Markdown 10,000件の前後SHA-256は`250d05662ec8ec90271ccc1d653102846de1ebd37904de734edc342d8d19a4ce`で不変だった。測定環境と全sampleは[performance-result.json](assets/quick-switcher-2026-08-17/performance-result.json)を正本とする。

## 本番受入

`npm run production:update`は10/10 checksをPASSした。

- installed version: `0.5.0`
- built／installed executable SHA-256: `5cffdbcac0ffb3545fdfe9243a391d237c7cd04861336ccceb217b7305d32127`
- built／installed `app.asar` SHA-256: `109b2e1574b2404cfb80675923f6501a2f96901f6e594ed3ac403f6f0375cc5d`
- production profile: 58 files、digest前後一致、`unchanged: true`
- MCP: 再登録済み

機械可読な最終境界は[production-update-latest.json](production-update-latest.json)を正本とする。

## 残る受入境界

- R2以降のCommand Palette、full-text search、FileTree、tabs、reading／writing surfaceは未実装。
- 実WindowsのNarrator／NVDA、100〜200% DPI、物理keyboardによる受入は未実測。
- alias専用一致は、note modelへ利用可能なalias契約が加わった時点で追加評価する。
