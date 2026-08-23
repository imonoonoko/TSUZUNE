# Current-State Compiler R0 Baseline — 2026-08-23

Status: **complete / R1 not authorized**

This report freezes the current capability, source/runtime boundary, owner candidates, and the smallest R1 fixture brief for the `PLAN.md` R0 gate. It is a read-only investigation result. It does not authorize product code, MCP, UI, or production Vault migration.

## Decision

R0 found no defensible mutable-state duplication pilot. The three strongest candidates are already separated as canonical plan, projection/navigation, receipt, and dated evidence. Treating those relationships as duplicate sources of truth would damage the existing ownership contract.

Therefore:

- R0 is complete as an inventory and falsification gate.
- R1 is **not authorized** because no bounded state proposition and canonical owner candidate were established.
- State Packet remains a research hypothesis. It must prove decision/stopping value beyond `fetch + build_context + human judgment` before implementation.
- Resume only with one user-selected project and one explicit mutable state proposition, not one owner for an entire project.

## Frozen truth boundary

Observed 2026-08-23 JST:

| Layer | Current evidence | Interpretation |
|---|---|---|
| Repository | `main`, HEAD `5a9443d93840bb970ae34ea76a618bef1f1fce6c`, dirty worktree | Current working source; not installed proof |
| Working-source fingerprint | 1,070 files, SHA-256 `ca5a25827319c660f251e74f6884c727ed5bb705413ae5f57131020c6590ee13` | Current read-only snapshot; receipt file excluded |
| Production receipt | `installed-and-verified`, v0.5.0, verified 2026-08-21; 1,065 files, digest `5f5a2d56...` | Historical installed acceptance for that snapshot |
| Active MCP at R0 entry | v0.5.0, direct, `stale_runtime:false` | Running MCP was internally fresh before the repository MCP check rebuilt the bundle |
| Delivery info | `mismatch` | Working source differs from the latest verified receipt |
| R0 PLAN hash | SHA-256 `D5422A79C3D8F6325498FE0A1C0A637753F8BE9BADEB759AC666D10DD2FA29BB` before this closeout | Plan input used by the investigation |

SemVer, HEAD, dirty state, installed application, MCP freshness, and delivery match are separate facts.

## Existing capability and responsibility map

| Area | Existing responsibility | Evidence | R0 boundary |
|---|---|---|---|
| Context Compiler | Snapshot index, outgoing/backlinks, temporal descriptors, query-aware context and omissions | `src/core/context.ts:175-234`; `tests/context.test.ts` | Selects evidence; does not determine semantic current state or owner |
| Temporal | Current/historical/future/review-due evaluation and timeline | `src/core/temporal.ts:280-350`, `409-420`; `tests/temporal.test.ts` | Evaluates time; does not decide evidence strength or a state transition |
| Full update | Revision-checked single-note replacement | `src/mcp/service.ts:846-893` | Reusable commit primitive, not a transition decision |
| Autonomous update | Exact-content no-op, provenance and AI history | `src/mcp/service.ts:895-994`; `tests/mcp-service.test.ts:1197-1208`, `1285-1317` | No semantic no-op guarantee |
| Patch | Up to 20 exact operations applied atomically in memory before save | `src/mcp/service.ts:996-1084`; `tests/mcp-service.test.ts:539-579` | Reusable delta primitive, not owner/state semantics |
| Revision | SHA-256 over root, path, mtime, size, and content | `src/mcp/service.ts:307-319` | Proposal must carry the base revision |
| Review proposal | Vault-external pending proposal with approval-time revision check | `src/mcp/review-proposals.ts:69-105`; `tests/mcp-service.test.ts:1077-1195` | Reusable review primitive; no multi-note transaction |
| AI history | Previous body, reason, refs, and revision | `src/mcp/service.ts:1332-1363` | Audit/recovery only; not current-state truth |
| Atomic save | Temporary file, pre-rename stat check, rename | `src/main/vault.ts:929-991`; `tests/vault.atomic.test.ts:83-135` | Single-note commit; final race check is mtime/size, not content hash |
| Runtime guard | Rejects mutations when the MCP bundle is stale | `src/mcp/server.ts:180-215`; stale guard evaluator | Does not prove source equals installed production |
| Production gate | Running-app refusal, tests, package/installed hashes, profile preservation, MCP registration, receipt | `scripts/update-production.mjs`; production receipt | Required only for shipped product-code milestones |

Actual write path:

```text
MCP handler
  -> VaultMcpService update / autonomous update / patch
  -> revision and protected-path checks
  -> applyUpdateWithHistory
  -> VaultService.saveNote
  -> temporary file
  -> mtime/size recheck
  -> rename
```

## Public mutation surface and protection

The direct MCP exposes eight mutation operations:

1. `create_directory`
2. `create_note`
3. `update_note`
4. `autonomous_update_note`
5. `patch_note`
6. `apply_drive_sync`
7. `move_entry`
8. `add_link`

Catalog/handler evidence: `src/mcp/tool-catalog.json:12-22` and `src/mcp/server.ts:413-848`.

`40_情報源` and `50_履歴` are AI-immutable for ordinary mutations. `50_履歴` cannot be moved; material in `40_情報源` cannot be moved out of that protected area. User-configured Review paths are proposal-only or move-protected as applicable. Policy evidence: `src/shared/ai-write-policy.ts:3-38`; service guard: `src/mcp/service.ts:292-305`.

## Examined owner candidates

