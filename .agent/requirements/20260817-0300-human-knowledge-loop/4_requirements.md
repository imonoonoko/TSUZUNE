# TSUZUNE Context Explorer — 根幹思想からの大型アップデート案

作成: 2026-08-17 JST
状態: proposal-revised
対象: installed TSUZUNE v0.5.0以後の次期Primary Track候補
旧案: Daily Desk中心のHuman Knowledge Loop案は利用者判断により不採用

## 1. 結論

TSUZUNEを、毎日書くことを要求するアプリでも、AIのために記録を蓄積するシステムでもなく、**問いが生まれた時にMarkdownの局所構造を根拠まで辿り、本人とAIが同じContextを確認し、必要な知識だけをMarkdownへ戻せる構造探索基盤**へ更新する。

大型アップデートの名称は **Context Explorer** とする。製品上の一言は変えない。

> 書いて、つないで、あとで尋ねる。

大きく変えるのは起動画面ではなく、TSUZUNEで知識を使う時の単位である。現行の「ファイルを開いて個別機能を使う」体験を、次の一本の経路へ接続する。

```text
問い／現在のノート
  → 局所候補を辿る
  → 選定理由・時間・出典・省略を確かめる
  → 原文へ降りる
  → 同じContextを本人またはAIが使う
  → 必要な変更だけMarkdownへ戻す
  → 次の探索で再発見する
```

Daily noteはこの経路の必須条件にしない。書きたい時は今までどおり普通のMarkdownとして使える。

## 2. 旧案の誤りと訂正

旧案は「本人が第一の利用者」を「毎日の入口をDaily Deskにすること」と読み替えた。しかし、根幹思想の中心は毎日書く習慣ではなく、本人が知識を見失わず、判断の筋道を追い、必要時に取り戻せることである。

旧案から次を外す。

- Daily Desk、起動時dashboard、記入欄、継続候補をアップデートの中心にしない。
- Result Inbox、change set、Quiet Auditを新しい製品概念として先に作らない。
- 記録量や履歴圧縮の問題を、知識循環そのものの設計と混ぜない。
- multi-seed、typed relation、AI結果groupingを、利用事実なしに同時実装しない。

残すのは、根幹思想と現行実装のあいだで実際に確認された断絶だけである。

## 3. 現在事実

### 3.1 既にある土台

- 普通のMarkdown編集、検索、Wikiリンク、backlink、Local／Vault Graph。
- Temporal Memoryによる現在／過去／未来、review due、supersedes、provenance。
- Context Compilerによる起点、リンク先、backlink、時間状態、選定理由、警告、省略、文字数境界。
- MCPのrevision照合付きcreate／update／patch／autonomous update、履歴、source refs。
- AI Write Reviewの提案、差分、承認、取消、stale revision拒否。

### 3.2 観測済みの断絶

CIRC-ACCEPT-001で独立した自然作業として受入件数へ算入できるのはCIRC-01だけであり、実利用受入は暫定1/3である。CIRC-02・03は同一受入作業内のsource／既存経路の能力監査としてはPASSしたが、別の実利用サンプルには数えない。現時点で反復する利用者摩擦は0件である。

一方、製品差として次の一件がrepo原典で確認された。

> MCPはContextのselection reason、temporal status、warning、omitted、truncatedを返すが、Rendererには本人が同じ選定過程を確認するsurfaceがない。

この差はContext Explorerを検討する候補信号にはなるが、既存の「同型摩擦2件以上」という実装開始条件は満たさない。この文書は別途依頼された大型アップデート案のproposalであり、利用者が方向を採用するまで実装根拠・開始承認として扱わない。その他の機能も、Context Explorerの実利用で必要性を観測してから昇格する。

## 4. 製品契約

### 4.1 第一の利用者は本人

Context ExplorerはAI送信画面ではない。本人が自分の知識を理解するための探索面であり、AIは同じContextを借りる第二の利用者である。

