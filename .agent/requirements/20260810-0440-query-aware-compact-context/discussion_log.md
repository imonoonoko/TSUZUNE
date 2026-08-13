# Query-aware Compact Context Discussion Log

## Intake And Scope - 2026-08-10 04:40

### User Input
> TSUZUNE使うとコンテキスト膨れるのなんとかしたい～

> では設計からどうぞ

### Evidence Reviewed
- 本番TSUZUNEの`30_知識/TSUZUNE-Context CompilerとTemporal Memory.md`。
- [TSUZUNEあり／なし benchmark](../../../docs/reports/tsuzune-with-without-benchmark-2026-08-09.md)。
- `src/core/context.ts`、`src/mcp/service.ts`、`src/mcp/server.ts`の現在経路。
- 本番起点`10_プロジェクト/TSUZUNE.md`のread-only probe。

### Observations
- 現行`build_context`は既定15,000文字で、probeでは11ノートを含み55ノートを省略した。
- 6,000文字へ下げても同じ11ノートが選ばれ、11件すべてが短い断片になった。文字数上限だけの変更では根拠密度が上がらない。
- coreには質問語によるoutgoing／backlink順位付けが既にあるが、MCPの`build_context`は`query`を受け取らない。
- MCP serverは同じ構造化結果をpretty JSONの`content[0].text`と`structuredContent`へ二重格納する。実データ計測ではJSON-RPC相当frameの約52%がこの重複だった。
- 既存benchmarkの複数seed連結はbundle間の重複本文を除去しない。現行成果物では33,436文字中4,176文字、12.5%が重複しているが、これは単一`build_context`の改善後に再評価する別問題である。

### Decisions
- Accepted: X1-D0は設計だけで停止し、製品source、MCP登録、本番アプリを変更しない。
- Accepted: 最初の実装候補は、MCPへ任意`query`を追加し、既存core rankingへ渡す後方互換な橋渡しとする。
- Accepted: `query`がある場合、通常のoutgoing／backlinkは質問語scoreが0の候補を選定対象から外す。起点と時間候補は質問語だけで削らない。
- Accepted: 小さい予算では全候補を均等に細切れにせず、低順位の通常候補を先に落とす。最上位の通常候補だけは部分表示を許容候補とする。
- Accepted: `build_context`だけは、実クライアント検証に通った場合に`structuredContent`を正本として`content`の重複JSONを除く。他の6ツールは変更しない。
- Accepted: 固定評価で品質を維持できた最小予算だけをcompact既定候補にする。先に6,000文字などの数値を決め打ちしない。
- Rejected: vector DB、embedding、GraphRAG、LLM要約、独自DB、新しいContext toolを同時に導入する。
- Deferred: 複数seed bundleの本文dedupe、利用回数による休眠、MOC自動生成、query中心の本文抜粋。

### Open Questions
- 2,000／4,000／6,000／8,000／15,000文字のうち、固定品質gateを通る最小予算はどれか。
- 最上位の通常候補1件を部分表示する方が、全文収録できる次候補を優先するより回答品質が高いか。
- Codex／ChatGPT Desktopが空の`content`と有効な`structuredContent`を実運用で正しく扱うか。
- wire bytesの削減が、利用中hostのmodel-visible token削減へそのまま反映されるか。これは別計測まで主張しない。

### Stop And Return
設計package、評価gate、既知の互換境界を固定した時点でX1-D0を停止する。実装は別sliceとして明示的に開始し、それまではGraph TrackのGP0-3b-nをCurrent Queueに維持する。

## MOC Priority Override - 2026-08-10

### User Input
> まずMOCを最優先に開始

> MOCはノートのタイトルを羅列する感じ

### Decision
- X1-D0全体の実装開始とはせず、独立した最小slice X1-M1としてMOCだけを先行する。
- valid frontmatterが`type: moc`のノートだけを判定対象とし、ファイル名、folder、link密度から推測しない。
- MOCのContextは原本文を変更せず、解決済みWiki linkのタイトル一覧へ投影する。
- MOC起点では通常のリンク先本文とバックリンク本文を展開しない。選んだタイトルの本文は次の`fetch`または`build_context`で読む。
- query bridge、budget selection、structured-only transport、MOC自動生成はこのsliceへ含めない。