| Candidate | Classification | Owner result | Why it is not the pilot |
|---|---|---|---|
| `PLAN.md` / `PROJECT_STATUS.md` / TSUZUNE project and roadmap entries | PLAN = canonical execution order; others = current navigation/projection | `PLAN.md` for execution order | Intentional responsibility split, not duplicate mutable truth |
| `PROJECT_STATUS.md` / production receipt / production documentation | receipt = installed identity evidence; status/docs = projection/navigation | `docs/reports/production-update-latest.json` for the accepted snapshot | Already has a unique canonical receipt |
| PLAN/status summaries / dated X1-T1 acceptance report | report = dated evidence; PLAN/status = current classification | Evidence is immutable; current classification has its own owner | Completed evidence is not a mutable-state pilot |

Result:

```text
defensible duplicated mutable-state examples: 0
intentional projection/evidence examples: 3
pilot candidate: none
```

The inspection deliberately stopped at three candidates. No whole-Vault scan was performed.

## Alternatives compared

| Option | R0 result |
|---|---|
| Do nothing | Safe default while no real duplicate-state friction is evidenced |
| Document current full-content/patch operation | Already substantially complete in `docs/reports/differential-recording-system-design-2026-08-23.md` |
| Trial a transient State Packet | Only as a future read-only comparison against one explicit state proposition |
| Add DB/event sourcing/daemon/Hook | Rejected; no measured necessity and materially larger failure surface |

State Packet has distinct value only if it safely exposes an owner boundary, conflict, omission, temporal/freshness gap, or stop reason that the existing workflow misses, while not increasing correction or confirmation cost.

## Minimal R1 fixture brief — not yet authorized

If a bounded pilot is later supplied, use seven fixture notes only:

```text
00_entry/moc.md
01_canonical/current-state.md
02_evidence/supporting.md
02_evidence/contradicting.md
02_evidence/ambiguous.md
40_source/immutable.md
50_history/previous.md
```

Human-fixed oracle fields: state proposition boundary, owner, evidence role, source refs, observed/knowledge time, expected state, expected outcome, expected writes, expected warnings, initial/final tree digest.

Minimum cases:

1. Exact-content no-op.
2. Line-ending-only difference — outcome remains unknown until specified.
3. Meaning-equivalent wording — `NO_CHANGE` or `BLOCKED`, never automatic apply without an oracle.
4. Clear conclusion change — `PROPOSED`, write zero in read-only mode.
5. Approved single-owner update — `APPLIED`, one valid history relation.
6. New supporting evidence — oracle required.
7. Contradictory evidence — `BLOCKED`.
8. Ambiguous evidence — `BLOCKED`.
9. Two owner candidates — `BLOCKED(owner_ambiguous)`.
10. Missing owner — `BLOCKED(owner_missing)` and no automatic creation.
11. Stale revision — `CONFLICT`, tree unchanged.
12. Same mtime and size but changed content — conflict must be detected.
13. History created but canonical save fails — partial/orphan state must be explicit or rolled back.
14. Full rewrite drops an existing claim — `BLOCKED(data_loss_risk)`.
15. Protected source/history target — `BLOCKED`, tree unchanged.
16. Same evidence interpreted at project-level versus decision-level — state-proposition boundary must be fixed before owner selection.

For write-zero proof, compare recursive paths, bytes, SHA-256, mtimes, directories, history count, review proposal count, and sidecars before and after. For silent-omission detection, start with explicit fixture `claim_id` markers; do not pretend to solve general semantic preservation in R1.

## Verified baseline

| Check | Result |
|---|---|
| `git diff --check` | Error 0; existing LF/CRLF conversion warnings only |
| `npm run typecheck` | PASS |
| `npm test` | 75 files passed, 1 skipped; 770 tests passed, 1 skipped |
| `npm run check:mcp` | PASS; common 16/direct 18 tools; 10 read/8 write; delivery and stale-guard evaluators PASS |
| Production update | Not run; R0 is documentation/research only and the binary is unchanged |

`npm run test:production` was not repeated because it runs the same Vitest corpus with two workers and R0 changed no product code. The single-worker suite is the more conservative dirty-worktree baseline. It remains mandatory at a product-code production gate.

### Post-verification runtime and TSUZUNE sync boundary

`npm run check:mcp` rebuilt the repository MCP bundle. The already-running MCP process then correctly changed from `stale_runtime:false` to `stale_runtime:true`, and the first execution-record creation was rejected with `STALE_RUNTIME_WRITE_BLOCKED`. The guard was not bypassed.

After the user restarted Codex, the MCP reported `stale_runtime:false`. The following production TSUZUNE synchronization then completed:

- created and read back `30_知識/TSUZUNE-現在状態コンパイラR0-Baseline・Pilot選定-実施記録-2026-08-23.md`;
- updated `30_知識/TSUZUNE開発ロードマップ.md` from R0 Next to R0 Complete / R1 Held;
- updated `10_プロジェクト/TSUZUNE.md` with the same current decision;
- unique-title search returned one record and backlinks resolved from both the project entry and roadmap.

Delivery remains `mismatch`; documentation synchronization is not installed-production equivalence.

## Known unknowns and stop conditions

- No real mutable-state duplication example has been established.
- No state proposition boundary, owner, evidence triplet, and MOC set has been user-selected.
- Meaning-equivalent no-op and supporting-evidence outcomes lack a fixed oracle.
- History-before-save failure behavior is not contractually resolved.
- Same-mtime/same-size external content replacement is not proven safe at the final save boundary.
- State Packet may only reformat existing Context and increase review burden.

These unknowns make R1 a NO-GO under the current PLAN kill criteria. Resume requires a bounded candidate; research completion or an empty queue is not a reason to invent one.
