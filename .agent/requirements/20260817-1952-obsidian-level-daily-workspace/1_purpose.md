# TSUZUNE Obsidian級Daily Workspace: Purpose

Status: draft, user confirmation pending

## Problem

TSUZUNEは、Markdown編集、3ペイン、検索、リンク、Graph、保存安全性という日常ノートアプリの土台を持つ。一方、目的のノートをすぐ開く、操作を名前で呼ぶ、ツリーやタブをキーボードだけで移動する、長文を見渡す、といった反復操作が十分に統一されていない。

そのため機能は存在しても、利用者は左側のボタンを探す、長い一覧をスクロールする、サイドバーと本文を行き来する、という小さな判断を繰り返す。見た目の密度だけを下げても、この摩擦は解消しない。

## Target User

日本語のノート、開発記録、調査、判断を一台のWindows PCで毎日扱う本人一人。短いメモだけでなく、長文、深いフォルダ、長い日本語タイトル、複数タブ、関連ノートを行き来する。

利用時の状態は、アイデアを急いで残す時、目的の記録を探す時、長文を集中して読む／書く時の三つが中心である。

## Current Workaround

- 左サイドバーの検索欄やボタンへマウスで移動する。
- Treeをクリックして展開し、長い一覧を目視で探す。
- 長文は本文スクロールだけで移動する。
- Graph、Bookmark、今日のノート、Captureなど同じ重みの操作群から目的を選ぶ。
- 狭い画面ではサイドバーを手動で閉じ、必要になったら戻す。

## Why Now

Preview Properties、sidebar collapse、右context tabs、ノート操作階層という基礎改善が完了し、現行3ペインを捨てずに日常動線へ集中できる段階になった。利用者が完成水準を「Obsidian並み」と明示したため、局所修正の列ではなく、一つの操作契約として整理する必要がある。

## Desired Outcome

「探す、読む、書く、整理する、文脈を辿る」の各動線が、クリックとキーボードのどちらでも迷わず完了する。Obsidianに慣れた人が操作原則を推測でき、TSUZUNE固有のPaper／Thread Teal、時間・出典・安全性はそのまま残る。

「Obsidian並み」は次を意味する。

- 外観や全機能の複製ではなく、日常操作の速度、予測可能性、可読性、keyboard accessibilityが同等水準である。
- 現在ノート、現在タブ、現在ペイン、保存状態が常に分かる。
- 同じ操作へ、画面上のcontrol、keyboard shortcut、Command Paletteの三経路で到達できる。
- Markdown正本とローカル・一人用の境界を崩さない。

## Success Definition

1. 任意の画面から、既知のノートを`Ctrl+O`、文字入力、Enterだけで5秒以内に開ける。
2. 主要操作を`Ctrl+P`から名前で探して実行でき、Tree、Tabs、Context tabsをマウスなしで操作できる。
3. PreviewとEditorの本文は通常時65〜75文字程度の読み幅になり、Outlineから長文の見出しへ移動できる。
4. 720／900／1280／1440 CSS pxとWindows 100／125／150／175／200%で、主要操作が画面外へ消えず、viewport全体の横scrollを発生させない。
5. WCAG 2.2 AA、明確なfocus、NarratorまたはNVDA、High Contrastの実Windows受入を、DOM testとは分けて記録する。

## Stop Rule

この設計sessionは、推奨方向、段階scope、user-facing requirements、UI briefを提示し、利用者の確認を求めた時点で止める。製品実装、PLAN.mdへのPrimary採用、本番反映は確認後の別sliceとする。
