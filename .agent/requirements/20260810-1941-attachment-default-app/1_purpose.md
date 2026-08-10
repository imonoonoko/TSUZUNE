# GP0-3b-n Attachment Default App Purpose

## Problem

TSUZUNEのGraphは添付をdouble clickまたはPreviewからOS既定アプリへ渡せるが、Obsidianのattachment context menuにある`デフォルトアプリで開く`がない。利用者は同じ操作をGraph menuから選べず、Obsidian parityのmenu比較も一項目未完である。

## Target User

Windowsの個人Vaultで、Graph上の画像やPDF等を普段使う既定アプリへ安全に渡したいTSUZUNE利用者。

## Desired Outcome

- 実在attachment nodeのcontext menuから`デフォルトアプリで開く`を選べる。
- 既存のVault検証済み外部open経路だけを再利用する。
- Graph、workspace、Vault本文を変えない。
- 固定Obsidian 1.13.4と、request、menu close、Graph lifecycleの中核挙動を比較できる。

## Success Definition

固定fixtureの添付1件について、両製品がexact対象へ外部open requestを1回だけ発行し、menuを閉じ、Graph query／camera／node・edge集合／tabとVault内容を変えない。比較ではOSアプリを起動せず、hookを復元し、未証明境界を明記する。
