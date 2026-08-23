# PCTX-A1 — 実行brief

このbriefは製品実装ではなく、`4_requirements.md`を一度だけ再現可能に実行するための手順である。

この設計sliceでは実Agentの起動、受入の実行、production TSUZUNEへの結果書込みを行わない。以下は、利用者が受入実行を別途明示した時だけ使う。

実行結果（2026-08-17）: 1回のno-retry受入はAC1 FAIL／AC2 PASS／AC3 PASS。対象作業と受入harnessの主語混同を受け、対象作業識別、二部構成prompt、AC1即時FAIL規則までartifact契約を強化した。同一runは再試行しない。

## 1. 次回受入実行時の成果物

- 新Agentの7項目引継ぎ結果。
- 評価者のAC1〜AC3判定。
- PASS、またはFAIL分類と根拠。
- production TSUZUNEの実施記録1件。

製品code、test、UI、package、production binaryは変更しない。

## 2. 事前固定packet

評価者が次だけを固定する。

- 対象となる自然作業と、正解内容を含まない1行の対象作業識別。
- 入口TSUZUNE-relative path、title、revision。
- 新Agentへ渡すread-only prompt。
- 7項目のground truthと、その正本path／revision。ground truthは新Agentへ渡さない。

## 3. 新Agentへのcopy-ready prompt

評価者は`{{...}}`だけを事前固定packetの値へ置き換える。対象作業識別は主語を固定するための名称だけとし、採用判断、検証結果、期待する次の一手、ground truthは書かない。

```text
対象作業識別（正解内容ではなく、復元する主語の固定）
- 対象作業: {{TARGET_WORK_LABEL}}
- 入口title: {{ENTRY_TITLE}}
- 入口path: {{ENTRY_PATH}}
- 期待revision: {{ENTRY_REVISION}}

production TSUZUNEの指定入口から、上記の完了済み対象作業を別Agentが安全に引き継ぐための情報を復元してください。

この受入run自体、PCTX-A1の受入設計、またはあなた自身のsearch／fetch／build_context手順を対象作業として説明しないでください。取得手順は末尾の「B. 取得監査」にだけ記録してください。

取得規律
1. 入口titleまたは識別語をsearchし、同名・近似重複を確認する。
2. 入口をfetchし、pathとrevisionを期待値と照合する。
3. 入口をseedにbuild_contextを1回だけ実行する。knowledge-time、include_history false、max_characters 15,000、as_ofは指定しない。
4. 追加fetchは重要ノート3件以内。repositoryは入口または関連ノートが明示するpathだけをread-only確認する。
5. 書込み、実装、本番反映、Git、外部作用、訂正依頼、再試行は行わない。

提出形式
対象作業: {{TARGET_WORK_LABEL}}

A. 対象作業引継ぎ
1. 現在の目的
2. 守るべき制約
3. 採用した判断、却下・後継・supersededの判断、その理由
4. 根拠、確認時点、入口／重要ノートrevision、Context Markdownのprovenance
5. 対象作業で完了した手順・検証と、未実施事項
6. Permission、未解決リスク、警告、省略、停止条件
7. 次の安全な一手と、新しい権限が必要な場合はその内容

主要主張ごとにTSUZUNE-relative pathまたはrepository pathを付けてください。不明は推測せず、不明の根拠と停止点を示してください。Source、Decision／Policy、Procedure、Permissionを分けてください。正本でsupersededを確認できない場合は「確認できたsuperseded判断: なし」と書き、historicalだけを理由にsupersededとしないでください。

B. 取得監査
- search結果件数とexact／近似の区別
- 入口path／revisionと期待値との一致
- build_context回数、設定、返されたas_of、Context MarkdownのGenerated
- 追加fetch件数とpath
- warnings、omitted_ids、truncated
- repository read-only確認path
- retry回数

最初の提出前に、Aの項目1・3・5がすべて「{{TARGET_WORK_LABEL}}」を主語にしており、受入runや自分の取得手順へ置き換わっていないことだけを確認してください。提出後は停止してください。
```

## 4. 実行順

