# TSUZUNE Sync Core v2 Purpose

## Problem

現在のGoogle Drive同期は、安全な手動preview／applyと2 profile往復までは成立しているが、常時の複数端末同期、添付、利用者が復元できる版履歴、E2EEを一貫して拡張できるprovider非依存の中核契約がない。

## Target User

TSUZUNEを個人のMarkdown知識基盤として使い、将来は複数の自分の端末で同じVaultを安全に扱いたい工房主。

## Current Workaround

Google Drive専用の手動preview／applyを使い、競合時は両方を保持する。削除伝播は明示optionで、常時自動同期ではない。

## Why Now

常時同期、添付、履歴をDrive固有serviceへ直接追加する前なら、既存挙動を保ったまま共通core境界を小さく導入できる。

## Desired Outcome

Markdownと添付を正本に保ち、transportがGoogle Driveでも将来の専用remoteでも、同じ同期判定・競合・削除・復旧契約を使える。

## Success Definition

- 2台がオフライン編集後に再接続しても、本文・削除・移動を失わず収束する。
- 競合では両方を保持し、利用者が過去版を復元できる。
- 同期台帳は補助状態であり、失ってもローカル正本とremoteから安全に再構築できる。