### Read-only Evidence
- 本番VaultにはMarkdown 230件、`type: moc` 15件があり、MOCの分類metadataは`type: moc`以外が不均一だった。
- `00_入口/知識地図.md`を15,000文字上限で比較し、現行本番は15,000文字、included 9、omitted 21だった。
- 同じVaultへworking-tree coreをread-only適用すると1,132文字、included 1、omitted 0になった。13,868文字、約92.5%の削減である。
- これはContext Markdown文字数であり、model-visible token削減率ではない。Vault writeは0件である。

## External Code Map Review - 2026-08-10

### User Input
> Ixについての会話情報も見て

### Read Status
- 参照されたChatGPT conversationは全1往復を読了した。
- 変化し得る記述はIxの公式README、GitHub releases／open issues、standalone Docker設定、Memory Layer配布repositoryで再確認した。

### Useful Context
- 永続的なcode symbol graphを先に問い合わせ、必要なsourceだけ読む思想は、将来のcode context効率化に有用である。
- `explain`、`impact`、`trace`のように質問型を狭くする設計は、TSUZUNEでも「目的に応じた最小根拠bundle」を作る考えと整合する。
- 一方、今回の実測原因はnote選定とMCP搬送であり、Ixの追加だけでは直らない。

### Risks And Boundaries
- Ixはalphaで、Node.js 22、Docker、ArangoDB、Memory Layerを必要とする。
- CLI repositoryはApache-2.0だが、Memory Layer配布repositoryはprivate sourceから生成したJARのみを公開していると明記する。
- 2026-08-10確認時点でWindows path、PowerShell installer、Codex MCP互換のopen issueがある。
- 公称token削減率は同一fixtureで再現しておらず、今回のacceptanceへ使わない。
- 公式Composeはlocalhostへbindする一方、ArangoDB認証を無効化し、Memory Layerへ可変`latest` imageを使う。試験する場合もversion／digest固定と専用データ破棄を必要条件にする。

### Decision
- X1-D0へIxをinstall、vendor、fork、依存追加しない。
- 現行のquery-aware selectionとtransport削減を先に独立評価する。
- Ixは、codebase再読込やimpact調査の無駄が固定課題で観測された場合だけ、1 repository・manual command・hookなしで比較する外部候補として残す。

## Recall-safety Correction - 2026-08-10 12:52

### User Input
> 質問に合うMOCタイトルだけを返す絞り込み　は不完全性が強そう

> では計画からはじめて

### Correction
- X1-M1の本番MOC Title Routerは、すでに解決済み全タイトルを記述順で返しており、queryによるタイトル削除を実装していない。この挙動を維持する。
- 以前のX1-D0案にあった、query score 0の通常候補を選定対象から外す方針を撤回する。
- queryは、query無しで得られるbaseline候補集合のうち、どの本文を先に展開するかを決める補助情報に限定する。
- 文字予算で本文を収録しない候補も`omitted_ids`へ残し、次の`fetch`または`build_context`で取得できるようにする。
- `build_context`のstructured-only搬送はsource recallと独立したX1-T1として評価する。

### Rationale
短いタイトル、略称、同義語、日英表記差、橋渡しノートは、必要な根拠でも単純な語彙scoreが0になり得る。質問語との不一致を「不要」と同一視せず、削除ではなく段階取得でContextを小さくする。

### Stop And Return
この訂正をrequirements package、PLAN、PROJECT_STATUS、TSUZUNEの既存知識ノートへ反映したら設計で停止する。製品source、MCP、本番挙動は変更せず、Current QueueはGP0-3b-nのままとする。

## X1-D1 Implementation Start - 2026-08-10 13:30

### User Authorization
> はい

