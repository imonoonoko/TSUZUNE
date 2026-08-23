# Discussion log

## 2026-08-17 — 設計開始

### 利用者要求

- TSUZUNEの根幹思想へ「持ち運べる作業Context」を統合した後、利用者が「設計開始」と指示した。
- 今回の権限は設計の確定までとし、製品実装、production update、Git操作は含めない。

### 現在事実

- `PLAN.md`とproduction TSUZUNEは、現役の製品Primary Trackが0であると示している。
- CIRC-ACCEPT-001は3/3完了。RETRIEVE-EXPLAIN／STRUCT-NAVと同型の反復利用者摩擦は0件。
- 現行`build_context`は、included、selection reason、temporal status、warning、omitted、truncated、Context Markdownを既に返す。
- 厳密なrevisionは`fetch`で取得できる。`build_context.included`自体にはrevisionがない。
- 既存Context Explorer案はproposalであり、実装開始承認ではない。

### 比較した案

1. **既存機能だけでAgent交代を受け入れる** — 採用。
   - 実際の不足を測ってから、必要なら最小機能を選べる。
   - 新しいUI、DB、schema、runtimeを要しない。
2. **Context Explorer CE1を先に実装する** — 保留。
   - 右sidebarへ選定理由等を表示する案は既に存在するが、利用者摩擦の開始条件を満たしていない。
3. **Context Packet／Decision DB／必須schemaを作る** — 不採用。
   - 既存Markdown、実施記録、関係、Temporal、revision、履歴と重複し、日常記録を重くする。
4. **Personal Context OS／常駐Agent化する** — 不採用。
   - TSUZUNEと外部Agent環境の責務分離を破る。

### 確定判断

- 最初の設計sliceを `PCTX-A1 — 交換可能Agent引継ぎ受入` とする。
- 1つの自然な実作業を対象に、会話履歴を持たないread-only Agentが、1つの正本入口から安全な再開状態を復元できるか測る。
- PASSなら新機能を作らない。FAILが1件なら、まず試験条件と、ノート、リンク、現在性、Permission記述の不足を切り分ける。
- 独立した自然作業で利用者が実際に再調査・誤判断・停止不能となる同型摩擦が2件以上あり、既存knowledge artifactの修正でも解消しない場合だけ、最小の製品変更候補を再設計する。

### 未確定

- 最初の受入に使う自然作業は、実行開始時に利用者の直近作業から1件選ぶ。
- 15,000文字は現行のbounded Contextを同条件で測る試験値とし、truncatedだけを製品FAILにしない。
