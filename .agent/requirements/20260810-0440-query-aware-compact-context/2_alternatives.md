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
- 現行rankingは本文の展開順を変えられるが、それだけでは候補数と最終文字数は減らない。
- max-min allocatorによる全件断片化は残る。
- score 0を削除条件にすると、語彙が一致しない必要sourceを落とす。

### Decision
Useful but insufficient。queryは本文展開の優先順にだけ使い、candidate削除のgateにはしない。

## C. Recall-safe progressive disclosure

### Merits
- 既存keyword ranking、時間評価、source fence、hard capを再利用できる。
- MOCの全タイトルとquery無しbaselineの通常候補集合を維持する。
- queryは本文を先に展開する順番にだけ使い、語彙不一致を削除理由にしない。
- 小予算では低順位候補の本文を見送り、IDと追加取得導線を残すことで全候補の細切れを避けられる。
- 新しい検索基盤や依存を増やさない。

### Costs And Risks
- route用IDとmetadataの分だけ文字数は残る。
- baseline candidate set自体のrecallは改善しない。少なくとも現行より悪化させない設計である。
- query優先順が回答品質を改善するかは、反例を含む固定corpusで評価が必要である。

### Decision
Selected。候補を消さず、本文展開だけを段階化する最小案。

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

## H. `build_context`のstructured-only transport

### Merits
- sourceの選定や本文を変えず、同じobjectのtext JSON／`structuredContent`二重搬送だけを除ける。
- 実測ではJSON-RPC相当wire bytesを約半分にできる余地がある。

### Costs And Risks
- 外部MCP clientが`content[0].text`のJSONを直接parseしている場合は互換境界になる。
- wire削減とmodel-visible token削減は同一ではなく、host-level計測が必要である。

### Decision
Selected as independent X1-T1。実Codex／ChatGPT Desktop gateに通った場合だけ適用し、Recall-safe selectionとは別にrollbackできるようにする。

### Primary Sources Reviewed
- [Ix README](https://github.com/ix-infrastructure/Ix#readme)
- [Standalone Docker configuration](https://github.com/ix-infrastructure/Ix/blob/main/docker-compose.standalone.yml)
- [Ix Memory Layer distribution](https://github.com/ix-infrastructure/ix-memory-layer-dist)
- [Windows path issue #349](https://github.com/ix-infrastructure/Ix/issues/349)
- [Codex PowerShell installer issue #350](https://github.com/ix-infrastructure/Ix/issues/350)
- [Codex MCP compatibility issue #351](https://github.com/ix-infrastructure/Ix/issues/351)
