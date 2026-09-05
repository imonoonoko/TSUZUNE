# レシートは引継ぎ判断を改善したか

2026-09-05 / sourceを使った隔離読取評価。製品変更・本番導入は行っていない。

## 結論

今回の3問では、新レシートによる判断の改善は観測できなかった。レシートなし・ありの両回答者が事前に定めた9項目をすべて満たし、重大な取り違えは0件だった。正答の根拠はいずれも既存の実施記録本文であり、新レシートの構造化fieldを追加の判断根拠として引用した回答は0件だった。

実装の削除や全面的不採用を意味しない。現実の3問に対する追加価値は未証明であり、これを根拠に本番導入を急いだり、次のレシート機能を自動実装したりする理由はない。

## 対象と方法

- 親がproduction TSUZUNE MCPのsearch/fetchで取得した4ノートを、本文改変やmetadata追加をせず隔離Vaultへ複製した。全Vaultのコピーや検索は行っていない。
- 既存のMCP build scriptでcurrent sourceを専用bundleへ構築し、専用Vault/profileで3回の`build_context`を実行した。登録済みMCPやinstalled appにこのbundleを接続していない。
- 各実応答を一度だけ生成し、一方からトップレベルの`usage_receipt`と`state_lineage`だけを除去した。本文・included・omitted_ids・warnings・as_of等の共通payloadはdeep equalityで一致を確認した。
- 30,000文字budgetで対象本文のtruncation / content omissionは0。質問に関係しない明示リンク先はこの4ノート取得範囲外である。
- 回答者X/Yは同じLuna・medium。full-historyを渡さず、割り当てたpacket以外の資料・他回答・採点rubricを見ない条件とした。親は独立回答後に事前rubricで採点した。親の採点は盲検ではない。
- 「現在」は取得した記録が表す時点の意味。回答者は本番を直接確認していない。

## 比較結果

| 問い | レシートなし X | レシートあり Y | 根拠として使われた情報 |
|---|---:|---:|---|
| Context利用レシート実装は終わったか、再実装すべきか | 3/3 | 3/3 | 本文のsource完了・本番未反映・停止線 |
| 古いHistory Store v2の次工程を再開してよいか | 3/3 | 3/3 | バックリンクで収録された後の履歴廃止記録 |
| 状態由来レシートを本番動作確認済みと報告してよいか | 3/3 | 3/3 | 本文のsource/installed/liveの区別 |
| 合計 | 9/9 | 9/9 | 全6回答の判断根拠は本文 |

- 重大誤り（誤った再開、本番導入済みの断定、物理削除認可の推測）: X 0 / Y 0。
- 事前rubricの確認事項欠落: X 0 / Y 0。
- 新レシートfieldにしかない事実を判断根拠にした回答: 0/6。
- この観測で「レシートが実際の誤りを1件防いだ」とは主張できない。

### 状態由来レシートの実際の出力

3応答とも`current_states / explicit_sources / supersession / conflicts / freshness`は`unknown`、`decision_records`は`not_observable`だった。取得した4ノートは`type: execution-record`であり、State Noteの構造化関係を持たない。`status: complete`や本文の置換説明だけでState由来が成立するわけではない。

特に履歴廃止記録には`supersedes current use of:`という本文の明示リンクがある。しかしレシートはこれを構造化supersedesとして推定しない。通常のbacklinkによって後の記録がbundleへ入り、両回答者が本文を読んで旧計画を再開しないと判断した。これは既存Context機能の価値であり、新レシートの効果へ付け替えない。

この`unknown`は「実際の置換や判断が存在しない」という意味ではない。さらに4ノートの限定取得なので、Vault全体にStateがないとも言えない。

### Context利用レシートの実際の追加情報

Context候補/収録IDは既存の`included + omitted_ids`から再構成でき、subject revisionも既存included metadataと一致した。下流の引用・判断採用・検証を`not_observable`と明記する価値はあるが、この比較でその追加表現による判断改善は見られなかった。

| 問い | レシートなしJSON文字数 | ありJSON文字数 | 追加 |
|---|---:|---:|---:|
| C1 | 9,644 | 10,672 | 1,028 |
| C2 | 17,871 | 18,976 | 1,105 |
| C3 | 9,632 | 10,655 | 1,023 |

空白整形なしのJSON文字数であり、token数・通信全体・課金額ではない。追加payloadが今回の回答を改善した証拠はない。

## 検証と取得境界

