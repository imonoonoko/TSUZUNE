# Compact Decision Envelope Benchmark — Generator Packet v2

This is a closed synthetic packet for a read-only formatting and decision-contract benchmark. Do not inspect other benchmark files, use live TSUZUNE facts, or add outside facts. Writes and product changes are prohibited in every case.

Use only these outcome labels: `NO_CHANGE`, `PROPOSED`, `BLOCKED`, `CONFLICT`. When more than one may apply, precedence is `CONFLICT > BLOCKED > PROPOSED > NO_CHANGE`. Contradictory known evidence is `CONFLICT`; `BLOCKED` covers missing or unknown facts without directly contradictory known states.

## F1 — Normal no-change

- Proposition: 現在、実装すべきPrimaryは存在するか。
- Canonical: `F1:PLAN@p1`.
- Evidence: `F1:STATUS@s1`, `F1:R0@r1`, `F1:RECEIPT@i1`; all traceable and aligned with no Primary.
- Scope: 4/4 inputs consulted; omitted in scope 0; whole-Vault scan explicitly excluded.
- Freshness: source frozen, revision consistent, runtime fresh. Delivery mismatch is known and non-decisive.

## F2 — Bounded proposal

- Proposition: Nextを「なし」から5-case read-only benchmarkへ変更すべきか。
- Canonical: `F2:PLAN@p1`; base revision matches.
- Evidence: `F2:USER_SELECTION@u1` explicitly selects this benchmark; `F2:DESIGN@d1` requires this exact five-case comparison.
- Scope: 3/3 consulted; omitted in scope 0; product implementation excluded.
- Freshness: source frozen, revision consistent, runtime not required, delivery not relevant.
- Boundary: the user authorized the benchmark run only. A proposal is not applied; changing `F2:PLAN@p1` requires separate explicit approval after results.

## F3 — Unknown owner and unmeasured omission

- Proposition: project stateを自動更新すべきか。
- Canonical: unknown. Available `F3:MOC@m1` is projection; `F3:DATED_EVIDENCE@e1` is evidence.
- Scope: candidate-owner search incomplete; omission status `NOT_MEASURED`.
- Freshness: source status unknown; runtime not relevant.

## F4 — Revision and evidence conflict

- Proposition: Nextを「なし」から製品実装へ変更すべきか。
- Canonical: `F4:PLAN`; proposal base `p0`, current revision `p1`.
- Evidence: `F4:EVIDENCE_A@a1` says implementation threshold met; `F4:EVIDENCE_B@b1` says threshold unmet.
- Scope: 4/4 consulted; omitted in scope 0.
- Freshness: base revision stale; current source known.
- Boundary: contradictory known evidence is `CONFLICT` and outranks the stale-base guard.

## F5 — Stale live boundary

- Proposition: current sourceはinstalled productionと同一で、安全にapply可能か。
- Current source owner: `F5:SOURCE@s1`.
- Installed identity owner: `F5:RECEIPT@i1`.
- Runtime observation: `F5:RUNTIME@m1`.
- Scope: 3/3 consulted; omitted in scope 0.
- Freshness: source frozen; active runtime stale; delivery mismatch; receipt is older than source.
- Boundary: source, runtime, and installed identity are distinct; equality and safe apply are not established.

## Measurement contract

- Do not include a separate measurement footer in the case outputs.
- Each case begins with `=== F1 ===` through `=== F5 ===`.
- Keep each A case at or below 645 Unicode code points.
- For B, put a literal `details:` marker after its safety summary. Keep each summary and the full F1 case at or below 645 Unicode code points.
- Character measurement normalizes CRLF to LF and counts Unicode code points, including spaces and newlines.
