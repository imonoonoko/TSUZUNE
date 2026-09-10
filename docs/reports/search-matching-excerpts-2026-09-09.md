# S1 検索一致抜粋の実装 — 2026-09-09

検索結果に一致理由が出ない場合を改善した。例えば「再利用の導線」という検索で、本文後方の「再利用の話。」によって見つかったノートには、その箇所の原文を抜粋する。元の語句が本文にある時は従来の抜粋を優先する。

設計依頼後の利用者の「開始」に基づくS1単独実装。現在の進行状態は[PLAN Current Decision](../../PLAN.md#current-decision)、仕様と固定期待値は[設計](../../.agent/requirements/20260906-0410-ai-reuse-contract/design.md#31-s1単独の設計範囲--2026-09-09)／[受入表](../../.agent/requirements/20260906-0410-ai-reuse-contract/evaluation.md#71-s1の固定受入ケース--2026-09-09)を参照する。

## 変更と保持する境界

- `src/core/search.ts`の既存private helperへ省略可能なfallback語配列を加え、`searchRendererRanked`の正の検索語を持つ返却箇所だけから渡す。元の語句が不一致の時だけ、最初の本文一致位置、同位置なら長い語を選ぶ。
- 検索一覧とMCPの`results[].text`へ既存経路で届く。抜粋の前後幅・空白整形、候補・score・順序・metadata、filter／否定／phraseの意味は維持する。Quick Switcherの候補と順位も変えず、抜粋UIは追加しない。
- 旧`searchNotes`／`searchRendererNotes`は2引数のまま。新しい依存、parser、index、cache、API fieldは追加しない。S2、ハイライト変更、AI回答評価、Git公開はこのsliceの対象外。

## 実装で確認した証拠

| 検証 | 結果と証明する範囲 |
|---|---|
| 修正前の失敗 | 固定ケース追加後、coreで7件、MCPと検索一覧で各1件が想定どおり失敗。修正前の抜粋不足を再現 |
| 固定20ケース | 既存unit testへ移し、全PASS。実装直前baselineと全結果配列を比較し、excerpt以外のfield・順序と旧2関数の全返却値が一致 |
| 抜粋の差 | 全結果配列の比較では8ケースに差がある。設計時の「7」は各ケースの先頭結果だけの比較で、D20の後続結果にも改善が入る |
| 経路回帰 | search／parser／MCP service／FileTreeの4 files・143 testsがPASS。MCPのlimit・順序・fixture本文不変、実ranked結果の表示を確認 |
| 全体回帰 | `npm test`: 113 files・1,220 tests PASS、既存1 test SKIP |
| 独立差分review | correctnessとPonytailの観点でblocking findingなし。対象は製品1 fileとtest 3 files |

local証拠は[baseline比較script](../../work/s1-search-excerpt-20260909/verify-search-baseline.mjs)と[結果](../../work/s1-search-excerpt-20260909/source-verification.json)。本番Vaultや通常profileを試験データにしていない。固定ケースの成功をAI回答の正しさ、全文読取、日常の時間短縮や利用者受入とはしない。

## 本番への反映と完了判定

実装直前sourceと前回verified receiptのexact source archiveを比較した。差分はこの会話で扱った文書9件だけで、runtime／tests／package／configの差はなかった。旧installed executableとapp.asarも旧receiptのhashに一致する。[本番base監査](../../work/s1-search-excerpt-20260909/production-base-audit.json)を根拠に、今回の変更を加えたsource treeを既存production gateへ渡す。

この文書を含むrepo成果をgate前に確定する。`npm run production:update`がtypecheck、production test、MCP検査、build／installer、隔離packaged／installed起動、実行file hash、通常profile不変、source不変、Codex MCP登録を検証する。成功後の数値・hashは除外対象の[production receipt](production-update-latest.json)へ保存し、fingerprint対象文書へ後追い追記しない。

完了には、今回sourceのreceiptが`installed-and-verified`であることに加え、インストール済みbinaryを合成Vault・隔離profileで起動し、改善した検索抜粋と既存一致の保持を確認する。最終結果と通常profile保全はVault `30_知識/TSUZUNE-S1検索一致抜粋-実装本番受入-2026-09-09.md`へ一件に統合する。gate失敗時は本番反映済みとせず、その未完工程だけを再開する。