- `node .agent/requirements/20260905-receipt-utility-trial/evaluate.mjs`: PASS。3回の実stdio応答と固定比較packetを生成。
- `node .agent/requirements/20260905-receipt-utility-trial/verify.mjs`: PASS。共通payload同値、取得本文の同一性、候補/収録ID、未観測表示、本文の置換を推論しない境界、入力未切詰めを確認。
- 入力生成の前後ではsource全ファイル、登録済みMCP bundle、installed app.asar、production receiptのhash/mtime不変を確認。隔離Vaultも入力生成前後で不変。
- 回答・report作成後の追加同一性checkはFAIL。`src/core/frontmatter.ts`が入力生成後に変更されていた（本taskの編集対象外）。19:36:04 UTCの照合ではこの1ファイルだけで、登録済みMCP・installed app.asar・production receiptに変化なし。旧hash `290a0f01cc383fafd28c2d0d1118d0d95124d988bdc3cfc98f52ec52ffcde616`、新hash `9191cc414b2eb22e67741db3cd096e1282417504191d35c776b4b31380e78113`。`final-drift.json`へ保存した。
- この変更を戻したり、比較packetを生成し直したりしていない。結論は保存済みbundle・入力時点（19:31:30 UTC）に限定し、最新sourceで同じ結果になるかは未確認。回答shape検査は両者PASS。
- 親の現物照合: `src/mcp/history-store-v2-shadow.ts`は存在せず、現行server/serviceから旧`history_path` / `include_history` / shadowへの該当参照は検索で見つからなかった。これは履歴廃止本文と整合する限定source証拠で、installed全動作の検証ではない。
- 本taskによるproduct code変更なし。全test、production gate、installed smoke、利用者操作受入は今回実行していない。今回の隔離結果をlive受入と扱わない。
- fetchで記録したproduction revisionと、隔離Vaultのrevisionは異なる。`revisionFor`はVault root、path、mtime、size、contentを含むためである。元revisionと本文を`sources.json`へ残し、隔離本文の一致を別assertで確認した。隔離revisionをproduction更新へ使用しない。

## 限界と反証

- 3問だがC1/C3は同じ2ノートを順序を変えて使っており、独立した3タスクではない。実質2組の資料を使った限定比較。
- C1/C3の本文はレシート自身の説明を含む。その本文を削らない公平なfield除去比較なので、レシート概念全体の有用性ではなく、同じ本文に新fieldを追加する限界効用を見た。
- 各条件1回答者、同一model、1回ずつ。統計的差、他model、長期の誤り削減、時間短縮、cost改善は未検証。
- 関連4ノートが十分収まる条件であり、低budget、情報欠落、複雑なState競合、structured Stateが実在する場面の効用は評価していない。
- `unknown`が正しく返ることと、利用者が意味を正しく理解することは別。本試行では重大誤解は見られなかったが、UX受入の代替にはならない。

## 今回の提案と停止線

1. 維持: 実装を急いで取り消さず、限定的なread-only説明契約として保持する。
2. 優先しない: この比較を根拠にレシートの本番導入や追加実装を急がない。Context選外理由など別候補も自動採用しない。
3. 継続: 完了点、変更理由、古い方針の扱い、source/installed/liveの差を本文と既存リンクで明確にする既存の記録運用。
4. 再評価trigger: 自然な作業で、本文と既存Contextだけでは判断を取り違えた具体例、またはすでに存在する構造化Stateの由来を確認する需要が出た時。同じ問いで追加fieldが欠落を埋めるかを試す。
5. 行わない: 評価を通すためのState/metadata大量追加、新DB、監視、ランキング、常駐評価の導入。

これは評価に基づく推奨であり、ロードマップ変更・新機能採用・削除の承認ではない。

## 一時Agentと成果物

- 親: 本番MCPからの出典取得、隔離script、比較条件、採点、追加境界検証、reportの所有者。
- `receipt_reader_x`: Luna / medium、packet Xのみ読取、answers/x.jsonのみ書込。3回答を受領・採用。
- `receipt_reader_y`: Luna / medium、packet Yのみ読取、answers/y.jsonのみ書込。3回答を受領・採用。
- 両者とも本番TSUZUNE、製品source、他packet、他回答へのアクセスは禁止。回答内容の書換えや再試行要求はしていない。
- 引継ぎは各1 packet、再作業0。時間/costの比較はしない。同一modelの2回答を一般的な独立監査品質の保証とは扱わない。
- 改善判断: 回答者を分離する方法は条件間の文脈漏れを抑えるため維持。ただし有意差の証明には不足し、評価専用の常設Agent/DBは追加しない。

### 保存先と再実行

- 本directory: `plan.md`、`evaluate.mjs`、`verify.mjs`、本report。
- ignored `work/receipt-utility-trial-20260905/`: `sources.json`（4原文とproduction revision）、`vault/`、`responses/`、`packets/`、`answers/`、`evidence.json`（source/path/hash）、`verification.json`、`scores.json`、`final-drift.json`。
- evidenceはローカルのみ。ignored workを削除すると原文/回答の再監査ができなくなる。Gitへ自動追加しない。
- `verify.mjs`は保存済み比較入力を検証する。`evaluate.mjs`再実行は現在sourceと現在時刻でpacketを置換するため、過去回答との同一比較として扱わない。別評価は出力先を分ける。
- production TSUZUNEは明示した読取境界を維持し、今回の評価結果を書き戻していない。後続の知識正本への同期は未実施。Memory更新も行っていない。
