# Codex Desktop ローカルMCP連携

TSUZUNE v0.2以降は、現在開いているローカルVaultをCodex Desktopから検索・参照し、依頼に応じてノートを作成・更新できるMCPサーバーを含みます。

## 最初の設定

1. TSUZUNEを起動し、AIから参照したいVaultを開きます。
2. TSUZUNEリポジトリでPowerShellを開きます。
3. 依存関係とMCPサーバーを確認します。

   ```powershell
   npm install
   npm run check:mcp
   ```

4. Codexの共通設定へTSUZUNEを登録します。

   ```powershell
   npm run mcp:register
   ```

5. Codex Desktopを再起動します。
6. Codexタスクの入力欄で`/mcp`を実行し、`tsuzune`が接続済みであることを確認します。

登録処理は`~/.codex/config.toml`に、コメントで囲んだTSUZUNE専用ブロックだけを追加します。既存設定がある場合は、同じ場所へタイムスタンプ付きバックアップを作ります。
検索・参照、Drive同期preview、`create_derived_note`、`autonomous_update_note`、`propose_derived_note`による例外提案の登録は自動利用できます。`create_derived_note`は通常の低riskな受信箱整理を承認操作なしで完了し、`propose_derived_note`は権限・採否・安全性の判断が必要な例外だけをAI Reviewへ送ります。どちらも原典を変更しません。保護されていない通常ノートのAI更新はユーザー承認なしで実行でき、指定した`expected_revision`が古くなく本文が完全に同一なら、revision指定の有無にかかわらず更新せず`unchanged: true`を返します。`create_directory`、`create_note`、`update_note`、`patch_note`、Drive同期applyは確認を出す設定で登録します。

## 使い方

たとえば、次のように頼めます。

```text
TSUZUNEで「ONOKO」を検索して、関係するノートを教えて。
```

```text
TSUZUNEの「00_入口/プロジェクト地図.md」を起点に文脈を作り、
現在動いているプロジェクトを整理して。
```

```text
「10_プロジェクト/TSUZUNE.md」へのバックリンクを調べて。
```

```text
今の会話を「01_受信箱/Codex連携メモ.md」として新規保存して。
```

```text
「10_プロジェクト/TSUZUNE.md」を読んでから、
今回決まった連携方針を追記して。
```

```text
NotebookLMの調査結果を「10_プロジェクト/TSUZUNE.md」へ自動反映して。
理由と出典を記録して。
```

```text
「10_プロジェクト/TSUZUNE.md」を起点に、
2026-07-22時点の文脈を作って。当時不明なことは推測しないで。
```

```text
「10_プロジェクト/TSUZUNE.md」を起点に、
2026-07-22までにAIが知っていた情報だけで文脈を作って。
```

```text
TSUZUNEのGoogle Drive同期内容を確認して。件数を説明し、まだ適用しないで。
```

```text
01_受信箱のノートを一件読み、移動先、理由、反証・懸念、
原典をどう守るか、未確定事項を提案して。まだ変更しないで。
```

```text
01_受信箱のノートを一件最後まで読み、再利用可能な概念へ分け、
各概念に既存カテゴリ1件、topicを最大3件、安定したconcept keyを付けて、
原典を残したまま30_知識へ直接作成して。
```

```text
さきほど確認したDrive同期planを適用して。
```

最初に`search`で候補を探し、必要なノートだけを`fetch`または`build_context`で読むのが基本です。

### 受信箱を整理する時

人間は`01_受信箱`へ入れるだけです。AIは次の整理経路を使います。