### Bounded Slice
- optional `query`をMCP serverからservice、既存coreへ渡す。
- query無しbaselineのoutgoing／backlink quotaを先に固定し、quota外の一致候補を昇格させない。
- queryはbaseline内の通常本文を収録する順序だけを変え、MOC全タイトル、score 0候補、Temporal／provenance／warningを削除しない。
- query時は起点、Temporal、MOCを先に保護し、通常本文を高順位から全文、必要時は最大1件だけ部分表示し、残りを`omitted_ids`へ残す。

### Excluded
- X1-T1 structured-only transport、embedding、要約、multi-seed API、新依存は追加しない。
- 固定4問の回答品質とmodel-visible token削減は、source implementationだけから達成扱いしない。

## X1-D1 Production Closeout - 2026-08-10 14:03

### Result
- commit `e2d8621`をpushし、clean sourceからインストール済み本番へ反映した。
- 57 files／508 tests、typecheck、MCP smoke、packaged／installed smoke、build／installed hash一致、production profile不変、MCP再登録を確認した。
- MOC全タイトル順、query有無のcandidate集合、Temporal／provenance／warning、最大500文字query、2k／4k／6k／8k／15k budget sweepを回帰固定した。

### Remaining Boundary
- 固定4問の回答品質とmodel-visible tokenは未計測である。
- legacy text＋structuredContentの二重搬送は独立X1-T1まで変更しない。
- TSUZUNEへ知識を書き戻した後、Primary QueueのGP0-3b-nへ戻る。

## X1-T1 Measurement Protocol - 2026-08-11

### User Input
> 再開

### Evidence Reviewed
- `src/mcp/server.ts`の共通`textResult`は、同じ値をpretty JSONの`content[0].text`と`structuredContent`へ二重格納する。
- `scripts/check-mcp.mjs`は実stdio serverを起動し、`build_context`のstructured resultを検査する。
- 本番TSUZUNEのContext契約は、wire bytesとmodel-visible tokenを別指標として扱う。

### Decisions
- Accepted: R4/R5を変更せず、X1-T1専用の測定プロトコルを追加する。
- Accepted: `build_context`だけを比較対象にし、他の6 tool、candidate selection、MOC、Temporal、warningを変更しない。
- Accepted: hostが正確なper-call／per-turn input-token使用量を公開するときだけmodel-visible tokenを測る。bytesやtokenizer推定で代用しない。
- Accepted: Codex DesktopとChatGPT Desktopの双方で固定4問・source表示を確認するまで、本番transport rolloutを行わない。
- Rejected: このcheckpointでのtransport実装、新依存、汎用response profile、tokenizer推定、production update。

### Outcome
- 実装前に必要なbyte、決定性、latency、Desktop互換、token観測不能時の表現、rollback境界を`7_x1-t1-model-visible-token-benchmark.md`へ固定した。
- 実測とtransport source変更は未実施のままである。

## X1-C2 Context Budget Priority - 2026-08-12 02:21 JST

### User Input
> 再優先事項としてコンテキスト、トークン消費をどうにかしたい

### Decisions
- Accepted: 次の主作業をX1-C2 Context Budget Evaluationとし、既存`build_context`の4k／6k／8k／15kをfixed-question・read-onlyで比較する。
- Accepted: 最小予算の採用には、回答4/4、source trace 3/3、future leakage 0、write 0、expected-source到達性を同時に要求する。
- Accepted: `search`→`fetch`を単一ノートの標準経路とし、複数ノート、時点、provenanceが必要なときだけ`build_context`を使う運用も比較する。
- Accepted: hostが正確なper-call／per-turn usageを公開する場合だけmodel-visible tokenを記録する。wire bytes、Markdown文字数、tokenizer推定で代用しない。
- Held: 実Windows accessibility P1は放棄せずquality gateとして保持し、X1-C2の結論後に再開する。

### Rejected for this Track
- 既定15,000文字の即時変更、BM25、FTS、SQLite、embedding、vector／GraphRAG、persistent task state、Hooksのproduction導入。

### Next Evidence
- 同一質問、同一source fingerprint、同一tool設定で各予算を比較し、採用値または既定維持を一度だけ決める。
