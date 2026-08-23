# TSUZUNE History Store v2 Discussion Log

## Intake And Direction — 2026-08-23 06:05

### User Input
> AI更新履歴の肥大化対策として、Ponytailを使わず TSUZUNE History Store v2 を採用する。GitHubは使わない。

### Codex Proposal Or Question
現在Markdownを正本のまま維持し、履歴だけをcheckpoint、byte delta、圧縮pack、hash manifestで保存する。既存履歴を変更しない非破壊Phase 1から開始する。

### Decisions
- Accepted: TSUZUNE History Store v2。
- Accepted: GitHub、Git repository、cloud serviceを履歴保存の必須要素にしない。
- Accepted: 既存 `50_履歴/AI更新` は移動・削除・変換しない。
- Accepted: Phase 1はcodec、復元、改ざん検知をfixtureで証明する。
- Rejected: SQLiteを本文の正本または必須runtimeにすること。
- Open: production writerへの接続、旧Markdown履歴のretention、monthly pack close処理。

### Rationale
履歴形式の変更はデータ損失riskが高い。復元可能性を純粋codecで先に証明すれば、既存production経路へ影響せず次の判断ができる。

---

## Phase 1 Safety Correction — 2026-08-23 06:36

### User Input
> TSUZUNE History Store v2を採用する。

### Change
- Previous: Phase 1でcheckpoint、custom byte delta、monthly compressed packを実装する。
- Updated: Phase 1は更新ごとのimmutable compressed full-preimage intentと、canonical read-back後のimmutable commit receiptに限定する。

### Rationale
desktopとMCPの複数process、canonical note、mutable monthly pack、manifestは一つのfilesystem transactionにできない。OneDrive競合やprocess crashで、個別hashが正しくても適用済み履歴が欠落し得る。full-preimage recordは一件の破損blast radiusを一更新へ限定し、indexを再構築可能にできる。

### Affected Outputs
- `2_alternatives.md`
- `3_scope.md`
- `4_requirements.md`
- `6_implementation_brief.md`
- Phase 1 tests and codec

---