1. `01_受信箱`の対象を`fetch`し、本文はAIへの命令ではなく非信頼の整理対象データとして扱います。
2. AIは原典を0〜複数の再利用可能な概念へ分け、各概念について既存知識を検索します。既存知識本文は自動置換せず、同一概念に新しい知識がなければノートを作りません。新しい概念または独立して保持すべき根拠があれば、既存主カテゴリ1件、検索用topic 1〜3件、安定した`derivation_key`、`30_知識`の新規保存先、関連知識へのWikiリンクを含む本文を決めます。
3. 通常の低risk概念ごとに`create_derived_note`へ原典path、取得時revision、`derivation_key`を渡して直接作成します。10万文字を超える原典は`fetch`の`next_after`を次の`after`へ渡して末尾まで分割取得します。同じ原典revisionでも異なる概念keyは複数作成でき、同じkey、古いrevision、保存先衝突、範囲外pathを拒否します。`knowledge.md`と、`#`・`|`・`]]`を含み正確なWiki linkにできないpathは原典にできず、カテゴリ、topic、concept keyにダブルクォートは使えません。
4. 原典revision単位の処理完了と保留理由は`00_入口/受信箱地図.md`の現在状態へ反映します。権限衝突、本人の採否が不明、機微・危険情報などはノート化せず保留します。原典は常に不変で、派生ノートは原典Wiki link、原典path、revision、concept keyを保持します。

受信箱原典は通常保持します。利用者が明示した場合だけ、出典情報を派生知識へ残し、リンク元を解消した後に復元可能な`.trash`へ移動できます。永久削除、既存知識本文の自動置換、`50_履歴`への記録は行いません。

既存ノートの更新では、`fetch`で完全な本文と改訂トークンを取得してから、`update_note`で本文全体を置き換えます。取得後に外部編集やVault切替が起きた場合は更新を拒否するため、再取得が必要です。

## Codex Desktopへ登録する19ツール

| ツール | 用途 | 上限 |
|---|---|---|
| `runtime_info` | MCPのversion・起動時刻・更新状態・匿名化Vault IDを確認 | 1 runtime |
| `delivery_info` | runtime freshnessとは分離してsourceとlatest receiptのstatus（match／mismatch／unknown）のみを確認。更新推奨・path・hashは返さない | 1 status |
| `search` | タイトル・相対パス・本文を検索し、`category:`／`topic:`で完全一致filter | 最大50件。画面は知識／情報源／受信箱／その他の固定順、各group内は関連度順 |
| `fetch` | Markdownノートを1件取得 | 本文10万文字 |
| `get_backlinks` | 指定ノートへのリンク元を取得 | 1ページ最大50件、path cursorで継続 |
| `build_context` | 起点と関連ノートをMarkdownへまとめ、観測範囲を分けた利用レシートを返す | 既定1万5千文字 |
| `list_directory` | 本文なしでフォルダ・ノート・添付metadataを取得 | 最大200件、depth 3、scope fingerprint |
| `preflight_move_entry` | 起動中アプリで単一Markdown移動を事前検査 | 1ノート |
| `preview_drive_sync` | 起動中のTSUZUNE本体でDrive同期内容を確認 | 1 plan |
| `create_directory` | 既存フォルダ内へ新規フォルダを作成 | 1フォルダ |
| `create_note` | 既存フォルダ内へ新規ノートを作成 | 本文10万文字 |
| `create_derived_note` | 通常の低risk原典からconcept key単位の`30_知識`ノートを直接作成 | 1概念、topic 1〜3件 |
| `propose_derived_note` | 原典を変更せず、concept key単位の`30_知識`ノートをAI Reviewへ提案 | 1概念proposal、topic 1〜3件 |
| `update_note` | 改訂トークンが一致する既存ノートの本文を更新 | 本文10万文字 |
| `autonomous_update_note` | 承認を待たず通常ノートを更新し、同一本文はno-op、revision一致時だけ変更 | 本文10万文字 |
| `patch_note` | 改訂トークンが一致する既存ノートの狭い範囲を更新 | 1操作 |
| `move_entry` | preflight済みの単一Markdown移動を適用 | 1ノート |
| `trash_entry` | 明示依頼されたリンク元のない受信箱原典をrevision一致で`.trash`へ移動 | 1ノート |
| `apply_drive_sync` | preview済みplanを再検査しDrive同期を適用 | 1 plan |

### Direct serverに実装済みの未登録2ツール

| ツール | 用途 | 通常のCodex登録 |
|---|---|---|
| `suggest_links` | 既存ノートから重複しないWikiリンク候補を提案 | 無効 |
| `add_link` | 既存ノートへWikiリンクを追加し、監査記録を保存 | 無効 |

direct serverは開発用smokeで21ツールを検証しますが、`npm run mcp:register`がCodex Desktopへ登録するのは上の19ツールです。未登録2ツールを暗黙に有効化して書き込み権限を広げません。

