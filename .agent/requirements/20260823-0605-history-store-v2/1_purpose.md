# TSUZUNE History Store v2 Purpose

## Problem

AI更新のたびに旧本文全文を1 Markdownとして保存するため、履歴容量とファイル数が更新回数に比例して増え続ける。

## Target User

一台のWindows PCで個人TSUZUNE Vaultを長期利用する本人。

## Current Workaround

`50_履歴/AI更新` を通常検索・Graphから除外し、履歴自体は全文Markdownのまま無期限保存している。

## Why Now

2026-08-23の観測で1197 files / 16,985,507 bytesに達し、止血だけでは成長率を変えられないことが確認された。

## Desired Outcome

現在ノートは通常のMarkdownとして読める状態を保ち、各更新の旧本文を圧縮した不変recordから完全復元できる。安全なcommit判定を先に確立し、deltaとpackは後続の実測ゲートで容量とfile countを抑える。

## Success Definition

1. Unicode、CRLF、BOM、空本文を含む全fixtureがbyte-exactに復元できる。
2. 1 byteの改ざん、hash不一致、intent/receipt不一致を検出して復元を拒否する。
3. 既存履歴とproduction writerを変更せず、v2 codecを独立検証できる。
