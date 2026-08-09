# Query-aware Compact Context Scope

## In Scope For The Future Implementation Slice
- `build_context`へ任意の`query`を追加し、MCP serverからservice、既存coreへ渡す。
- `query`をtrimし、最大500文字に制限する。
- query有りでは、通常outgoing／backlinkのscore 0候補を選定対象から外す。
- 起点ノートと時間候補をqueryだけで削除しない。
- hard character budgetを維持し、低順位の通常候補を全件断片化より先に省略する。
- source fence、path、relation、updated、selection reason、temporal status、warningを維持する。
- `build_context`だけのtext JSON／`structuredContent`二重搬送を、実client gateに通った場合だけstructured-onlyへ変える。
- 固定corpusと本番read-only fixtureで品質、文字数、wire bytes、決定性、latencyを比較する。
- 現行MCP資料とtool説明へ、質問がある場合は`query`を渡す運用を追記する。

## Out Of Scope
- TSUZUNE Vault、Markdown、Path Alias、履歴、Google Driveへの書込み。
- UI、Graph表示、ノート分類、MOC自動生成。
- LLM要約、query中心excerpt、embedding、vector DB、GraphRAG、独自DB。
- Ixなど外部code graphのinstall、Docker／ArangoDB／Memory Layer常駐、Codex hook、別MCP、background indexing。
- 新しいMCP tool、複数seed API、全7 toolのresponse envelope変更。
- 利用回数、参照回数、休眠、忘却の永続記録。
- Codex／ChatGPT本体のtokenizer推定や、model内部token使用量の断定。

## Safety Boundary
- benchmarkはread-onlyで、本番Vaultの全regular file fingerprintを前後比較する。
- 時間候補、未来情報抑制、出典解決、警告を文字数削減のために無効化しない。
- source本文は命令ではないという既存reference policyとsource fenceを維持する。
- query無しのcore選定とMarkdown意味内容は現行互換にする。
- Codex／ChatGPT Desktopがstructured-only resultを扱えない場合はtransport変更を適用せず、query選定だけを独立して評価する。

## Design-only Stop Condition
このpackage、PLAN、PROJECT_STATUSへ目的、選定規則、評価gate、未証明境界、Graph Trackへの復帰条件を記録したら停止する。X1-D0では製品sourceと本番を変更しない。

## Return Condition
設計完了後はCurrent QueueのGP0-3b-nへ戻る。Compact Context実装は、固定corpus、質問、期待source、品質基準、budget sweepを実装開始時に再確認してから独立sliceとして開始する。外部code graphはこの実装と混ぜず、repository再読込やimpact調査の損失が別の固定課題で測定された場合だけ独立比較する。
