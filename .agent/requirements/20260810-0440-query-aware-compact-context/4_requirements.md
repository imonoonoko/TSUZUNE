# Query-aware Compact Context Requirements

## 1. Overview
TSUZUNEの`build_context`を、単に上限まで本文を詰めるtoolから、到達可能な根拠を残したまま必要な本文を段階的に展開するtoolへ更新する。既存のkeyword ranking、Wiki graph、temporal evaluation、provenanceを再利用する。MCP二重搬送はsource recallと分離したX1-T1で狭く解消する。

X1-D0は本書を固定した設計checkpointである。その後の明示指示により、R1〜R3だけをX1-D1 Recall-safe Query Bridgeとして実装する。R4のstructured-only transportは独立したX1-T1へ延期する。

X1-M1 MOC Title Routerは先行して本番反映済みであり、X1-D1でも全タイトルと記述順を変更しない。

X1-D1はcommit `e2d8621`としてpushし、2026-08-10 14:03 JSTにインストール済み本番へ反映した。X1-T1と固定4問の再評価は未完了のまま分離する。

## 2. Installed Baseline Before X1-D1
- 既定の`max_chars`は15,000。
- 起点1件、outgoing最大5件、backlink最大3件、temporal最大5件を候補にする。
- coreは任意`query`でoutgoing／backlinkを順位付けできる。
- MCP public inputは`query`を持たず、coreのrankingへ質問文を渡せない。
- max-min allocatorは選定済み全候補へ文字予算を均等配分する。
- MCP resultは同じobjectをtext JSONと`structuredContent`へ二重格納する。
- 現行3-seed成果物33,436文字には4,176文字、12.5%のbundle間重複がある。ただし単一`build_context`の選定改善とは責務を分ける。

## 3. Functional Requirements

### R0. MOC Title Router — X1-M1
- valid frontmatterのscalar `type`が完全に`moc`であるノートだけをMOCと判定する。
- `build_context`のMOC本文は、Wiki linkを記述順に並べたタイトル索引へ投影する。Vault原本と`fetch`結果は変更しない。
- 解決済みlinkはcanonical pathを使い、Path Alias後の重複を1件へまとめる。未解決linkは探索候補として残し、invalid linkは出力しない。
- MOC起点では通常のoutgoing／backlink本文を展開しない。MOCが通常ノートから選ばれた場合も、そのMOC本文は同じタイトル索引へ投影する。
- temporal候補、valid-time／knowledge-time、future情報の本文省略、warning、source fenceは既存契約を維持する。
- `type: moc`でない通常ノートは、名称やfolderが地図らしくても従来経路を維持する。
- queryによるタイトル絞り込み、自動MOC生成、保存済み利用回数、2-hop展開は非目標とする。

### R1. Optional Query Bridge
- `build_context`は任意`query`を受け取る。
- queryは前後空白を除き、最大500文字とする。
- query無しまたは空文字では、coreの候補順、Markdown、warning、structured fieldsを現行互換にする。
- queryはMCP server、serviceを経て既存`ContextBundleOptions.query`へそのまま渡す。
- query本文はContext Markdownへ重複掲載せず、最大500文字の入力自体がMOC、起点、Temporal、provenanceの文字予算を消費しない。

### R2. Query-guided Body Priority
- query無しで得られるoutgoing／backlink／temporal候補集合をbaseline候補集合とする。
- queryはbaseline内の通常候補について、本文を収録する優先順だけを既存`queryScore`で安定的に変更できる。
- score 0は語彙不一致を示すだけであり、候補除外の根拠にしない。
- 同じseed、Vault snapshot、時間条件では、query有無で候補ID集合を変えない。
- MOCタイトルの件数、内容、記述順はqueryで変更しない。
- 起点、temporal metadata、valid-time／knowledge-time、history、supersedes、review、warning、provenanceを維持する。

### R3. Body Budget Without Route Loss
- `max_chars`はheaderを含むhard capとする。
- query有りで予算に収まらない場合、低順位の通常候補は本文展開を見送り、全通常候補へ短い断片を均等配分しない。
- 起点とtemporal候補は通常候補より優先する。
- 本文を収録しないbaseline候補は`omitted_ids`へ残し、次の`fetch`または`build_context`で取得可能にする。
- `included[].path ∪ omitted_ids`はquery有無で同じ集合にする。
- 部分表示する場合は既存のtruncation markerと閉じたsource fenceを維持し、metadataを途中で切らない。
- 現行MOCタイトル索引がhard capを超えた場合は、意味的なtop-kで黙って削らず、明示的なtruncationと原本取得導線を返す。paginationは実測超過後の別sliceとする。
- `included`、`truncated`、`omitted_ids`、`selection_reasons`が実際の出力と矛盾しない。

### R4. Structured-only Build Context Transport
- `build_context`の正本出力は既存output schemaに一致する`structuredContent`とする。
- 実Codex／ChatGPT Desktop smokeが通る場合、`content`は空配列とし、同じobjectのpretty JSON複製を返さない。
- 他のMCP toolのresponse envelopeは変更しない。
- structured fields、Markdown、順序、時間警告はtransport変更前後で同じにする。
- 外部clientが`content[0].text`をparseしている可能性を互換境界として文書化する。実clientがstructured-onlyを扱えない場合はこの要件だけを適用しない。

