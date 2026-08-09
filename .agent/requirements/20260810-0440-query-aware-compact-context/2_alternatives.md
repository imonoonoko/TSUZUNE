# Query-aware Compact Context Alternatives

## A. `max_chars`だけを6,000へ下げる

### Merits
- 実装変更がない。
- hard capは確実に小さくなる。

### Problems
- 実probeでは15,000文字と同じ11ノートが選ばれ、11件すべてが断片化した。
- 質問と無関係な候補を除けない。

### Decision
Rejected。暫定的な手動操作には使えるが、製品の既定解にはしない。

## B. MCPへ`query`だけを渡す

### Merits
- coreの既存rankingを再利用できる。
- additiveな入力であり、query無しのcore挙動を維持できる。

### Problems
- 現行rankingはscore 0の候補も後ろへ並べるだけで、候補数と最終文字数は減らない。
- max-min allocatorによる全件断片化は残る。

### Decision
Necessary but insufficient。選定と予算処理を合わせて使う。

## C. Query-aware selection + drop-before-fragment + structured-only transport

### Merits
- 既存keyword ranking、時間評価、source fence、hard capを再利用できる。
- 質問に一致しない通常候補を選定前に外せる。
- 小予算では低順位候補を落とし、全候補の細切れを避けられる。
- `build_context`だけの重複payloadを除き、wire bytesを約半分にできる。

### Costs And Risks
- 外部MCP clientが`content[0].text`のJSONを直接parseしている場合は互換境界になる。
- queryが広すぎる場合は候補が多く残る。
- wire削減とmodel token削減は同一ではなく、host-level計測が必要。

### Decision
Selected。新依存なしで原因へ直接作用する最小案。

## D. LLM要約・query中心excerpt

### Merits
- 長いノートの中央にある関連箇所だけを短くできる可能性がある。

### Problems
- 要約の再現性、誤省略、追加latency、model依存が増える。
- 原文と根拠の対応検証が難しくなる。

### Decision
Deferred。Cの固定評価で不足が測定された場合だけ独立sliceにする。

## E. Embedding、vector DB、GraphRAG、独自DB

### Merits
- 語彙が一致しない関連候補を探せる可能性がある。

### Problems
- 現在の問題は既存候補の絞り込みと二重搬送であり、新しい検索基盤は不要。
- indexing、更新、依存、障害点が増える。

### Decision
Rejected for this track。固定keyword方式の失敗例が蓄積するまで導入しない。

## F. 複数seed bundleの横断dedupe

### Merits
- benchmarkや複数projectを同時に扱う会話で重複本文を減らせる。
- 現行3-seed成果物では33,436文字中4,176文字、12.5%がbundle間で重複しており、実測可能な改善余地がある。

### Problems
- 現行MCPは単一seed toolで、まず1回のtool resultを直す方が小さい。
- orchestration側の責務とMCP coreの責務を混ぜる。

### Decision
Deferred。Cの後も固定multi-seed課題が目標を超えた場合だけ再開する。

## G. 外部の永続コード構造グラフ（Ix）

### Merits
- Tree-sitterでsymbol、call、importなどを永続グラフ化し、`explain`、`impact`、`trace`のような限定質問から必要なコードだけを読む思想は、AIが毎sessionで同じrepositoryを再走査する問題へ直接作用する。
- 「先に構造地図を見る、必要なsourceだけ読む、変更後に地図を更新する」という運用は、将来のコード用Context Compilerを評価する比較対象になる。

### Problems
- 今回の膨張原因はTSUZUNE noteの候補選定、全件断片化、MCP二重搬送であり、code symbol graphを追加しても直接は解消しない。
- 現行Ixはalphaで、Node.js 22、Docker、ArangoDB、Memory Layerの常駐とindex更新を必要とする。公開CLIはApache-2.0だが、Memory Layerは非公開sourceから生成された配布JARである。
- 公式Composeはlocalhost限定だが認証なしのArangoDBと可変`latest` Memory Layer imageを使うため、再現性と供給網を別途固定しなければならない。
- Windows installer、Codex installer、MCP version互換に未解決issueがあり、TSUZUNEへ今組み込むと別の運用基盤と障害点が増える。
- 公称token削減率はvendor claimであり、TSUZUNEの固定corpus、host、質問、品質gateで再現した値ではない。

### Decision
Rejected for X1-D0 implementation。思想とquery形だけを比較対象として保存し、依存、Docker service、hook、MCP、自動index更新は追加しない。repository再読込やimpact調査の無駄が固定benchmarkで観測された場合だけ、1 repository・manual command・hookなしの隔離比較を別sliceで行う。

### Primary Sources Reviewed
- [Ix README](https://github.com/ix-infrastructure/Ix#readme)
- [Standalone Docker configuration](https://github.com/ix-infrastructure/Ix/blob/main/docker-compose.standalone.yml)
- [Ix Memory Layer distribution](https://github.com/ix-infrastructure/ix-memory-layer-dist)
- [Windows path issue #349](https://github.com/ix-infrastructure/Ix/issues/349)
- [Codex PowerShell installer issue #350](https://github.com/ix-infrastructure/Ix/issues/350)
- [Codex MCP compatibility issue #351](https://github.com/ix-infrastructure/Ix/issues/351)
