# Test suite delta

## Reconciliation

| Checkpoint | Test files | Tests |
|---|---:|---:|
| 履歴廃止前の記録 | 94 pass / 1 skip | 912 pass / 1 skip |
| 履歴廃止後のproduction verification | 91 pass / 1 skip | 867 pass / 1 skip |
| Inbox capture追加後のcurrent run | 91 pass / 1 skip | 868 pass / 1 skip |

差分は意図した履歴廃止とInbox test一件で説明でき、production receipt以後の既存suite消失はない。

## Exact arithmetic

履歴廃止で削除された3 test filesは、Vitest上で合計45 casesを持っていた。

- `tests/history-compaction-preview.test.ts`: 4
- `tests/history-store-v2-shadow.test.ts`: 15
- `tests/history-store-v2.test.ts`: 26
  - plain casesに加え、`it.each`のmatrixが5、3、3 casesを展開する。

同じ変更で`tests/mcp-service.test.ts`のexplicit history backlink caseを1件削除し、`tests/entry-move.test.ts`へno-history regressionを1件追加したため、この二件は相殺する。

したがって `912 - 45 = 867`。Inbox captureのapp safety test一件を加えて `867 + 1 = 868` となる。file数も履歴test file 3件の削除で `94 - 3 = 91` である。

## Parent correction

Subagentの初回報告は`it.each`を一つの宣言として数え、削除casesを34としたため不採用とした。matrix展開とcurrent Vitest outputを親が再確認した。

## Coverage boundary

- current `npm test`: PASS、91 files pass / 1 skip、868 tests pass / 1 skip
- 新しい`.skip`またはVitest exclusion変更: 観測なし
- production receipt後: Inbox testが1件増え、既存testの減少なし
- 旧history implementationのtest削除は、製品から同機能を廃止した契約と一致する
