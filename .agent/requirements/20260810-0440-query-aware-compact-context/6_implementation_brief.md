# Query-aware Compact Context Implementation Brief

## Authorization Boundary
X1-M1 MOC Title Routerはcommit `601b94e`としてインストール済み本番へ反映済みである。X1-D0の設計後、R1〜R3だけをX1-D1として実装する認可を得た。X1-T1 structured-only transportは未認可・未着手であり、現行のlegacy text＋structured envelopeを維持する。

## Implemented X1-M1 Surface
- `src/core/context.ts`: valid `type: moc`判定、canonical Wiki title projection、MOC起点の通常outgoing／backlink本文展開停止。
- `tests/context.test.ts`: explicit判定、通常ノート互換、Path Alias重複、linked MOC、malformed frontmatter、時間省略、snapshot parity。
- `tests/mcp-service.test.ts`: 既存`build_context`入口でタイトル索引だけを返すservice contract。
- インストール済み本番Vault比較: 15,000文字から1,130文字。model-visible token削減は未計測。

## Existing Patterns To Reuse
- `src/core/context.ts`: `queryScore`、temporal selection、source fence、hard character budget。
- `src/mcp/service.ts`: `BuildContextOptions`と`buildContext`の単一入口。
- `src/mcp/server.ts`: `build_context` input/output schemaとtool registration。
- `tests/context.test.ts`: query ranking、budget、temporal safety、snapshot parity。
- `tests/mcp-service.test.ts`: MCP serviceのfetch／backlink／context contract。
- [既存benchmark](../../../docs/reports/tsuzune-with-without-benchmark-2026-08-09.md): 固定4問、期待source、品質とlatencyのbaseline。

## X1-D1 Touch Points
- `src/mcp/server.ts`: optional、trim済み、最大500文字の`query`。
- `src/mcp/service.ts`: `BuildContextOptions.query`とcoreへの伝播。
- `src/core/context.ts`: baseline quotaを先に固定し、通常候補本文だけをqueryで安定優先。見送ったcandidate IDは`omitted_ids`へ保持。
- `tests/context.test.ts`、`tests/mcp-service.test.ts`、`scripts/check-mcp.mjs`。
- `docs/mcp-integration.md`、`PLAN.md`、`PROJECT_STATUS.md`。

## Deferred X1-T1 Touch Points
- `build_context`専用structured result helperと`content: []`。
- 実stdio、Codex／ChatGPT Desktop、serialized bytesの独立検証。

## Suggested Delivery Order
1. 現行resultのMarkdown／structured／JSON-RPC相当bytesを固定fixtureで測定する。
2. optional `query`をserver→service→coreへ通し、query無しのstructured output互換をtestで固定する。
3. query有無でcandidate ID集合が変わらないことを先に固定し、queryは本文展開順にだけ使う。
4. 同義語、略称、日英表記差、抽象タイトル、橋渡しノートを含むrecall fixtureと、2k／4k／6k／8k／15k sweepを実行する。
5. quality gateを通った最小budgetだけを候補にし、見送ったcandidate IDがすべて追加取得可能であることを確認する。
6. 独立したX1-T1で`build_context`だけstructured-onlyにし、実stdioとCodex／ChatGPT Desktopを確認する。
7. quality、bytes、latency、Vault不変をreport化し、PASSした範囲だけ既定運用へ反映する。

## Implementation Notes
- query tokenizationとscore計算は既存関数を使う。別rankerを作らない。
- score 0は削除条件にしない。query無しbaseline候補の本文を収録しない場合は、そのIDを`omitted_ids`へ残す。
- temporal候補のquery filteringは行わない。
- query無しでは現在のcandidate selection／allocator pathを通し、挙動差を作らない。
- query本文はbounded Markdownへ再掲せず、選定入力としてだけ使う。
- MOC全タイトルのsemantic filtering、固定top-k、別ranker、pagination基盤は追加しない。現行最大MOCがhard capを超えた実測後にだけpaginationを別設計する。
- structured-only helperは`build_context`登録の近くに置き、汎用response profileやlegacy flagを作らない。実利用clientの破損が確認された場合だけ互換策を再設計する。
- token数は推定しない。characters、UTF-8 bytes、serialized bytesを正本にする。

## Test Plan
- Core: query無し完全互換、query match本文優先、candidate集合不変、score 0保持、stable tie、no-match、MOC全タイトル順、最大500文字queryでの予算保護、budget sweep、closed fence、temporal warning保持。
- Service: query伝播、canonical alias ID、as-of／knowledge-time併用。
- Server: schema max 500、query伝播、501文字拒否、既存legacy text＋structured envelope不変。
- Benchmark: adversarial recall 100%、silent omission 0、4/4、3/3、future leak 0、50% context chars target、45% wire bytes target、p95 <=10% regression。
- Safety: 本番Vault read-only fingerprint、typecheck、full tests、MCP smoke、diff check。

## Stop Conditions
- query有無でcandidate ID集合が変わる実装を既定化しない。
- expected-source reachability、MOC全タイトル順、Temporal／provenance／warningのgateを一つでも落としたら停止する。
- quality gateを落としたbudgetを既定にしない。
- structured-onlyを実clientが扱えなければtransport変更を止める。
- 50%文字削減を満たさない場合も、同じsliceでembedding、要約、multi-seed APIへ広げない。結果を記録してGraph Trackへ戻る。
