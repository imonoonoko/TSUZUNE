# Windows Accessibility Baseline Discussion Log

## Intake - 2026-08-12 01:50 JST

### User Input
> アクセシビリティの独立sliceを進めることを了承した。

### Codex Proposal Or Question
実装前に、既存のDOM／keyboard回帰と実Windows受入を分離して、最小のbaselineを固定する。

### Decisions
- Accepted: Graphを中心に、720px幅・100〜200%表示倍率・keyboard-only・支援技術の現状を確認するslice。
- Accepted: DOM testと実Windows受入を同じ証拠として扱わない。
- Rejected: この段階で新しい支援機能、theme、Graph parityの別機能を同時に実装すること。
- Open: 実Windowsで使うscreen readerとHigh Contrastの具体的な受入手順。

### Rationale
既存コードにはARIA、visible focus、keyboard操作がある一方、実OSでの確認は未証明とPLANが明記しているため。

---

## Baseline Observation - 2026-08-12 01:55 JST

### Codex Observation
- Installed TSUZUNE v0.5.0 was opened on Windows and exposed a native accessibility tree containing the app region, named header actions, `Vaultファイル` tree, named Graph entry button, editor controls, and a labelled Markdown editor.
- The automation transport could not confirm the Graph-entry click because it reported unavailable coordinate geometry. Graph-internal keyboard behavior was not observed through this route.
- `tests/wiki-graph-view.test.tsx` passed 42 tests, including pointer/Enter node opening. This is DOM regression evidence only.

### Decisions
- Confirmed: app-shell and existing primary controls expose names in the observed Windows accessibility tree.
- Not confirmed: Graph internal keyboard flow, 100%/200% display scale, Narrator, High Contrast, physical focus visibility.
- Next: require a manual real-Windows packet for the unconfirmed items before proposing product changes.

### Rationale
UI Automation tree observation and jsdom tests do not substitute for the remaining real-OS acceptance categories.

---

## P1 Start Attempt - 2026-08-12 02:xx JST

### Codex Observation

- Installed TSUZUNE v0.5.0をComputer Useで起動し、1266×793の実Windows accessibility treeを再取得した。header actions、Vault tree、named Graph button、Markdown editorは再び確認できた。
- Global Graphへ移るための最初のautomation click前に、target windowがminimizedとして返った。利用者の操作と競合する可能性があるため、windowの復帰やGraph内への追加inputは自動で繰り返さなかった。
- Vault本文、Graph状態、display scale、High Contrast、screen reader設定は変更していない。

### Decisions

- Confirmed: app-shell accessibility treeの既存baselineは実Windowsで再確認できた。
- Still not confirmed: Graph keyboard flow、720px幅、100%／200%表示、Narrator／NVDA、High Contrast。
- Next: 利用者がTSUZUNE windowを復帰して操作可能な状態にした後、fresh stateからkeyboard-only packetを再開する。

### Rationale

最小化されたtargetへ座標や古いelement indexを使って再試行すると、実Windows操作の証拠として不正確であり、利用者の現在操作も妨げ得るため。

---
