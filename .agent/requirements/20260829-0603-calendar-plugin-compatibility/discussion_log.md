# Calendar Plugin Compatibility Discussion Log

## Contract - 2026-08-29 06:03

### User Input
> Obsidian Calendar pluginの互換性を完全にしてほしい。やって。

### Codex Proposal Or Question
Liam CainのCalendar公式安定版1.5.10を固定対象とし、公式配布物を改変せずTSUZUNEの限定API shim上で動かす。任意plugin runtimeへは広げない。

### Decisions
- Accepted: Calendarを最初の実plugin互換対象にする。
- Accepted: 互換性は見た目ではなく、上流配布物・公開挙動・設定・commandのconformanceで判定する。
- Rejected: 現在のネイティブCalendarだけを「完全互換」と呼ぶ。
- Open: 公式release assetの正確なSHA-256と、実際に必要なObsidian API surface。

### Rationale
既存のmanifest scannerとnative Calendarは安全な土台だが、第三者pluginコードの無改造実行はまだ証明されていない。対象とversionを固定すれば、汎用runtimeを作らず実物で検証できる。

---

## Resolution - 2026-08-29 13:49

### Evidence
- Official stable version: `1.5.10`, commit `7d2aebda7f4a280bedc6da6d25f4da611d1625ef`.
- Official release ZIP: `e110a1c1e47247c00a931b629aeded35c2b7025f6e71bf37fd30823f6b949f1d`.
- `main.js`: `7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125`.
- `manifest.json`: `f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b`.
- Required API surface was implemented only inside the Calendar-specific sandbox host and verified against the unmodified artifact.

### Decisions
- Resolved: artifact identity and required API surface are pinned and covered by the conformance matrix.
- Accepted: exact upstream `moment@2.29.1` retains a known High audit finding, isolated to a local sandbox path and recorded as residual risk.
- Rejected: upgrading Moment inside this work item, because it would stop being exact Calendar 1.5.10 artifact compatibility.
- Boundary: this result does not establish arbitrary Obsidian plugin compatibility.

---
