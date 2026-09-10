# S2 Context本文の変換種別 — 2026-09-09

利用者の「1に取り掛かって」により、優先順位1位のA2／S2を単独で選択した。AIへ渡した内容が通常本文・質問に合わせた節選択・MOC索引・本文省略のどれかを返し、追加取得の判断材料を明示する。画面構成とノート本文は変えない。

## 実装と契約

- coreの収録元に必須の `contentMode`、MCP `build_context.included[]` に必須の `content_mode` を追加。値は `full_note`／`section_projection`／`moc_index`／`body_omitted` の4種。
- 種別は候補構築・実際の本文変換で設定する。seed、outgoing、backlink、temporal経由のMOCを扱い、時点制約で本文を省く場合は `body_omitted` を優先する。
- `full_note` は変換経路名。`truncated: true` と併存でき、全文受領を意味しない。節選択が全節を含んでも投影経路なら `section_projection`。bundle全体と各sourceのtruncatedは既存の意味を保つ。
- 本文、候補・収録順、文字数、revision、modified_at、selection reasons、omitted、warning、usage receiptの観測境界を維持する。旧serverでfieldがない場合は種別不明とし、full_noteへ補完しない。
- 新規依存、parser、cache、I/O、専用画面、自動fetch、回答利用率は追加しない。設計正本は [design.md §4](../../.agent/requirements/20260906-0410-ai-reuse-contract/design.md#4-変更候補s2-contextの本文変換を明示)、呼出し案内は [MCP integration](../mcp-integration.md#context本文の変換種別)。

## 検証済みのsource境界

| 検査 | 結果と証明する範囲 |
|---|---|
| 既存core testへのassert追加 | 実装前はfield不足で14 FAIL／41 PASS。実装後55 PASS。通常本文、節選択、各MOC経路、時点省略、切断との独立性 |
| MCP service | 74 PASS。実serviceの4種、既存revision・本文省略等との整合 |
| 独立した実装前後比較 | 8 fixture×3予算の24ケースPASS。新fieldだけを除いたbundle全体が一致し、直接／snapshot経路も一致。入力ノート不変。E2・E3に関係するMOC／節選択と時点制約を含む |
| 必須source検査 | typecheck、全1,222 tests PASS（既存1 SKIP）、MCP contract、check:mcp PASS |
| review | core経路の独立read-only確認と親の統合差分確認でblocking findingなし。Ponytail reviewで不要な抽象化・依存なし |

固定比較は local [script](../../work/s2-content-mode-20260909/compare-core.mjs)／[24ケース結果](../../work/s2-content-mode-20260909/core-comparison.json)。実MCP通信の4種とschemaは local [確認script](../../work/s2-content-mode-20260909/check-mcp-modes.mjs)／[通信結果](../../work/s2-content-mode-20260909/mcp-modes.json) に記録する。これらは除外された作業証拠で、永続的な別test runnerを増設したものではない。

## 本番baseと完了条件

着手前に19:39:46Zのinstalled receiptに対応するsource archiveを再hashし、1,616 filesの一致を確認した。現行との差は直前の優先順位整理に属する3文書だけで、製品sourceは検証済み本番baseと一致した。既存dirty変更をGit HEADへ戻さず、この境界からS2差分を確認した。local [base監査](../../work/s2-content-mode-20260909/baseline.json) を参照する。

この文書を含むfingerprint対象の資料を確定してから `npm run production:update` を実行する。完了は対応する [本番receipt](production-update-latest.json) で全gate・隔離packaged／installed smoke・built/installed exeとapp.asar hash一致・通常profile不変・Codex登録更新を確認し、Vault `TSUZUNE-S2本文変換種別-実装本番受入-2026-09-09` に最終証拠と同期結果が揃った時点とする。成功後はfingerprint対象を変更せず、実行結果をreceiptとVaultへ保存する。

既存Codex接続が旧buildを保持している場合は、再接続後に新fieldとfresh runtimeを確認する。旧接続のまま現在の新契約を確認したとは扱わない。別client全般の未知field互換、実AIの追加取得判断の改善、日常の誤答減少、利用者受入はこのfixture検査の証明範囲に含めない。Git公開は今回の依頼範囲にない。