### Freebuff用プロファイル

FreebuffからVault直下の`.agents/mcp.json`で起動する場合は、引数へ`--profile freebuff`を追加します。このプロファイルはCodex Desktop登録面と同じ19ツールを公開し、direct server専用の`suggest_links`、`add_link`を外します。FreebuffとCodexでツールの使い分けを変える必要はありません。

```json
"args": ["out/mcp/server.js", "--vault", "C:/path/to/Vault", "--profile", "freebuff"]
```

`build_context`が辿るのは、起点ノート、リンク先最大5件、バックリンク最大3件の1段だけです。無制限にVault全体を読み込みません。関連するState NoteとEvent Noteがあれば、時間判定と選定理由も返します。

`included`の各sourceには、Contextを組み立てた同一snapshot時点の`revision`と`modified_at`が含まれます。取得根拠の監査や再取得要否の判断に使えますが、返却後の変更を防ぐものではありません。書き込み時は従来どおり、直前に`fetch`し直して得たrevisionを`expected_revision`へ渡してください。

`usage_receipt`は「候補になったこと」と「実際に使われたこと」を同一視しません。`context_candidates`はContext compilerが到達した`included + omitted_ids`、`context_included`は実際にbundleへ収録したsourceとして`observed`を返します。一方、別呼び出しの`search`結果との因果関係、回答での根拠引用、判断または操作への反映、結果検証はMCPサーバーから確認できないため、それぞれ`search_candidates`、`evidence_cited`、`decision_or_action`、`outcome_verified`を`not_observable`とします。このレシートは応答内だけの読み取り専用情報で、Vaultや別DBへ保存せず、検索順位・重要度・次回Context選定へ反映しません。

`state_lineage`は、起点ノートの現在revisionと、同じsnapshot・`as_of`・`temporal_perspective`で確認できた状態由来を分けて返す読み取り専用レシートです。validなState Noteがあれば、`current_states`へ状態値・有効期間・検証日・再確認日・revisionを返し、現在Stateの明示的な単一`source`だけを`explicit_sources`、同一subject内で解決できた有効な単一`supersedes`だけを`supersession`へ載せます。異なる状態値が同時にcurrentなら`conflicts`へ全対象を残して勝手に優先せず、`freshness`は`review_after`を過ぎたかだけを`current`または`review_due`として示します。State Noteや明示関係がなければ空の事実として断定せず`unknown`とし、本文中の一般Wiki linkから証拠・判断を推測しません。判断記録を識別する統一schemaはないため`decision_records`は`not_observable`です。これは完全なevent sourcing、監査DB、証拠の強さ、意味的な鮮度を表さず、Vaultへの自動書き込みや検索順位にも影響しません。

`build_context`も他のツールと同じく、text blockと`structuredContent`の両方へ同じ値を返します。2026-08-12のX1-T1で一度は`content: []`と`structuredContent`だけを返すstructured-only契約になりましたが、`content`しか読まないクライアント（Freebuff等）でbuild_contextが空に見える不具合のため、2026-08-16に全ツール共通の「text block + `structuredContent`」形式へ統一しました。structured-onlyはModel-visible token削減が未測定のままで、互換性の欠如だけが残っていたため廃止します。

valid frontmatterが`type: moc`のノートは、探索用のタイトル索引として扱います。`build_context`はMOCの説明文やリンク先・バックリンク本文を一括展開せず、Wiki linkのタイトル一覧だけを返します。読みたいタイトルを選び、そのノートを次の`fetch`または`build_context`で取得してください。MOC原本を読む`fetch`、`type: moc`でない通常ノート、時間指定時の安全な本文省略は従来どおりです。