- AIを使わなくても、問いから関連ノート、時間、出典、原文へ辿る価値が成立する。
- Contextの内部scoreではなく、人間の短い言葉で「なぜ含まれたか」を示す。
- 探索中の問い、閲覧順、開閉状態を新しいノートや行動logとして自動保存しない。
- 保存するのは、本人が明示的に編集・承認した通常Markdownだけにする。

### 4.2 探索は大胆に、書込みは慎重に

- 読取りと探索では、検索、明示リンク、backlink、Temporal、provenanceを横断できる。
- 自動展開は直接近傍と既存Context Compilerの上限に留める。
- 原文を開き、現在／過去、欠落、警告、省略を本人が確認できる。
- Context Explorer自身はread-only。書込みは既存editorまたは既存AI安全経路へ明示的に戻る。
- 未保存編集がある時は保存成功後のsnapshotだけでContextを確定する。保存失敗時はMCPと同じContextだと表示しない。

### 4.3 同じContextを共有する

RendererとMCPで別のretrieval実装を持たない。`src/core/context.ts`を唯一の選定実装とし、同じ起点、query、基準時点、temporal perspective、文字数上限から同じ構造結果を得る。

同値対象は次とする。

- included path
- relation
- selection reasons
- temporal status
- content omitted／truncated
- omitted path
- warning
- 生成されたContext Markdown

生成時刻のような非決定値は、固定fixtureでは同じ値を注入して比較する。

## 5. 主経路

### 5.1 ノートから始める

1. 現在ノートで「探索」を開く。
2. 必要なら短い問いを入力する。
3. Context Compilerが起点、明示リンク、backlink、Temporal近傍をboundedに構成する。
4. 本人は含まれたノート、理由、時間状態、警告、省略を確認する。
5. 項目を選ぶと中央paneで原文を開ける。起点は既存tabで保持し、戻れる。

### 5.2 問いから始める

1. 既存検索で問いに近いノートを探す。
2. 一件を起点として開き、「探索」を開始する。
3. 以後はノート起点と同じ経路を使う。

新しい検索engineやsemantic searchは作らない。問いだけで起点を自動決定せず、本人が最初のノートを選ぶ。

### 5.3 知識へ戻す

- 本人だけで使う場合は、原文を確認して既存editorで通常どおり編集する。
- AIへ渡す場合は、画面に見えているものと同じ条件でMCP `build_context`を使うか、生成Contextをcopyする。
- AI変更は既存revision、source refs、history、Review Modeを通す。新しいworkflow engineは作らない。
- 変更後にContextを再構築し、新しい本文やリンクが次の探索で到達可能かを確認する。

## 6. 出荷する範囲

### CE1 — Visible Context

現行3-paneを維持し、現在ノートの右sidebarに「探索」surfaceを追加する。

- 起点path、任意query、基準時点、valid-time／knowledge-time、文字数上限。
- included source、selection reason、temporal status、content omitted、truncated。
- warningとomitted path。長い一覧は折り畳むが存在を隠さない。
- 各sourceから原文を中央paneまたは既存の新規tabで開く。
- Context Markdownのpreviewとcopy。
- 生成中の自動write、session保存、履歴生成は0件。

### CE2 — Shared Contract Verification

RendererとMCPが同じcoreを使うことをfixtureで固定する。

- 同じ入力に対する構造出力とMarkdownの同値test。
- 未保存変更、保存失敗、外部変更、missing／ambiguous link、過去時点、文字数超過の境界。
- `50_履歴`の既定除外、Raw Source固定、Path Aliasを維持する。

### CE3 — Knowledge Return Reconnection

新しいResult Inboxは作らず、既存経路を探索面へ接続する。

- Contextに含まれるノートに承認待ちAI変更案がある場合だけ、その存在と対象を表示する。
- 選択すると既存AI Write Reviewの差分確認へ移動する。
- 承認／取消後はsnapshotとContextを再構築する。
- 自動適用、複数proposalのgroup化、atomic transactionは追加しない。

