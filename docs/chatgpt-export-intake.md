# ChatGPT Export Intake

更新日: 2026-08-09

## 現在の範囲

C0-Aは、ユーザーが明示的に選んだChatGPTデータエクスポートから会話JSONだけを読み、ローカル作業領域へ確認用manifestとJSONLを生成します。入力元、稼働中のVault、既存ノートは変更しません。

この段階では次を行いません。

- 人物プロフィールや知識ノートの確定
- TSUZUNE Vaultへの適用
- 添付ファイルのコピー
- AIによる要約や分類
- 連絡先、請求、支払、顧客profile系CSVの取込
- Gitへの個人データ出力の収録

## 実行

出力先は入力元の外側にある、Git管理外のローカル作業フォルダを指定します。

```powershell
npm run preview:chatgpt-export -- `
  "C:\path\to\OpenAI-export" `
  "C:\path\to\local-preview"
```

生成物:

- `manifest.json`: 入力hash、entry hash、件数、警告、決定的content digest
- `conversations.jsonl`: 会話単位の正規化metadata
- `messages.jsonl`: messageの横断索引

出力には会話本文、タイトル、ローカル絶対パスが含まれ得ます。`containsPersonalData: true`と`intendedStorage: local_staging_only`を付け、Gitや共有Vaultへそのまま置かないでください。

## 正規化契約

- 現行分岐は`current_node`から`parent`を辿って復元する。時刻順には並べない。
- 旧分岐も`branch: old`として保持するが、候補抽出対象にはしない。
- messageの一意性は`conversationId + messageId`の複合キーで判定する。
- ID欠損時だけ、同じ入力から同じ値になるsynthetic IDを作り警告する。
- 小数を含むUnix秒、role、content kind、添付参照、source hashを保持する。
- `is_do_not_remember`は三値のまま保持する。trueの会話は候補抽出を禁止し、nullは後段でprivacy確認が必要な状態として残す。
- 添付payloadは分割ZIP全体の`.dat` basenameをcase-sensitive完全一致で索引する。substring、case fold、URL decodeによる推測はしない。
- C0-Aの`candidateEligible`は、現行分岐にあるuserの通常textだけを示す。候補であって本人事実の確定ではない。
- thoughts、reasoning recap、user editable context、assistant出力、旧分岐は人物情報へ自動昇格しない。

## 安全と再現性

- ラッパーは対象JSONだけを安全な一時フォルダへ展開し、処理後に削除する。
- 選択した入力ファイルを処理前後にSHA-256で照合し、途中変更を検出したら停止する。
- 同じ入力を二回処理したとき、record ID、record hash、content digestは一致する。
- malformed JSON、参照切れ、未知形式は警告または失敗として扱い、既存Vaultへフォールバック書込しない。

## 2026-08-08 検証結果

提供された公式Exportを別々のローカル出力先へ4回処理し、次を確認しました。本文、タイトル、ID値、ローカルsource pathはこの資料へ収録していません。

- 343 conversations、321 archived
- 4095 messages、4059 current branch、36 old branch
- duplicate conversation ID 0、duplicate conversation/message composite key 0
- current branchのuser plain textは854件。そのうち空または空白だけの11件を除外し、843件をcandidate-eligibleとした。これは候補索引であり、本人事実の確定数ではない
- 602 `.dat` entries、562 referenced entries、40 unreferenced entries
- 1079 unique attachment referencesのうち1074 resolved、big-paste系5 missing、ambiguous 0、unsupported 0
- content digest: `f092df0e9ed171263405bc67ef3a21d5a48cd583bedbceea3d63b59c73e98fa0`
- 4回のcontent digest、`conversations.jsonl` hash、`messages.jsonl` hashが一致
- 選択した4 source fileの前後SHA-256不一致0
- malformed JSON fixtureは非zero終了、入力hash不変、出力folder未作成
- C0-A匿名fixture 15/15、全383 tests、typecheck、MCP smoke、`git diff --check` PASS

5件のmissingはpayloadを推測生成せずwarningとして残します。preview outputは個人データを含むためローカルstagingだけに置き、Gitと本番TSUZUNEへ複製しません。

## C1-A〜C1-Cの現在地

C0-Aの843件を直接プロフィールへ書かず、出典付き候補previewと決定的な品質sampleを作成しました。C1-Cでは候補を自動適用、要確認、プロフィール除外へ分け、本文からprivacy reviewも判定します。候補ID、元message、時刻、content hash、抽出rule、全source referenceは維持します。

2026-08-09の公式Export再評価では799候補、863 source reference、追跡率100%、構造的混入0でした。C1-B固定57件の既知誤検出・unsafe自動適用は0件です。強化後の自動候補7件は全件reviewで安全でしたが、ruleごとの最低10件を満たさないため合格ruleは0件です。人物プロフィールへのwriteは0を維持し、C1-D Vault Applyへは進みません。

詳細は[C1-B品質較正](reports/chatgpt-candidate-quality-c1b-2026-08-09.md)と[C1-C適格性強化](reports/chatgpt-candidate-eligibility-c1c-2026-08-09.md)を参照してください。個人本文とreview表は引き続きGit管理外の`work/`だけに置きます。
