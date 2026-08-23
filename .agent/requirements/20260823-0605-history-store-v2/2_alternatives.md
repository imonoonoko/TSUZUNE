# TSUZUNE History Store v2 Alternatives

## Codebase Findings

- `src/mcp/service.ts` はAI更新前の旧本文全文を `50_履歴/AI更新` に作成してから現在ノートを保存する。
- `scripts/preview-history-compaction.ts` は既存履歴のinventory、manifest、revision検証をread-onlyで行うがapplyは持たない。
- 現行依存にSQLite、差分、圧縮DB libraryはない。Node標準のcryptoとfilesystemは利用済み。

## Options

### Option A: 全文Markdownのretentionだけ変更

Effort: Small

Value: Medium

一定期間後にZIP化または世代間引きを行う。

Tradeoffs:
- 既存形式を維持できる。
- 履歴生成量の根本原因は残る。
- 全版永久監査と間引きは両立しない。

### Option B: checkpoint＋byte delta＋hash chain

Effort: Large

Value: High

最初と定期境界だけ完全本文を圧縮保存し、中間版はUTF-8 byte列の共通prefix/suffix deltaとして保存する。

```text
checkpoint(before) -> delta(after) -> delta(after) -> checkpoint(before) -> ...
       |                   |               |
       +------ SHA-256 chain and provenance ----------------+
```

Tradeoffs:
- 小変更の重複本文を大幅に減らせる。
- 復元chainと破損時の停止契約が必要。
- production writeとの原子性は別フェーズで設計が必要。

### Option C: compressed SQLite BLOB＋index

Effort: Large

Value: Medium

圧縮本文・差分・metadataをSQLiteへ格納する。

Tradeoffs:
- queryとindexは強い。
- Markdown履歴を読むためにDB runtimeが必須になる。
- WAL、OneDrive、migration、backup責務が増える。

### Option D: 外部backup製品

Effort: Medium

Value: Medium

Kopia等へ履歴folderをsnapshotする。

Tradeoffs:
- dedup、retention、integrity機能を再利用できる。
- TSUZUNEのas-of復元とprovenance統合が弱い。
- 新規runtime dependencyが必要。

## Recommendation

History Store v2は採用するが、Option Bを一段階に分ける。

1. Phase 1: 更新ごとのimmutable compressed full-preimage intent、commit receipt、exact-byte restore、tamper detection。
2. Phase 2 Research: full-preimage圧縮率とwriter atomicityを実測する。
3. Phase 3候補: closed periodだけをimmutable packへ集約する。custom deltaは採用せず、必要性とmaintained libraryを別ゲートで評価する。

SQLiteは将来の再構築可能なVault外indexに限り再検討する。mutable monthly pack、mutable manifest、open pack appendは採用しない。