### CE4 — One-loop Acceptance

利用者が実際に必要とする一つの問いで、検索、探索、原文確認、同一ContextのAI利用または本人利用、Markdown更新、再探索までを一回通す。観測件数を水増しせず、この一件で各境界が動作するかを確認する。

## 7. 条件付き拡張

以下は大型構想には含めるが、初回出荷の確定要件にはしない。

### 7.1 複数起点と手動選択

開始条件:

- 一つの起点＋queryでは必要な原文へ到達できない実作業が2件以上ある。

開始する場合も、primary seed＋追加2件まで、直接近傍の和集合から始める。2-hop自動展開や全Vault投入は行わない。

### 7.2 意味付きMarkdown関係

開始条件:

- 「なぜこの2ノートがつながるか」を同じ作業で繰り返し説明する、または通常Wikiリンクでは次回Contextに必要な意味を保持できない事例が2件以上ある。

導入する場合は、普通に読めるMarkdownを正本とする。

```md
## 関係

- 根拠: [[調査ノート]] — この判断の一次資料
- 反証: [[検証結果]] — 以前の前提を否定
- 派生: [[実装メモ]] — この判断から作成
- 後継: [[新しい方針]] — 現在はこちらを採用
```

Graph DB、隠しrelation DB、AIによる一括分類は作らない。

### 7.3 AI結果のgroup化

開始条件:

- 一つの実作業で複数proposalの対応関係を見失う事例が2件以上あり、既存の一件ずつのReviewでは安全に判断できない。

開始前に、単なる一覧filterと対象path表示で解決できないことを確認する。

## 8. 受入条件

大型アップデートの初回完了条件は3つだけとする。

1. **本人が辿れる:** 実際の一つの問いについて、本人が起点から関連候補、時間状態、出典、原文へ移動し、なぜ含まれたか、何が省かれたか、警告は何かを画面で確認できる。
2. **本人とAIが同じContextを見る:** 固定fixtureと実作業で、RendererとMCPのincluded、reason、status、omitted、warning、Context Markdownが同じになる。未保存または保存失敗時に同一性を偽らない。
3. **知識が戻り再発見できる:** 本人または既存AI安全経路で更新した通常Markdownが、再構築したContextから到達できる。探索操作だけではVault note、AI履歴、行動logを一件も増やさない。

## 9. 非目標

- Daily noteの義務化、起動時dashboard、streak、記入率評価。
- TSUZUNE内蔵chat、OpenAI API、agent runner、汎用workflow engine。
- embedding、BM25、vector DB、Graph DB、利用履歴ranking。
- Graph全面刷新、2-hop以上の自動拡散、全Vault／全Repository投入。
- 自動分類、無断move／rename／delete、typed relationの一括生成。
- Code IntelligenceやIDEの内蔵。
- legacy履歴の圧縮・削除、実施記録運用の全面改定。
- 探索session、閲覧順、query履歴をMarkdownへ自動記録すること。

## 10. 根幹思想との対応

| 根幹思想 | Context Explorerでの実装 |
|---|---|
| 人間優先 | AIなしでも探索が成立し、選定理由を本人の言葉で表示する |
| 知識循環 | Context利用後の通常Markdown更新と再探索までを受入する |
| 局所から根拠へ | 一つの起点、直接近傍、Temporal、出典、原文へ限定する |
| 正本を保つ | 派生Contextと一時状態は保存せず、Markdownだけを正本にする |
| 変更を戻せる | 既存revision、history、Review Modeを再利用する |
| 責務を膨らませない | chat、semantic engine、Graph DB、IDE、session DBを追加しない |

## 11. 採用判断

この文書は次期Primary Track候補のproposalであり、製品実装の開始承認ではない。採用時はCE1から順に一つずつ出荷し、CE4を通した時点で初回Trackを閉じる。条件付き拡張は開始条件を満たさない限り作らない。