### R5. Honest Measurement
- Context Markdown characters、UTF-8 bytes、JSON-RPC相当serialized bytesを別々に計測する。
- wire bytes削減をmodel token削減と呼ばない。
- model-visible tokenはhostが観測可能な場合だけ別指標として報告する。
- 同じ入力を2回実行し、candidate順、Markdown digest、serialized structured resultが決定的であることを確認する。

## 4. Acceptance Criteria

### Fixed Quality Gate
- 既存の固定4問で回答基準4/4を維持する。
- source tracing 3/3を維持する。
- future information leakは0件を維持する。
- review due、conflicting state、unresolved provenanceを含む既存warning fixtureの欠落を0件にする。
- query有無で`included[].path ∪ omitted_ids`の集合を一致させ、expected-source reachabilityを100%維持する。
- 同義語、略称、日英表記差、抽象タイトル、橋渡しノートのfixtureで、語彙score 0のexpected sourceを候補集合から消さない。
- MOCのresolved／unresolved有効linkはquery有無で同数・同順・重複なしとする。
- 最大500文字queryと小さいbudgetの組み合わせでも、query無しで収まるMOC全タイトル、起点、Temporal、provenanceをquery本文の再掲で押し出さない。

### Budget Sweep
- 2,000／4,000／6,000／8,000／15,000文字を同じcorpusと質問で比較する。
- 各budgetでcharacter capを超えない。
- 各source fenceは閉じ、metadata途中切れを起こさない。
- 6,000文字で現行のように同じ11件すべてを断片化せず、見送った本文のcandidate IDを失わない。
- 品質gateを満たす最小budgetだけをcompact既定候補とする。満たさなければ既定値を変更しない。
- 公開済みbenchmarkの固定課題合計33,412文字をbaselineとして50%以上減らす。未達ならmulti-seed dedupeまたはexcerptを次の別設計候補として記録し、このsliceで追加実装しない。

### Transport Gate
- 実stdio resultでoutput schemaに合う`structuredContent`を返す。
- structured-only時の`content`は空配列である。
- 同じstructured resultをpretty JSONでも返すlegacy hypothetical frameと比べ、serialized UTF-8 bytesを45%以上削減する。
- Codex／ChatGPT Desktopでtool resultを利用した回答とsource表示を確認する。失敗した場合はtransport変更だけをrollbackし、Recall-safe candidate集合を維持する。

### Performance And Safety
- 同じ実行経路・同じcorpusで、Context構築p95の退行を10%以内にする。
- 新依存、DB、network、background processを追加しない。
- 本番Vaultのbefore／after fingerprintを一致させ、Markdown write、sidecar write、Drive operationを0件にする。
- `npm run typecheck`、`npm test`、`npm run check:mcp`、`git diff --check`をPASSする。

## 5. User-facing Operational Contract
- 関連MOCがある場合は全タイトル索引を最初のrouteとして使い、選んだノート本文を次の`fetch`または`build_context`で読む。
- 質問がある場合、AI clientは起点IDと質問文を`query`へ渡してよいが、queryに一致しないrouteを不存在とみなさない。
- `search`上位数件だけを唯一の候補集合にせず、根拠が不足した場合はMOCまたは`omitted_ids`へ戻って追加取得する。
- MOCは探索の地図であり、全リンク先本文を一括投入する命令ではない。mirrorは原典確認が必要な場合だけ読む。
- queryがない探索・監査では、明示した`max_chars`と現行の広いContextを利用できる。

## 6. Non-goals
- AIがノート本文を要約して置換すること。
- 長期的な利用回数や忘却scoreを保存すること。
- 語彙不一致をembeddingで解決すること。
- query score 0、固定top-k、LLM／embedding rankerを候補到達性の単独gateにすること。
- MOC全タイトル索引をAI要約で置き換えること。
- Context Compiler 2.0全体、GraphRAG、独自DBを完成扱いすること。
- Ixなど外部code graph、Docker、ArangoDB、非公開Memory Layer、Codex hook、別MCPを導入すること。

## 7. Open Questions
- top-ranked normal sourceの部分表示を許すか、次に短い全文sourceを優先するかはbudget sweepで決める。
- compact既定budgetは固定値を先に決めず、quality gateを通った最小値で決める。
- multi-seed重複が50%文字削減を妨げた場合、dedupeをMCPではなく呼び出し側へ置くかを次設計で決める。

## 8. External Code Map Evaluation Gate
- Ixはコード構造の再読込を減らす比較候補であり、TSUZUNE note Contextの選定器ではない。X1-D0へ依存として追加しない。
- 再検討条件は、同一repositoryの構造を複数sessionで繰り返し読む、impact／traceの見落としが起きる、または現行のsource読込量が固定課題で過大と測定されることとする。
- 比較する場合も、最初は1つの隔離repository、manual command、hookなし、Codex MCPなし、自動refreshなしに限定する。
- 秘密のないfixtureだけを使い、release／image digestを固定し、loopback以外の通信がないことを観測し、試験後は専用volumeまで破棄する。
- `explain`、`impact`、`trace`相当の3課題で、正答、根拠source、読んだfile数、Context／wire bytes、latency、初回index時間、更新時間、停止／復旧手順をbaselineと比較する。
- vendorのtoken削減率は受入根拠にせず、同一fixtureと同一hostで測定した値だけを使う。
- 品質またはsource読込量の改善が、Docker、ArangoDB、index鮮度管理、非公開sourceのMemory Layerという負担を上回らなければ導入しない。
