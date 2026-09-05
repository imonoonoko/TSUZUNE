# Calendar Plugin Compatibility Purpose

## Problem
TSUZUNEにはCalendar風の月表示があるが、Obsidian Calendar pluginそのものは動かず、設定、command、日次・週次ノート操作、書量・未完了task表示を含む互換性はない。

## Target User
個人のWindows PCでTSUZUNEとMarkdown Vaultを使い、Obsidian Calendarと同じ操作資産を持ち込みたい利用者。

## Current Workaround
TSUZUNE組込みの限定Calendarで既存Daily Noteを開く。未作成日の作成、上流設定、週次ノート、word/task indicator、plugin commandは使えない。

## Why Now
利用者がCalendarを具体的な最初の互換対象として選び、以前のHeld再開条件を満たした。

## Desired Outcome
公式Calendar 1.5.10の配布`main.js`と`styles.css`を改変せず、TSUZUNE上で公開されたdesktop挙動と設定が動く。

## Success Definition
1. 固定した公式artifactが無改変のままcompatibility hostへloadされる。
2. README、source、manifestで確認できるdesktopの公開挙動・設定・commandをconformance matrixで100% PASSにする。
3. 任意plugin実行やVault外writeを増やさず、full regressionとproduction updateを通す。

