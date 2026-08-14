# Codex/BM25 Context Gateway — 外部会話の評価整理

作成日: 2026-08-11
状態: 研究メモ（採用・実装・本番反映はいずれも未決定）

## 結論

この会話から残すべき結論は「BM25基盤を作る」ではない。先に必要な原文を選び、到達可能性・出典・時間境界を失わず、token量だけでなく成功した作業当たりの品質・時間・実コストを分けて測る、という設計原則である。

TSUZUNEにはすでに、その限定版であるMOC Title Router、queryによる本文展開優先、`omitted_ids`、Temporal／provenance保護、X1-T1のtoken観測境界がある。BM25、SQLite/FTS、永続的な調査状態、汎用Context Gatewayは現行製品に存在せず、このメモで採用したものでもない。

## 出典と読解境界

- 入力: `chatgpt-conversation://6a7af845-8ac0-83e8-a9f3-e7827a573181`（題名: 「CodexとBM25の活用」）。
- 上記は共有された外部会話であり、提案・研究値・製品比較は未検証の情報として扱う。
- 会話内で参照されたGoogle Notebookはprivateのため読めなかった。Notebookの内容や、会話中の数値的なtoken／cost削減主張は採用根拠にしない。
- 本メモは会話を製品仕様へ変換しない。現在の正本は`PLAN.md`、`PROJECT_STATUS.md`、X1要件と実装である。

## 会話の論点と現行TSUZUNEの対応

| 会話から抽出した論点 | 現行状態 | この時点の扱い |
|---|---|---|
| 圧縮より先に、必要な原文を選ぶ | X1-M1/X1-D1はMOCの全タイトルとbaseline candidate集合を保護し、queryは通常本文の展開優先だけを変える | 維持する既存原則 |
| 省いた候補への再到達性を残す | `omitted_ids`、選定理由、warning、source/provenanceを返す | 維持する既存契約 |
| token・wire・品質・費用を混同しない | X1-T1はwire bytesとmodel-visible tokenを分離し、hostが観測できないtokenは`not_observable`とする | 維持する既存の測定境界 |
| BM25で候補を先に絞る | 現行の`queryScore`は既存candidate内の本文優先だけで、全Vault向けBM25/FTS indexはない | 実測課題が出るまで仮説として保留 |
| revision-awareな調査状態、negative cache、作業記憶 | 要求単位snapshot indexはあるが、長寿命のtask state/background cacheはない | 再探索の反復が計測された場合だけ別設計にする |
| File/AST/Git→lexical→深い探索というrouter | 製品の汎用routerとしては未設計 | 対象作業と失敗例を固定できるまで導入しない |
| vector DB、GraphRAG、埋め込み、巨大なMemory層 | `PLAN.md`と`PROJECT_STATUS.md`では固定評価または計測で必要性が出るまで保留 | 今回は扱わない |

## 現行実装との重要な差分

現行のContext Compilerは、seedとリンク・時間情報からのbounded bundleを作る。これは「知識Vault全体を検索して候補を作るBM25 gateway」ではない。一方で、語彙score 0を候補除外に使わず、略称・同義語・日英表記差・抽象タイトル・橋渡しノートの原文到達性を守るため、単純なtop-k lexical prefilterをそのまま差し込むことは現行契約と衝突し得る。

また、X1-M1の92.47%という値はContext Markdown文字数の固定比較であり、model-visible token、請求額、成功率の削減を意味しない。X1-T1もtransportの測定プロトコルであって、BM25の必要性や効果を示す結果ではない。

## もしBM25を検証するなら

実装前に、まず現行経路で解けなかった検索課題だけを、Vault revision・質問・expected source・許可する取得操作とともに小さく記録する。その同じ課題で、現行経路と隔離したlexical候補抽出を比較する。

記録する指標は、少なくとも次の通りとする。

- expected sourceへの到達率、source traceの正確性、silent omission。
- 回答品質を評価する場合は、同一課題・同一根拠条件で分離して採点すること。
- Context文字数、serialized wire bytes、tool call数、latency。
- hostがper-call/per-turn input tokenを公開する場合だけmodel-visible token。推定tokenや文字数を代用しない。
- index作成・更新・失効・復旧の運用負担。

既存経路より再現可能な改善がなく、または到達可能性・Temporal・provenanceのgateを落とすなら、BM25実装は行わない。改善が出ても、最初の対象は一つの明示的な検索失敗に限り、汎用gatewayや永続cacheへ拡張しない。

## 今回の非決定

- BM25、SQLite/FTS5、embedding、vector DB、GraphRAGを追加しない。
- 永続的なInvestigation State、negative cache、background index更新を追加しない。
- Codexや他agentのtoken／費用をこの会話の数値から見積もらない。
- TSUZUNE製品コード、本番、既存X1要件を変更しない。

## 関連する現行資料

- [Query-aware Compact Context Requirements](../../.agent/requirements/20260810-0440-query-aware-compact-context/4_requirements.md)
- [X1-T1 Structured-only Transport Measurement Protocol](../../.agent/requirements/20260810-0440-query-aware-compact-context/7_x1-t1-model-visible-token-benchmark.md)
- [TSUZUNEあり／なし benchmark](tsuzune-with-without-benchmark-2026-08-09.md)
- [Product Plan](../../PLAN.md)
- [Project Status](../../PROJECT_STATUS.md)