1. repositoryのdirty stateを記録し、受入成果と既存変更を分離する。
2. production TSUZUNEで入口をsearch／fetchし、revisionを固定する。
3. 評価者用ground truthを正本とrepository原典から作る。
4. 会話履歴を渡さない新Agentを1件起動する。
5. 新Agentは上記copy-ready promptと`4_requirements.md`の取得契約に従い、一度だけ提出する。
6. 評価者はAC1、AC2、AC3を個別にPASS／FAIL判定する。
7. FAILなら分類を一つ以上付ける。訂正promptや同一runの再試行はしない。
8. 結果をproduction TSUZUNEの実施記録へ保存し、read-back、一意検索、必要なbacklinkを確認する。

## 5. 実行時のhard boundary

- `build_context`: 1 call。
- 追加`fetch`: 重要ノート3件以内。入口fetchは別枠。
- `max_characters`: 15,000固定。
- `include_history`: false固定。
- `temporal_perspective`: knowledge-time固定。
- `as_of`: 明示しない。返された`as_of`とContext Markdownの`Generated`を証拠として記録する。
- repository: read-only。
- TSUZUNE: 新Agentはread-only。結果記録だけを評価者が最終境界で1回書く。
- retry: 0。
- code／UI／schema／dependency追加: 0。

MCP接続不能、入口取得不能、またはcritical revisionの途中変化は`BLOCKED`とし、Context品質のFAILへ数えない。warning、omitted、truncatedも、正しく報告された限り存在だけでFAILにしない。

## 6. 設計上の再利用先

- Context構築: `src/core/context.ts`
- MCP mapping: `src/mcp/service.ts`
- MCP tool contract: `src/mcp/server.ts`
- Note revision: `fetch`／`revisionFor`の既存経路
- Knowledge writeback: production TSUZUNEの既存revision付きMCP更新と実施記録契約

新しいContext builder、renderer ranking、packet serializer、databaseを作らない。

## 7. 実行後の判断

- PASSなら「新機能不要」を成果とする。
- 単発FAILなら、まず既存knowledge artifactを直す設計へ戻す。
- 独立した自然作業で利用者の再調査・誤判断・停止不能が同型で2件以上発生し、既存knowledge artifact修正でも解消しない限り、Context ExplorerやMCP field追加をPrimaryへ昇格しない。

## 8. 設計レビューgate

- `4_requirements.md`のAC1〜AC3と実行順が矛盾しない。
- copy-ready promptが対象作業識別を固定し、対象作業引継ぎと取得監査を分離している。
- promptにground truth、採用判断、検証結果、期待する次の一手が漏れていない。
- 新Agentが追加の製品判断なしに実行できる。
- write、production、Git、external actionの権限が混入していない。
- UI、DB、schema、runtime、automationが非目標として固定されている。
- current repo／TSUZUNEの既存契約だけで実行可能である。

## 9. 2026-08-17実行結果

- 入口: `30_知識/TSUZUNE-PCTX-A1-PLAN同期-実施記録-2026-08-17.md`。
- 取得: `build_context` 1回、追加fetch 1件、retry 0。critical revision driftなし。
- 判定: AC1 FAIL／AC2 PASS／AC3 PASS。FAIL分類は`DECISION`、`EVIDENCE`、`TIME`。
- artifact補正: 対象作業識別、二部構成のcopy-ready prompt、supersededなしの明示形式、AC1即時FAIL規則を追加した。
- 未実施: 訂正prompt、同一run再試行、製品実装、test、build、production update、Git操作。

## 10. 2026-08-17補正後再受入結果

- 対象: 初回と分離した自然作業「右コンテキスト3タブ化」。
- 入口: `30_知識/TSUZUNE-右コンテキスト3タブ化-実施記録-2026-08-17.md`。
- 取得: 会話履歴なし、read-only、`build_context` 1回、追加fetch 0件、retry 0。warningsなし、truncated／omitted開示、critical revision driftなし。
- 判定: AC1 PASS／AC2 PASS／AC3 PASS。7項目の対象主語、判断と根拠、Permission、停止条件、取得監査を復元した。
- 境界: 初回FAILは履歴として保持し、同一runは再試行していない。補正後受入は独立した1 runであり、全modelへ一般化しない。
- 結論: 現行経路で成立。新しいContext UI、DB、schema、runtime、automationは追加しない。