質問が決まっている場合は`build_context`へ任意の`query`を渡せます。queryは最大500文字です。起点ノートと関連source本文の全体がbundle予算へ収まらない場合は、通常の起点ノートの見出しbranchを質問語で評価します。読点・句点・カンマ・セミコロン・疑問符・感嘆符・コロン・改行で区切られた原文フレーズと分割語の両方を使い、明示された各意図の最良branchを固定件数で打ち切らず先に確保します。複数意図が同じbranchへ集約された場合だけ、最大3branchまで総合scoreで補完します。単一語queryのために無関係なfallback branchを追加しません。本文を直接持たない親見出しは配下内容を含むbranchとして選べ、本文を持つ親見出しはその直接本文だけを投影して子階層を不必要に展開しません。ancestorとdescendantの重複本文も出しません。選択branch全体が投影予算へ収まらない場合は、全選択見出しを先に確保してから各branchの本文へ残余予算を公平配分します。投影した起点ノートは、投影前後の文字数が同じ場合も関連ノートより先に必要文字数を確保し、残余予算をMOCやその他の関連sourceへ配分します。全candidateが予算内の場合、一致branchがない場合、MOC、State/Event Noteは変更しません。query無しで到達できる候補やMOCタイトルは削除せず、関連する通常ノート本文の収録優先順だけを変えます。予算内に本文を収録しなかった候補は`omitted_ids`へ残るため、必要ならそのノートを次の`fetch`または`build_context`で取得してください。query本文そのものはContext Markdownへ重複掲載しません。

任意入力:

- `query`: 最大500文字の質問または検索意図。bundle予算が競合する時の通常起点ノートの関連見出しbranch投影と、関連する通常ノート本文の展開優先に使います。明示された複数意図は固定3件で打ち切りません。MOCのタイトル一覧とcandidate到達性は変えません。
- `as_of`: ISO 8601の日付またはタイムゾーン付き日時。指定時点で有効だった状態と、その時点までに発生した出来事を選びます。
- `temporal_perspective`: 既定の`valid-time`は「その時点で実際に有効・発生していた情報」、`knowledge-time`は`observed_at`を使って「その時点までにTSUZUNEまたはAIが知っていた情報」を選びます。`knowledge-time`で`observed_at`がなければ推測せず省略します。

出力には`as_of`、`temporal_perspective`、`temporal_status`、`selection_reasons`、`warnings`、`usage_receipt`、`state_lineage`が含まれます。明示した過去時点では、有効時点を持たない通常ノート本文を現在知識として遡及利用しません。該当本文は省略し、`content_omitted: true`と`UNSCOPED_NORMAL_CONTENT_OMITTED`警告で対象Pathを示します。起点自身が未来のState/Event Noteまたは指定knowledge-timeで未観測なら、その本文も省略します。該当するState Noteがなければ、通常ノートの更新日時から過去状態を推測せず「不明」と扱います。

## Vaultの切り替え

MCPサーバーは、各ツール呼び出し時にTSUZUNEの設定を確認します。TSUZUNEアプリで別のVaultを開けば、次の呼び出しからそのVaultへ切り替わります。

固定したVaultを使う場合は、MCPサーバーを直接次のように起動できます。

```powershell
node out/mcp/server.js --vault "C:\path\to\Vault"
```

## データと安全境界

