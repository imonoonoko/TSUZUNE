# レシート実用性の限定比較

## Task Contract

- objective: 実際の開発記録3例で、usage_receipt / state_lineageが引継ぎ判断の改善に寄与するかを確認する。
- deliverables: 固定入力、比較回答、再実行script、採点と限界を示す最終report。
- constraints: 製品code・本番runtime・本番Vaultは変更しない。取得した最大4ノートを改変せず隔離コピーする。metadata追記、全Vault取得、導入、候補実装は禁止。原本取得は親のMCPのみ。
- success: (1) 共通Contextが同一でレシートだけ異なる比較入力 (2) 3例の独立回答と事前rubricによる照合 (3) source/fixture限定の結論と再開条件を保存。
- lane: Orchestrated。状態正本はこのplan。比較条件を見ない独立回答が必要なため2回答者を使用する。
- evidence: `work/receipt-utility-trial-20260905/` の取得snapshot・source hash・MCP実応答・比較packet・回答、および本directoryのreport。
- stop: 上記3条件を満たした評価境界。評価結果を理由に製品変更・本番更新へ自動着手しない。
- 初期実行者 CEO-01、親が取得・固定条件・採点・成果物を所有する。Ponytailは評価用scriptのみ。TSUZUNEはread-only。今回のRead-only指定によりVault書戻しは行わない。

## 固定する問いと採点（回答取得前）

1. Context利用レシート実装: 今何が終わり、何が未確認か。実装を再開すべきか。
   - source実装/検証完了、installed/live未確認、再実装不要の3点。
2. History Store v2: 古いisolated runner計画と後の履歴廃止記録から、今runnerを再開してよいか。
   - 廃止が現行境界、旧記録は歴史証拠、legacy物理削除未承認の3点。
3. 状態由来レシート: source検証結果から、本番で利用可能/動作確認済みと報告してよいか。
   - source/installedを区別、本番/live未検証、導入scope確定と受入が必要の3点。

各点は回答に根拠つきで明記されていれば1、欠落/誤りは0（各例3、合計9）。誤った再開、未導入を導入済みとする断定、削除認可の推測は重大誤りとして別記。根拠が本文・既存metadata・新レシートのどこにあるか親が分類する。文字数はpayload指標でありtoken/costではない。

## 実行順

最終状態: complete（保存した入力・bundleの比較評価）。3回の実応答、独立回答2件、9項目の採点、追加境界検証、final-report保存まで完了。両条件9/9、重大誤り0。新fieldによる追加改善は観測されず。入力生成後に本task外のfrontmatter.ts変更を検出したため、latest source同一性checkはFAILとして記録し、最新sourceへの結果外挿はしない。本番Vaultはread-onlyのまま、評価知識の同期は未実施。

1. contracted: 4ノート以内をMCP取得し、revisionと時刻を保持して隔離Vaultに保存。
2. executing: current sourceを隔離bundle化。3回のbuild_context実応答から、レシートあり/なしpacketを作る。共通payload同値と保護対象hash不変をassert。
3. executing: 回答者2名が互いのpacket・rubric・回答・親の予測を見ずに回答する。
4. verifying: 親がrubric採点と非自明境界（不明を未存在と誤解しない、本文由来の置換を構造化証明と誤認しない）を確認する。
5. persisted / complete: reportを保存し、効率計測をfinishする。本番Vaultはread-onlyのまま。

## 回答者packet / 能力カード

- 役職: bounded回答試行。model: gpt-5.6-luna / reasoning: medium。得意: 提供資料の限定読取。上申: 資料不足・矛盾を不明と記す。必要context: 指定packetだけ。検証owner: 親。根拠: host対応metadata; 品質の一般化はしない。
- X owns: `work/receipt-utility-trial-20260905/answers/x.json` のみ。
- Y owns: `work/receipt-utility-trial-20260905/answers/y.json` のみ。
- 禁止: packet以外のrepo/Vault/web/memory/他回答の探索、製品変更、本番操作。並行作業を巻き戻さない。
- acceptance: 3回答があり、各回答に結論・根拠・未確認・次の確認がある。
- unseen check: 親が9点rubricと重大誤り、receipt由来の追加根拠を確認。
- 制限: 1 model・条件ごと1回答者・3例。統計的効果、盲検採点、継続運用の誤り削減は証明しない。新機能の自己説明を含む2記録は結果の天井効果を生み得る。
