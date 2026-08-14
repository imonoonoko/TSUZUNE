# Query-aware Compact Context Scope

## Implemented In The X1-D1 Source Slice
- `build_context`へ任意の`query`を追加し、MCP serverからservice、既存coreへ渡す。
- `query`をtrimし、最大500文字に制限する。
- query無しで得られる通常outgoing／backlink／temporal候補集合をbaselineとし、query有りでも集合を変えない。
- queryはbaseline内の通常候補本文を展開する優先順にだけ使い、score 0を削除理由にしない。
- MOCの全タイトル、起点ノート、時間候補、出典導線をqueryだけで削除しない。
- hard character budgetを維持し、低順位の通常候補は本文を見送っても`omitted_ids`へ残す。
- source fence、path、relation、updated、selection reason、temporal status、warningを維持する。
- 現行MCP資料とtool説明へ、質問がある場合は`query`を渡す運用を追記する。

## Completed X1-D1 Acceptance
- commit `e2d8621`をpushし、2026-08-10 14:03 JSTにclean sourceから本番更新した。
- 57 files／508 tests、typecheck、MCP smoke、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認した。
- MOC全タイトル順、query有無のcandidate集合、Temporal／provenance／warning、最大500文字query、2k／4k／6k／8k／15k budget sweepを回帰固定した。

## Measurement Still Pending
- 固定4問と本番read-only fixtureで回答品質、期待source、文字数、決定性、latencyを再計測する。
- model-visible tokenはhost-level計測まで削減率を主張しない。

## Deferred X1-T1
- `build_context`だけのtext JSON／`structuredContent`二重搬送は、実client gateに通った場合だけstructured-onlyへ変える。
- wire bytes削減はX1-D1のsource recallと別に測り、model-visible token削減と同一視しない。

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
- Codex／ChatGPT Desktopがstructured-only resultを扱えない場合はtransport変更を適用せず、queryによる本文展開優先だけを独立して評価する。
- query有無で`included[].path`と`omitted_ids`の和集合を変えず、最初のtop-kだけで「情報がない」と結論しない。

## Completed X1-D0 Design Boundary
X1-D0は、このpackage、PLAN、PROJECT_STATUSへ目的、選定規則、評価gate、未証明境界、Graph Trackへの復帰条件を記録して停止した。

## X1-D1 Stop Condition
MOC全タイトル順、query無しbaselineのcandidate集合、Temporal／provenance／warningのどれかを失った場合は停止する。X1-T1、embedding、要約、multi-seed APIへ拡張しない。

## Return Condition
X1-D1の検証とproduction updateを完了したため、TSUZUNE書き戻し後はCurrent QueueのGP0-3b-nへ戻る。固定4問の回答品質と本番read-only計測は未証明のmeasurementとして残し、外部code graphはこの実装と混ぜない。
