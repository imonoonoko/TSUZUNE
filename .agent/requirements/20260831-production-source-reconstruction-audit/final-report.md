# Production source reconstruction audit — final report

## Outcome

Auditは完了した。Inbox captureはsource実装済み・本番未反映のまま維持し、current dirty source全体のproduction updateは実行していない。

Installed productionには履歴機能廃止とCalendar hostが入っている一方、Inbox commandは入っていない。receipt以後に更新されたruntime sourceは`src/renderer/App.tsx`だけだったが、latest dirty-source receiptにexact snapshotまたはpath/hash manifestがないため、current tree全体や`HEAD + Inbox 4 hunks`をverified production-equivalent baseとは認定しない。

既定判断は停止である。次にproductionへ進むには、利用者がcurrent source全体の昇格境界を明示承認する必要がある。

## Accepted

- source provenance: aggregate fingerprintの逆算不能、installed bundleのbehavior probe、receipt後26 filesの限定inventory。
- test delta: `912 -> 867 -> 868`を、履歴test 45件削除とInbox test 1件追加で再構成。
- original-philosophy guard: human-first Inbox、慎重なwrite、暗黙のwhole-tree promotion拒否。
- workflow improvement: functional hunk isolationとproduction baseを分けるroot `AGENTS.md` rule一件。

## Rejected or corrected

- `HEAD + Inbox 4 hunks`をproduction baseとする案: installed dirty-source機能を巻き戻す可能性があるため不採用。
- subagentの削除test 34件という集計: `it.each` matrix未展開のため不採用。親が45件へ訂正。
- snapshot欠落をmtimeまたはcompiled outputだけで埋める案: behavioral evidenceとしてだけ採用し、exact source identityとは扱わない。
- 新しいqueue、DB、daemon、常設agent role、workflow framework: 今回の一件に不要なため不採用。

## Agent integration

| Agent | Ownership | Result | Parent adoption |
|---|---|---|---|
| Hypatia / D8 | source provenance | whole-tree risk、aggregate receipt limitation | adopted |
| Pascal / D9 | test delta | delta location identified、case count error | partially adopted and corrected |
| Bernoulli / D7 | original-philosophy guard | no-op and stop criteria | adopted |
| Curie / D11 | workflow retrospective | one production-boundary rule | adopted |

Agentsはfileを変更していない。親が統合、未提示境界検証、正本更新を担当した。

## Changed artifacts

- `AGENTS.md`: dirty-source receipt時のfunctional isolation / production base分離rule。
- `PLAN.md`: broad reconstruction audit完了とcurrent production decision。
- `PROJECT_STATUS.md`: Inbox source／installed境界とdefault stop。
- `.agent/requirements/20260831-production-source-reconstruction-audit/`: Task Contract、agent packets、results、本report。

Product source、`knowledge.md`、legacy `50_履歴`、installed TSUZUNE、production Vaultは変更していない。

## Verification

- current `npm test`: PASS — 91 files passed / 1 skipped、868 tests passed / 1 skipped。
- `npm run typecheck`: PASS。
- `npm run check:mcp`: PASS。
- `npm run check:current-decision`: PASS。
- task-owned `git diff --check`: PASS。既存line-ending warningのみ。
- workflow artifacts: required files present、`state.json` parse PASS。
- live runtime: `0.6.0`、`stale_runtime:false`、`delivery_info:mismatch`。
- installed `app.asar` probe: Inbox markers absent、history contract markers absent、Calendar host marker present。

## Persistence and remaining boundary

Repository plan/statusへ最終判断を反映した。TSUZUNEはread-onlyで根幹思想と直近受入記録を確認し、production Vaultへの書戻しは行っていない。

Production update、install、process停止、Git branch/worktree/stash/reset/checkout/stage/commitは未実施。再開条件は利用者によるcurrent source whole treeのproduction昇格承認である。
