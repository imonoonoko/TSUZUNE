# Windows Accessibility Baseline Purpose

## Problem

TSUZUNEはGraphと主要編集操作にDOM上のARIAやkeyboard操作を持つが、実Windows keyboard、screen reader、High Contrast、100〜200%表示倍率で受入済みとはまだ言えない。

## Target User

Windows上でTSUZUNEを使う本人。キーボード主体、拡大表示、支援技術を使う場面を含む。

## Current Workaround

既存のunit testとソース読解でDOM上の契約だけを確認している。実OSの利用性は未証明として扱う。

## Why Now

Graph parityはcamera gateで停止中であり、次の独立Trackとして、既存の未証明品質境界を狭く測定できる。

## Desired Outcome

何がDOM回帰で確認済みか、何が実Windowsで未証明かを分け、最初の実OS受入対象を固定する。

## Success Definition

Graphのprimary flowについて、keyboard-only操作、visible focus、200%での主要操作到達性、支援技術の名前／状態を、実行環境と証拠種別を明記してPASS／SKIP／FAILに分類できる。
