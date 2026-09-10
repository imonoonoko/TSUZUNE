# AI再利用設計の3指摘 — 検証結果

検証日: 2026-09-06 JST。依頼「まずはそれぞれ検証から」に対する検証。対象は[技術設計](../../.agent/requirements/20260906-0410-ai-reuse-contract/design.md)、[要件](../../.agent/requirements/20260906-0410-ai-reuse-contract/requirements.md)、[受入設計](../../.agent/requirements/20260906-0410-ai-reuse-contract/evaluation.md)の設計レビューで挙げた3点。**3指摘とも成立する。ただし、実AIが誤読・不要取得・版混在を起こした実測ではない。** 設計書と製品コードの修正は行っていない。

## 結果

| 指摘 | 検証と結果 | 確認できた境界 |
|---|---|---|
| S1: 最初の分割語を抜粋すると既存の良い抜粋が退行する | 現行検索と隔離した候補処理で再現。完全句が後方にあり、その一部が冒頭にあると、候補案は完全句を表示しなくなる | 設計案の反例成立。現行製品がこの退行を起こしているという意味ではない |
| R2: 不要な追加取得が採点で落ちない | 実MCPの同じ本文に基づく2call／6callの構成例を比較。追加4fetchは監査のみ・同一revision。現行4採点軸にはこれをFAILへ変える条件がない | 評価基準の欠落。実行AIへの到達と実E3合格は未検証 |
| R6: 読取中の版変更に対するcallerの確認がない | 実MCPでA前半→変更→B後半を取得。単純連結はA/Bのどちらでもない。試験用のrevision照合は混在を拒否し、再読でBへ復帰 | サーバーは版変更の検出情報を返す。実AI callerが照合するかは未検証 |

## S1 — 既存抜粋の退行と改善側の対照

検索語は「再利用の導線」。現行の日本語分割で `再利用` と `導線` になる単純queryを使用した。現行の `searchRendererRanked` を既存loaderで読み、候補側では返却結果の抜粋部分だけを差し替えた。

- **退行例:** 一般語「再利用」が本文位置0、完全句「再利用の導線」が238にある。現行は後方の完全句を表示するが、「最初の分割語」案は冒頭の一般説明を表示し完全句を落とす。
- **改善例:** 完全句は存在せず、分割語が193／215にある。現行の先頭120文字には一致語がなく、分割語fallbackは後方の該当箇所を表示する。
- **限定した補正候補:** 既存の `excerptQuery` が本文に一致する場合は現在の抜粋を保ち、一致しない場合だけ分割語へfallbackする。この2例では退行を避け、改善例も維持できた。

候補集合とscore順が同じなのは、baseline結果の抜粋だけを差し替えた構造による。将来の製品実装で順位不変を検証した証拠ではない。parser、filter、否定、引用句全般はこの検証の範囲外。同位置は設計に合わせ長い語を優先し、親が提示した重複語境界もassertで確認した。

証拠: [script](../../work/ai-reuse-design-validation-20260906/s1/reproduce-s1.mjs)、[結果](../../work/ai-reuse-design-validation-20260906/s1/evidence.json)。

## R2 — 追加取得を見逃す採点条件

受入設計の固定8ノートを、そのままUTF-8/LFの一時Vaultに生成した。sourceから隔離先へbuildしたMCP bundleを、明示的な `--vault` と既存SDKで起動。通常質問からの盲検試行ではなく、評価者が選んだ経路で採点の反例を構成した。

実応答では、searchの後の `build_context(灯台)` だけで現採用・判定・制約・費用の本文とrevisionが揃った。4出典の本文は個別ブロックでも独立確認した。

| 構成例 | tool呼出し | 回答と根拠 |
|---|---|---|
| A | search＋Context、計2回 | 灯モデル、固定12枚、比較前の改善未確定、8GB、768×768、batch 1、1,800円、追加cloud課金未承認を出典付きで回答 |
| B | A＋同一版の4出典fetch、計6回 | Aと同じ回答。追加理由は監査のみで、本文不足や現在性の疑義はない |

記録上の本文と回答の支持・時点・追跡対応は成立する。両例で同じ本文が実行AIへ欠落なく提示されたと仮定すると、Bの不要取得だけでは現在の「到達／支持・充足／時点・不明／追跡」の判定が変わらない。R2の遵守を合格条件へ結び付ける必要がある。**この仮定を実AIの到達PASSへ置き換えない。** R1の盲検性、E3試行全体の合否、AIの実際の再取得傾向は評価していない。

初回の3回／7回構成には、基準側にも不要なContext取得があった。独立確認で検出し、基準例とは認めず[初回証拠](../../work/ai-reuse-design-validation-20260906/r2-traces-initial.json)を保持。不要な取得を除いたR2だけを再実行し、現在の2回／6回に補正した。初回を合格試行数へ数えない。

証拠: [MCP probe](../../work/ai-reuse-design-validation-20260906/mcp-probes.mjs)、[補正後の応答と構成例](../../work/ai-reuse-design-validation-20260906/r2-traces.json)。

## R6 — 異なる版の分割取得

別の一時Vaultに100,009文字のノートを用意した。Aは `A×100000 + LIMIT=100`、Bは `B×100000 + LIMIT=200`。fileのサイズとmtimeを同じに保ち、fixture所有者が意図的に本文を変更した。

1. 変更前の2回fetchは同一revisionでA全文と一致した。
2. Aの先頭100,000文字を得た後、Bへ変更。同じID・offset 100,000のfetchは `LIMIT=200` と異なるrevisionを返した。
3. A前半とB後半の単純連結は、A全文・B全文のどちらとも一致しなかった。
4. 試験用callerのID／revision照合はこの連結を拒否した。Bを取り直すと全chunkが同一revisionになりB全文と一致した。

サーバーが同一版と偽っているわけではなく、変更を検出する情報は返っている。この実験は既存fetch回帰が扱わない条件を実証した。試験用callerは固定順序での照合だけであり、任意のページ順序や欠落を扱う一般実装ではない。実Codexや他のAIが混在を破棄すること、および実利用中に混在したことは未確認。

証拠: [結果](../../work/ai-reuse-design-validation-20260906/r6-results.json)。長文全体を結果に複製せず、版・chunkのhash、metadata、短い末尾、assert結果を保存した。

## 検証の管理と次の判断

- 製品source4件と設計3文書を前後SHA-256で照合。hash不変。既存dirty変更を保持。
- R2の8ノートはbyte／mtime／directory・file構成が不変。R6は定義したA→B変更以外の差分なし。自動probeは本番Vaultを開いていない。
- sourceから別出力先へMCPをbuildし、そのbundleでprobe実行。bundle hashとsource hashは[統合検査](../../work/ai-reuse-design-validation-20260906/verification.json)に保存。本番binary・登録・設定の変更なし。
- search_review（指定 `gpt-5.6-sol / high`）はS1の隔離scriptと証拠を所有。親は実処理との照合、同位置境界の追加確認、R2/R6、統合を担当。eval_design_review（指定 `gpt-6-astra / high`）はR2/R6をread-onlyで独立確認した。
- 検証用scriptの修正と関係probeのみ再実行。全製品test、S0の5問の実AI評価、本番更新は今回実施していない。使用Skill: ai-coding-operator、Ponytail、tsuzune、tsuzune-execution-record。

設計への次の補正候補は、S1の既存一致優先、R2の不要取得FAIL条件と条件未成立時の未検証扱い、R6の実caller未検証の明示。この検証依頼では補正を実施していない。結果だけで検索やContextの全面改修を採用しない。
