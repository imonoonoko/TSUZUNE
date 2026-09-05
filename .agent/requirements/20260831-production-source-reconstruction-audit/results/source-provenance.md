# Source provenance and production boundary

## Conclusion

Current source全体をlatest installed productionと同一とは証明できない。receiptはdirty source全体のaggregate fingerprintだけを保持し、path/hash manifestまたはexact snapshotを保持していないためである。

一方、installed bundleとreceipt後のfile時刻を組み合わせると、挙動境界は次まで狭められる。

- installed productionは通常更新の履歴生成停止とCalendar hostを含む。
- installed rendererはInbox commandを含まない。
- receipt以後に更新されたGit管理対象／未追跡対象26 filesのうち、runtime sourceは`src/renderer/App.tsx`だけ、test sourceは`tests/app.safety.test.tsx`だけだった。残りはvideo raw、workflow evidence、README／MCP説明、PLAN／statusである。
- ただしmtimeとcompiled bundleはexact TypeScript snapshotの代替ではないため、current treeをproduction-equivalentと断定しない。

## Receipt and live runtime

- receipt: `docs/reports/production-update-latest.json`
- verified: `2026-08-31T04:33:41.574Z`
- status: `installed-and-verified`
- Git commit: `922d46858c963bbe6bf3be8b4af4b803bc113bc9`
- dirty source: `true`
- fingerprint: 1,316 files / `f36f4b9076fe9af458dad7635c77e0c432f87ce49e0fdf492e0270b559294ba5`
- live MCP: version `0.6.0`, profile `direct`, `stale_runtime:false`, `delivery_info:mismatch`

## Installed bundle probe

Read-onlyでinstalled `app.asar`のcompiled outputを確認した。

| Installed output | Probe | Result | Interpretation |
|---|---|---:|---|
| renderer | `受信箱へメモを作成` | false | Inbox commandは未反映 |
| renderer | `inbox-note` | false | Inbox commandは未反映 |
| MCP | `include_history` | false | 旧history input contractなし |
| MCP | `history_path` | false | 旧history output contractなし |
| main | `calendar-plugin-host` | true | Calendar hostは反映済み |

Compiled stringの有無は挙動境界の証拠であり、元source全体の復元証拠ではない。

## Working-tree groups

Audit snapshotはporcelain 145 entries、tracked changed paths 84、untracked files 214、unmerged 0だった。

| Group | Receipt inclusion | Current verification | Boundary |
|---|---|---|---|
| 履歴機能廃止 | high / installed behavior confirmed | post-removal 867 tests、installed MCP strings、live stale false | exact per-path source hashesなし |
| Calendar／Obsidian plugin／workspace UI | partial installed behavior confirmed | installed Calendar host marker、pre-receipt evidence | 全UI sourceのexact receipt inclusionは未証明 |
| Inbox capture | not installed | focused 98/98、full 868/1 skip、typecheck、MCP check | source実装済み、本番未反映 |
| video raw／workflow evidence／docs | post-receipt or non-runtime | readable durable evidence | production behaviorへ直接影響しないがsource fingerprintには入る |
| current source whole tree | unknown exact equivalence | current checks may validate behavior | receipt snapshot欠落のためinstalled sourceと同一とは言えない |

## Strongest falsifier and decision

`scripts/source-fingerprint.mjs`はtracked＋untracked nonignored filesのpathとdigestを一つのaggregate digestへ畳み、receipt自身だけを除外する。receiptから個別path/hashを逆算できない。

したがって`HEAD + Inbox 4 hunks`は機能検証用にだけ使え、本番基底には使えない。既定判断はproduction mutationを行わず停止。昇格する場合はcurrent source全体への明示承認が必要である。
