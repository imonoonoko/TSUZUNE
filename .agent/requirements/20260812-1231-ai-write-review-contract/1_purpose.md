# AI Write Review Mode Purpose

## Problem

現在の`update_note`確認はCodex host設定であり、TSUZUNE自身は人間が内容を確認した事実を検証できない。一方、全AI更新を毎回確認させると日常運用の負担になる。

## Target User

ローカルPC上でTSUZUNEと外部AIを使う一人の利用者。

## Current Workaround

通常ノートは`autonomous_update_note`で履歴付き更新し、特に保護したいpathは`immutable`にする。確認が必要な更新はhost側promptへ依存する。

## Why Now

CP0-T06でimmutableが成立し、CP0-T07でReviewの欠落がserver／app間のproposal contractだと確認できた。

## Desired Outcome

利用者が明示したpathだけ、AI変更案をTSUZUNE appで比較してから承認または取消できる。承認されるまでVault本文は変わらない。

## Success Definition

- Review対象外の既存運用は変わらない。
- Review対象への全MCP書込みは承認前にVaultへ反映されない。
- staleまたはimmutableになったproposalは適用されない。
- 再起動後も未処理proposalを確認できる。