- Codex登録面の`search`、`fetch`、`get_backlinks`、`build_context`、`list_directory`、`preflight_move_entry`、`preview_drive_sync`は読み取り専用です。direct serverだけの`suggest_links`も読み取り専用です。
- `get_backlinks`はlegacy `50_履歴`を常に除外し、除外後の総数を`total`で返します。続きがあれば`next_after`を次回の`after`へ渡します。ページはsnapshotではないため、同時変更をまたぐ厳密な棚卸しは先頭から再取得します。
- `list_directory`は本文を返さず、depth 1〜3、最大200件、`after`／`next_after`でページングします。先頭ページの`fingerprint`を後続ページの`expected_fingerprint`へ渡すと、同じpath／depth範囲の順序付きpath・type・file size・更新時刻が変わった場合は`FILE_CHANGED`で拒否します。範囲外の変更では拒否せず、snapshotや本文hashではないため、不一致時は先頭ページから再取得してください。
- `create_directory`は既存親フォルダの直下に1フォルダだけ作成します。同名項目を上書きせず、不足する親フォルダを自動作成せず、AI変更不可・Review対象・内部管理フォルダを拒否します。
- `create_note`は既存ノートを上書きせず、親フォルダも自動作成しません。
- `create_derived_note`は`01_受信箱`または`40_情報源`のMarkdownを原典としてread-onlyで参照し、取得時revisionが一致する通常案件だけを`30_知識`へ直接作成します。重複単位は原典revisionと`derivation_key`の組で、一原典から複数概念を安全に分離できます。内部ではAI Reviewと同じカテゴリ・原典link・保存先検証を通し、旧proposalは現在のpath・metadata・本文と完全一致する場合だけ適用し、不一致なら現在の抽出結果へ置き換えます。
- `propose_derived_note`は`01_受信箱`または`40_情報源`のMarkdownを原典としてread-onlyで参照し、取得時revisionが一致する場合だけ`30_知識`の新規作成proposalをAI Reviewへ登録します。原典は変更せず、承認前に保存先を作成しません。
- `update_note`は`fetch`で得た改訂トークンが一致する場合だけ、本文全体を更新します。
- `autonomous_update_note`は履歴を生成せず、revision一致時だけ通常ノートを自動更新します。指定した`expected_revision`が古い場合は本文が同一でも先に拒否し、本文が完全に同一なら`unchanged: true`を返します。原文・会話ログの自動更新には使いません。
- `preflight_move_entry`と`move_entry`は起動中アプリの共通coordinatorを通り、UIと同じfilesystem・Drive台帳・復旧経路を使います。古いfingerprint、衝突、保護領域を拒否し、アプリ停止中は直接実行へfallbackしません。対象はM1では単一Markdownだけです。
- `trash_entry`はMCPから既存のVault内`.trash`経路を直接使い、デスクトップアプリが起動していなくても動作します。AIからは`01_受信箱`のMarkdownだけを対象にし、利用者の明示依頼、`fetch`したrevisionの一致、Wiki-link参照ゼロが必要です。永久削除と`40_情報源`／`50_履歴`は公開しません。
- direct serverの`add_link`は既存Markdownノート同士だけを対象にし、重複、自分自身へのリンク、保護対象、古いrevisionを拒否します。
- 原典の`40_情報源`とlegacyデータの`50_履歴`は常にAI書き込み不可です。`create_directory`、`create_note`、`update_note`、`autonomous_update_note`の全経路で拒否され、`fetch.metadata.editable`は`false`になります。
- 10万文字を超えるノートは途中までしか取得できないため、MCPからの更新を拒否します。
- Codex登録面では永久削除・強制上書きはできません。受信箱原典の復元可能なtrashだけを上記条件で許可します。通常のノート移動は`preflight_move_entry`のfingerprintを確認してから、確認付き`move_entry`で一件だけ適用します。フォルダ移動はM2まで公開しません。
- Vault外の相対パス、絶対パス、シンボリックリンクは既存のVault境界で拒否します。
- OpenAI APIキーは不要です。
- MCPからGoogle認証を実行したり認証tokenを取得したりはできません。Drive同期は、起動中のデスクトップアプリが`127.0.0.1`に公開するrandom capability付きbridgeを通じて、preview／applyを明示的に分離して実行します。アプリ停止中はfail-closedとなり、apply時も既存serviceがlocal／remote状態を再検査します。UIとMCPの同期操作は同じ直列queueを共有します。
- WindowsでTSUZUNEのウィンドウを閉じると、保存確認後に通知領域へ隠れ、MCP bridgeは利用可能なまま残ります。通知領域の「終了」で明示終了した場合だけbridgeも停止します。バックグラウンド常駐は自動同期を意味しません。
- AIがツールを呼んだとき、その検索結果や取得本文は回答用コンテキストとして利用中のモデルへ渡ります。

## 登録解除

```powershell
npm run mcp:unregister
```

TSUZUNEが追加したコメント付きブロックだけを削除し、変更前の設定をバックアップします。反映にはCodex Desktopの再起動が必要です。

## ChatGPTについて

ChatGPTはローカルの`~/.codex/config.toml`やSTDIOサーバーを直接読みません。ChatGPT連携には、後の段階でリモートMCP化またはSecure MCP Tunnelが必要です。v0.2のlocal scopeは、ローカルデータを外部公開しないCodex Desktop連携です。

公式資料:

- [Model Context Protocol](https://developers.openai.com/codex/mcp)
- [Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
