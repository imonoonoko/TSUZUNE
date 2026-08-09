# Query-aware Compact Context Implementation Brief

## Authorization Boundary
X1-D0のquery選定とtransportは次sliceの技術handoffであり、まだ実装を開始しない。別途明示されたX1-M1 MOC Title Routerだけは`src/core/context.ts`と既存testへ実装する。MCP tool schema、登録、本番アプリは変更しない。

## Implemented X1-M1 Surface
- `src/core/context.ts`: valid `type: moc`判定、canonical Wiki title projection、MOC起点の通常outgoing／backlink本文展開停止。
- `tests/context.test.ts`: explicit判定、通常ノート互換、Path Alias重複、linked MOC、malformed frontmatter、時間省略、snapshot parity。
- `tests/mcp-service.test.ts`: 既存`build_context`入口でタイトル索引だけを返すservice contract。
- 本番Vault比較: 15,000文字から1,132文字。model tokenと本番binary反映は未計測／未実施。

## Existing Patterns To Reuse
- `src/core/context.ts`: `queryScore`、`rankByQuery`、temporal selection、source fence、hard character budget。
- `src/mcp/service.ts`: `BuildContextOptions`と`buildContext`の単一入口。
- `src/mcp/server.ts`: `build_context` input/output schemaとtool registration。
- `tests/context.test.ts`: query ranking、budget、temporal safety、snapshot parity。
- `tests/mcp-service.test.ts`: MCP serviceのfetch／backlink／context contract。
- [既存benchmark](../../../docs/reports/tsuzune-with-without-benchmark-2026-08-09.md): 固定4問、期待source、品質とlatencyのbaseline。

## Smallest Likely Touch Points
- `src/mcp/server.ts`: optional `query`、build_context専用structured result helper。
- `src/mcp/service.ts`: `BuildContextOptions.query`とcoreへの伝播。
- `src/core/context.ts`: query有りのscore 0除外とdrop-before-fragment。
- `tests/context.test.ts`、`tests/mcp-service.test.ts`、MCP server contract test。
- 既存benchmark script／report。新しい汎用benchmark基盤は作らない。
- `docs/mcp-integration.md`、`PLAN.md`、`PROJECT_STATUS.md`。

## Suggested Delivery Order
1. 現行resultのMarkdown／structured／JSON-RPC相当bytesを固定fixtureで測定する。
2. optional `query`をserver→service→coreへ通し、query無しのstructured output互換をtestで固定する。
3. query有りだけscore 0通常候補を除き、低順位normalをdrop-before-fragmentにする。
4. 2k／4k／6k／8k／15k sweepと既存4問を実行し、最小passing budgetを決める。
5. `build_context`だけstructured-onlyにし、実stdioとCodex／ChatGPT Desktopを確認する。
6. quality、bytes、latency、Vault不変をreport化し、PASSした範囲だけ既定運用へ反映する。

## Implementation Notes
- query tokenizationとscore計算は既存関数を使う。別rankerを作らない。
- score 0候補は「選定対象外」であり、全pathを`omitted_ids`へ追加してresponseを再膨張させない。
- temporal候補のquery filteringは行わない。
- query無しでは現在のcandidate selection／allocator pathを通し、挙動差を作らない。
- structured-only helperは`build_context`登録の近くに置き、汎用response profileやlegacy flagを作らない。実利用clientの破損が確認された場合だけ互換策を再設計する。
- token数は推定しない。characters、UTF-8 bytes、serialized bytesを正本にする。

## Test Plan
- Core: query無し完全互換、query match優先、score 0除外、stable tie、no-match、budget sweep、closed fence、temporal warning保持。
- Service: query伝播、canonical alias ID、as-of／knowledge-time併用。
- Server: schema max 500、structuredContent valid、`content: []`、他tool envelope不変。
- Benchmark: 4/4、3/3、future leak 0、50% context chars target、45% wire bytes target、p95 <=10% regression。
- Safety: 本番Vault read-only fingerprint、typecheck、full tests、MCP smoke、diff check。

## Stop Conditions
- quality gateを落としたbudgetを既定にしない。
- structured-onlyを実clientが扱えなければtransport変更を止める。
- 50%文字削減を満たさない場合も、同じsliceでembedding、要約、multi-seed APIへ広げない。結果を記録してGraph Trackへ戻る。
