# Executable Policy Pilot 1 — Read-only MCP Integrity

更新日: 2026-08-26
状態: source-and-fixture-verified

## 結論

文章で繰り返し注意する代わりに、既存の`check:mcp`へ一つの実行可能ポリシーを追加した。MCPが`readOnlyHint: true`で公開する全ツールを実際に呼び、呼出し前後で通常Vault領域と隔離profileのtree fingerprintが同一であることを検査する。公開read-only toolの宣言集合と実行集合も完全一致させるため、新しいread-only toolを追加してcheckへの接続を忘れた場合はfail closedになる。

このPilotは製品runtime、MCP tool本体、公開schemaを変更しない。新しいHook、daemon、DB、cache、packageも追加せず、Workflow Verification Harness Phase 1の既存`mcp` checkからそのまま実行される。

## 採用した不変条件

> 宣言済みread-only MCP toolは、通常Vault内容と指定profileを変更してはならず、全toolが同じ検査経路を通らなければならない。

保護範囲は次のとおり。

- Vault root以下のdirectory、file、symlink。ただし既存内部metadata subtreeの`.tsuzune`を除く。
- check専用の隔離profile全体。
- fileはsize、mtime、SHA-256、directoryとsymlinkはtype、mtime、targetを含む。
- root directory自体も含めてdirectory mtime差を検査する。取得した全fieldを完全に元へ戻す変更は対象外とする。

## 候補比較

広い`src`静的検査で「Vaultへの直接書込み禁止」を強制する案は不採用とした。`VaultService`の正規writer以外にもsettings、journal、proposal、history、CLI prototypeなど目的の異なる正当なwriterがあり、import graphと例外列挙を増やさないと誤検知を避けられないためである。

採用案は、既に全MCP toolを公開動作で呼ぶ`check:mcp`へbefore／after検査を重ねるだけで、実際の処理経路と公開宣言を直接検証できる。新しい検査frameworkは作らず、小さなsnapshot helperとfixture testだけを追加した。

## TDDと検証証拠

1. `tests/mcp-readonly-integrity.test.ts`から未実装moduleを参照し、module不在でREDを確認した。
2. 最小snapshot helperを追加し、通常Vault変更とprofile変更のfixtureをGREENにした。
3. `.tsuzune`の明示除外fixtureを先に追加し、未対応でREDを確認してから最小のsubtree除外を実装した。
4. 公開read-only toolの宣言集合から一件を欠かしたfixtureがfail closedになることを確認した。
5. `check:mcp`へ接続した初回、`search`による`.tsuzune/graph-file-times.json`修復を実際に検出した。既存仕様と回帰testを確認し、通常Vault内容の保護と内部台帳の既存修復を分離した。

実行結果:

- `npx vitest run tests/mcp-readonly-integrity.test.ts tests/workflow-harness.test.ts tests/current-decision-docs.test.ts --maxWorkers=1` — 3 files / 10 tests PASS。
- `npm run typecheck` — PASS。
- `npm run check:mcp` — PASS。公開read-only 10件とwrite 8件の既存smokeを維持。
- `npm run check:workflow -- --task executable-policy-pilot-1 --checks current-decision,typecheck,test,mcp` — 4/4 PASS、source fingerprint不変、`delivery_before`／`delivery_after`ともに`mismatch`。proof layerは`source-and-fixture`で、packaged／installed／live／user-acceptance／token／billingは`not_proven`。
- 独立Ponytail review — `Lean already. Ship.`。追加の正しさ、過剰実装、誤検知、見逃しに関するactionable findingなし。cold repairと完全復元された瞬間的変更は残余境界として維持。

## 明示した境界

`.tsuzune/graph-file-times.json`は、欠損、破損、非canonical状態なら`scan()`が修復する既存内部台帳である。安定状態の二度目以降に再書込みしないことは[X1-S1a](x1-s1a-creation-time-sidecar-noop-2026-08-11.md)が別に検証している。このため本Pilotは「環境全体のzero write」を主張せず、通常ノート領域と隔離profileの不変性を保証対象にする。

MCP schema上の`readOnlyHint`は環境を変更しないという宣言であり、内部台帳のcold repairまで字義通りに合わせるには製品コードの別sliceが必要である。候補はMCP snapshotだけでregistryを永続化しないscan経路だが、`createdAt`の意味とGraph側のrepair契約を保つ設計・回帰・production updateが必要になる。今回は認可された「製品挙動を変えない」境界を守り、実装Primaryへ自動昇格しない。

## 変更artifact

- `scripts/mcp-readonly-integrity.mjs` — tree snapshot、mutation assertion、read-only tool完全coverage。
- `tests/mcp-readonly-integrity.test.ts` — no mutation、Vault/profile mutation、明示除外、coverage欠落のfixture。
- `scripts/check-mcp.mjs` — 隔離profile、全read-only callのintegrity gate、宣言集合との完全一致。
- `PLAN.md`、`PROJECT_STATUS.md`、`docs/INDEX.md` — 現在状態とEvidence導線。

## 停止線

- 新しいproduct runtime、Hook、daemon、DB、cache、dependencyは作らない。
- `.tsuzune` cold repairを無断で製品変更しない。
- source／fixture PASSをpackaged、installed、active MCP、production Vault確認へ昇格しない。
- 次は通常開発で既存Harnessを使う。literalなread-only環境不変が製品要件として選択された場合だけ、別Task Contractでno-persist scanを検討する。

## 関連

- [Workflow Verification Harness Phase 1](workflow-verification-harness-phase1-plan-2026-08-26.md)
- [X1-S1a Creation-time Sidecar No-op](x1-s1a-creation-time-sidecar-noop-2026-08-11.md)
- [MCP schema](https://modelcontextprotocol.io/specification/2025-11-25/schema)
