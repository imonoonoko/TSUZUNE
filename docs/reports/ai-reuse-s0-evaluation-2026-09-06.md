# AI再利用 S0 — 隔離した実AI評価

実施日: 2026-09-06 JST。対象: [受入設計 E1〜E5](../../.agent/requirements/20260906-0410-ai-reuse-contract/evaluation.md)。現在の実行状態は[PLAN.md](../../PLAN.md#current-decision)を正本とする。

## 結果

**5問とも、取得した本文が回答を支え、必須条件を満たした。** 共通読取ガイドと既存MCPを使ったこの短文fixtureでは、回答失敗を直すための製品変更は必要にならなかった。Contextへの収録だけで判定せず、実行AIに提示されたtool出力と最終回答を照合した。

| Case／確認対象 | 到達 | 支持・充足 | 時点・不明 | 追跡 | 追加取得 R2 | MCP calls |
|---|---|---|---|---|---|---:|
| E1 現行採用と開始日 | PASS | PASS | PASS | PASS | PASS | 2 |
| E2 過去時点の採用 | PASS | PASS | PASS | PASS | PASS | 2 |
| E3 複数資料の手順・制約 | PASS | PASS | PASS | PASS | N/A | 7 |
| E4 資料にない停止温度 | PASS | PASS | PASS | PASS | PASS | 4 |
| E5 採用記録の矛盾 | PASS | PASS | PASS | PASS | PASS | 2 |

R2は4ケースで条件成立下の遵守を確認した。E3は必要本文とrevisionが一回のContextに揃う場面がなく、N/Aとする。**R6の長文取得途中の版変更に対する実callerの遵守は未検証**。S0成功を全要件達成へ読み替えない。

## 実行条件と検証境界

- [固定8ノート](../../.agent/requirements/20260906-0410-ai-reuse-contract/evaluation.md#3-固定8ノート)を表からそのまま生成し、E5だけ定義済みoverlayを適用した。5ケースで一時Vaultを分離し、全mtimeを2026-08-26T00:00:00Zに固定。生成後に本文を追加・補強していない。
- 実行担当はケースごとに履歴継承なしの新しいAgent。5担当ともhostが受理した指定は`gpt-6-astra`／`high`。質問・開始日時・[共通読取ガイド](../../work/ai-reuse-s0-20260906/runner-guide.md)・CLI利用法だけを渡し、oracle、期待ID、回答例は渡していない。
- `node scripts/build-mcp.mjs --outfile work/ai-reuse-s0-20260906/server.js`で既存sourceを別出力へbuild。既存SDKの一回限りのstdio接続で`--vault`を明示し、`search`／`fetch`／`build_context`だけを許可した。SDK・package追加、登録変更、常駐runtime追加はない。通常の本番MCP経路やinstalled binaryの試験ではない。
- CLIは許可外tool、引数追加、Vault overrideを起動前に拒否し、応答エラー・structuredContent欠落を失敗にする。成功／接続失敗／呼出し失敗でcloseする境界を模擬検査し、別の一ノートfixtureで実MCPの成功とエラー拒否も確認した。この接続確認はE1〜E5の試行に数えていない。
- 全ケースの実行時tool入出力を独立確認し、fixture直読、oracle漏れ、他の知識取得経路、本番MCP利用、実行側表示切断は観測されなかった。共有filesystem上の行動制約であり、技術的sandboxとは主張しない。
- 各ケースは初回一回。回答の修正・再試行・利用者への補足質問なし。MCP実呼出しは合計17回（search 9、build_context 6、fetch 2）。tool回数は実績であり、最短手順や改善率の証拠ではない。

実MCPの参照日時は[call-index.json](../../work/ai-reuse-s0-20260906/call-index.json)に保存。現行ケースは`as_of`省略で、返却時刻は2026-09-05T20:22〜20:23Z（9月6日05:22〜05:23 JST）。E2だけ`as_of: 2026-08-10`を指定した。

## 回答と根拠の照合

| Case | 初回の回答と取得根拠 | 取得の判断 |
|---|---|---|
| E1 | 現採用本文の「灯モデル」「開始日は2026年8月20日」、有効開始と旧採用への`supersedes`を使って回答 | search→project Contextの2回で必要本文とrevisionが揃い終了 |
| E2 | 旧採用本文の「夜モデル」と8月1日〜20日の有効期間を使って8月10日の回答を作成 | 過去指定Contextの旧採用を使用。省略された通常本文や未来の変更を当時の根拠に使っていない |
| E3 | 灯モデル、固定12枚、比較前の改善確定不可、8GB GPU、768×768、batch 1、上限1,800円、追加cloud課金未承認の8条件をすべて回答 | 判定Contextに不足した現採用を別Context、用語と費用をfetch。手順検索0件後に対象名で再検索し、固定12枚の所在・コマンド等は未確認と区別 |
| E4 | 制約本文を実取得し、質問に沿う検索をした上で「取得資料には停止温度を確認できない」と回答 | 「灯台 GPU 温度」0件で終了せず関連資料へ進む。Context後の「温度」検索は語彙漏れ確認。別の数値を温度へ流用していない |
| E5 | 灯モデルの現採用と波モデルの補記「既存の採用記録を置き換えたかは未確認」を双方引用し、現在の採用を一つに確定しない | 後の日付だけで採用を決めず、競合本文を読んで不整合を残した |

E3はcall 2の判定Contextに現採用と費用がなく、call 3の現採用Contextにも費用がない。全必須根拠が揃うのはcall 5の費用fetch後である。このためR2の「必要本文とrevisionが揃うContextを受領」は条件未成立。call 3でproject本文が同じrevisionで再収録されるが、未取得の現採用を得るための呼出しに伴う重複であり、監査だけの不要取得ではない。

E1／E2／E4／E5は必要本文とrevisionが届いた後に監査fetch／Contextを行っていない。E4の追加検索も含め、同じIDや呼出し回数だけで不要取得を判定していない。

主要主張14組の短い原文・同ID／完全revision・取得call・本文範囲を[claim-evidence.json](../../work/ai-reuse-s0-20260906/claim-evidence.json)へ保存した。E3回答のrevision先頭12桁は、この試行の完全revision集合で5件とも一意に照合できた。固定12枚の具体的内容等を引用から補ってはいない。

初回回答: [E1](../../work/ai-reuse-s0-20260906/cases/E1/answer.md)／[E2](../../work/ai-reuse-s0-20260906/cases/E2/answer.md)／[E3](../../work/ai-reuse-s0-20260906/cases/E3/answer.md)／[E4](../../work/ai-reuse-s0-20260906/cases/E4/answer.md)／[E5](../../work/ai-reuse-s0-20260906/cases/E5/answer.md)。全文会話や内部推論は記録しない。評価用の暫定tool応答全文は照合後に除き、呼出しmetadata、元応答hash、必要な短い原文と回答を残した。

## 不変検査と独立確認

- 全5Vaultで8ファイル・3ディレクトリの構成、全byte hash、mtimeが生成直後と一致。sidecar追加なし。
- source map内の製品source 18件と、build script・package 2件・既存MCP bundle・設計3文書の計25件は試行終了時まで不変。source mapの埋込本文とlive sourceをbuild時に照合済み。既存dirty変更を保持した。
- 評価bundle SHA-256: `1c35700be6551cf412a68afd0d74b02b7fefd926fcd1789afdb5d2bca95af623`。全source hash、Git状態、fixture manifestは[build-and-source.json](../../work/ai-reuse-s0-20260906/build-and-source.json)と[verification-before-close.json](../../work/ai-reuse-s0-20260906/verification-before-close.json)に保存。
- 実行終了後の評価server残存0。製品コード・既存tests・本番binary・Skill・MCP登録は変更していない。全製品testsやproduction updateは、この隔離評価だけのためには再実行していない。
- 親CEO-01がfixture、source照合、統合、未提示の実MCPエラー境界検査を担当。`search_review`（指定`gpt-5.6-sol`／`high`）はwork配下のCLIと検査だけを所有した。`s0_e1`〜`s0_e5`（各`gpt-6-astra`／`high`）は自分のrequestと回答だけを担当。`s0_grade`（`gpt-6-astra`／`high`）が正解条件と実行時tool出力から5軸をread-onlyで独立採点し、親の結論と一致。正本writeは親だけが行った。
- 使用Skill: ai-coding-operator、Ponytail、tsuzune、tsuzune-execution-record。実装補助は評価用CLIのみで、既存SDKと一回接続を選び、製品への評価基盤追加を避けた。

## 結論の限界と次の判断

この結果は、短い合成ノート・指定model・共通ガイド・評価CLIという条件で、本文取得から回答根拠まで対応したことを示す。ガイドなしとのA/Bではなく、ガイドの改善効果やモデル内部の因果的利用の証明ではない。本番の日常利用、長文や大きいVault、他modelの成功率、通常利用への読取契約の配布は未確認。

サーバーの`usage_receipt.evidence_cited`等は引き続き`not_observable`。今回の外部採点をserverの観測済みfieldへ転記しない。R6は先行の[版変更の隔離検証](ai-reuse-design-validation-2026-09-06.md)と実caller確認を分けたままにする。

S1の一致抜粋とS2の本文変換種別は設計候補のまま。本試行を理由に自動実装しない。次の価値確認は日常で生じた実際の質問に対し、必要本文と回答の対応を同じ基準で確かめること。失敗が出た場合は、検索・不足本文の追加取得・原資料・回答生成のどこで生じたかを絞ってから変更を選ぶ。新しい監視・ログ収集・自動化は設けない。
