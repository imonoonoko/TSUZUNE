# TSUZUNE Obsidian級Daily Workspace 改善設計: discussion log

- Date: 2026-08-17
- Status: draft, user confirmation pending
- Scope: UI/UX proposal only
- Product code: unchanged
- Target: one-person, local Windows daily knowledge workspace

## Request

利用者は、TSUZUNEをObsidian並みに使いやすく見やすくするための徹底的な改善案を求めた。

## Context used

- Repository: `PRODUCT.md`, `DESIGN.md`, `PLAN.md`, `PROJECT_STATUS.md`, renderer code, tests, current dirty-worktree state.
- Production TSUZUNE: Obsidian参考UI・UX改善監査、UX・デザインシステム、A案ロードマップ、project note、直近実施記録。
- Current Obsidian Help: Quick switcher, Command palette, Search, File explorer, Tabs, Sidebar, Properties, Backlinks, Outline, Graph, Hotkeys.
- Independent read-only reviews: daily flows, accessibility/keyboard/scaling, current Obsidian interaction reference.

## Discovery conclusions

PRODUCT.mdとDESIGN.mdが、利用者、目的、色、外観、ローカル制約、アクセシビリティを既に固定している。今回の依頼も「Obsidian並み」という体験基準を明示しているため、追加インタビューなしで次の前提を置いた。

- Purpose: 見た目の模倣ではなく、毎日の操作速度、発見性、可読性をObsidian級へ引き上げる。
- Primary user: 日本語で長時間使う本人一人。Windowsデスクトップ、通常の室内光、集中した執筆・調査・整理を想定する。
- Fidelity: 実装へ渡せる高精度の設計・要件。ただしこのsessionでは製品コードを変更しない。
- Breadth: 日常workspace全体。探す、読む、書く、整理する、文脈を辿る、の5動線。
- Visual direction: Restrained。既存のPaper、Ink、Thread Tealと「静かな知識工房」を維持する。
- Anchor references: Obsidianの操作モデル、VS Codeのコマンド／ツリー操作、Windows File Explorerのファイル操作。
- Anti-goals: pixel copy、プラグイン基盤、account、cloud、collaboration、AI dashboard、機能数だけの拡張。

## Current verified strengths

- Markdown filesが正本で、アプリ専用DBへ閉じ込めていない。
- 3ペインは「左は場所、中央は作業、右は文脈」として成立している。
- Preview Properties、左右sidebar collapse、右context tabs、編集／プレビュー主切替、保存状態は既に実装・本番反映済み。
- CodeMirror、Wikiリンク、テンプレート、検索ranking、`tag:`／`path:`／`file:`／phrase／negation、workspace tabs、Graph、Related／Temporal dataを再利用できる。

## Main gaps

1. ノート、操作、本文検索の入口が分かれておらず、マウス依存が残る。
2. FileTreeとworkspace tabsが視覚的には機能するが、標準keyboard／ARIA契約が未完成。
3. 長文のOutline、読みやすい行長、Properties折りたたみ、Backlinksの判断材料が不足。
4. 左toolbarとeditor toolbarで、高頻度と低頻度の操作が同じ重みになっている。
5. 720px、長い日本語、100〜200% display scale、Narrator／NVDA、High Contrastが実OSで未受入。

## Decision proposal

推奨案は「Daily Workspace interaction parity」。Obsidianの全機能や外観を複製せず、3つの入口と5つの日常動線を共通契約へ揃える。

- `Ctrl+O`: ノートを開く
- `Ctrl+P`: 操作を実行する
- `Ctrl+Shift+F`: 内容を検索する

このproposalは利用者確認後に確定する。確認前はPLAN.mdのPrimary Trackやproduction statusへ採用済みとして書かない。

## Visual probe decision

新しいブランドや新規surfaceではなく、既存workspaceの情報設計と操作契約を整える作業である。PRODUCT.md／DESIGN.mdと現行画面が視覚方向を十分に固定しているため、画像生成によるdirection probeは行わない。

## Confirmation gate

利用者が推奨方向を確認した後、P0を一公開挙動ずつ要件化・実装する。最初の候補は既存検索を再利用するQuick Switcherである。

## Final independent review

Read-onlyの独立レビューでは重大な矛盾、現行codeとの不一致、過剰設計は見つからなかった。軽微な曖昧さとして、Quick Switcherのrecent保持範囲、10,000-note性能計測条件、日本語IME中のTree typeahead、global shortcutの優先順位を特定し、scope／requirements／UI briefへ反映した。

## 2026-08-22 — 次期作業の具体化

- R1 Quick Switcher、R2 Command Palette、R3 Full-text Search、R4 FileTree keyboard／ARIAとclick focus修正はinstalled-and-verifiedとして扱う。
- 次の作業は新UI実装ではなく、Phase Aのbackground-safe isolated acceptanceと、明示承認後のPhase B user-visible Windows acceptanceへ分ける。
- acceptanceの結論は`FIX-ONE`、`R5-READY`、`STOP-UNVERIFIED`の三択とし、PASSを推測しない。
- `R5-READY`でもWorkspace Tabs実装は自動開始せず、次の一公開挙動として明示選択を待つ。
- R5は既存`workspaceTabs`／`activeTabId`／load／close／global shortcut経路を再利用し、tab persistence、pin、reorder、split view、新state managerを含めない。
