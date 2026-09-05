# Life Weather Gate 0 — 時間証拠の棚卸し

- 実施日: 2026-09-04 JST
- 対象: 本番TSUZUNEが開いているactive Vault
- 操作: read-only集計、source/installed bundle照合、既存test実行
- 非対象: 描画、粒子力学、Vault本文、保護履歴、製品反映

## 判定

**Life Weather／人生の時間モデルとしては STOP。Gate 1へ進めない。**

通常表示対象598ノートの時刻は全件取得できるが、範囲は2026-07-30から2026-09-03までの約5週間、作成日が存在する日は30日、月は3か月（実質7月末から9月初頭）だけである。これは「人生の地層」や、遠く離れた時期からの「回帰」を資料駆動で成立させる幅ではない。

加えて、現在の `createdAt` は真の執筆時刻ではない。初回はWindows filesystemのbirth timeを採り、その後TSUZUNE内の移動で失われないようsidecarへ保存した「TSUZUNEが知る最初のファイル作成時刻」である。コピー、移行、同期、取込の時刻である可能性を排除できない。

この証拠だけで続けられる最小の別表現は、人生ではなく **「TSUZUNE Weather／現在観測できる約5週間の知識気象」** である。Life Weatherの再開には、今後の初見、更新、再接続を意味付きで長期間蓄積する別契約が必要になる。

## 実データ集計

| 項目 | 結果 | 解釈 |
|---|---:|---|
| Vault内Markdown総数 | 2,386 | hidden metadataは除外 |
| `50_履歴` | 1,788 | 保護・通常発見から除外。再活性化しない |
| 通常表示対象 | 598 | 観測宙域へ渡る母集団 |
| logical `createdAt`あり | 598 / 598 | 欠落0。ただし意味は真の執筆日ではない |
| `createdAt`の範囲 | 2026-07-30〜2026-09-03 UTC | 約5週間 |
| 作成日の異なる日数 | 30日 | 長期回帰には不足 |
| 作成月 | 2026-07: 31、08: 523、09: 44 | 87.5%が8月へ集中 |
| `modifiedAt`の範囲 | 2026-07-29〜2026-09-03 UTC | 同じ短期間 |
| sidecarと現在のFS birth timeが2秒超異なる | 459 / 598 | TSUZUNE内移動等を越えてlogical timeを保持している証拠 |
| temporal frontmatterを一つ以上持つ | 526 / 598 | 多いが、ほぼ同じ短期間の運用metadata |
| `observed_at` | 328件 | 有効値は概ね2026-08-03〜09-03 JST |
| `updated` | 493件 | template placeholder 1件を含み、実値は概ね2026-08-03〜09-03 JST |
| `created` / `created_at` | 40件 | 2026-08-14〜09-02中心。全体の6.7% |
| 日付名ノート | 3件 | 日記系列としては不足 |
| `02_デイリー` | 2件 | 人生の連続記録とはみなせない |

active MCPのroot listing fingerprintは `sha256:ff9cdb8ba8ff1ba79eeedb5715c5ed071ed0db48f6268dc531c1667726f7d25e`。MCPの階層別件数と直接read-only集計は、再帰階層分を加えると一致した。

## 属性契約

| 属性 | 取得元 | 実際の意味 | 欠落 | 更新性 | 使用可否 |
|---|---|---|---:|---|---|
| note id / path | current snapshot | 現在の識別子・配置 | 0% | rename/moveで変化 | 使用可。人生上の同一性とは断定しない |
| `createdAt` | `.tsuzune/graph-file-times.json`、初見時はFS `birthtimeMs` | TSUZUNEが保持するlogical file creation time | 0% | in-app moveで保持、再作成では更新 | 条件付き。`first-known-file-time`としてのみ使う |
| `modifiedAt` | current FS `mtimeMs` | 現在ファイルの最終書込時刻 | 0% | 保存・同期・外部編集で変化 | 使用可。出来事の発生日や意味変更とは断定しない |
| `created` / `created_at` | frontmatter | note author/toolが宣言した作成日 | 約93.3%欠落 | 本文更新に依存 | 補助証拠のみ。値の由来が揃っていない |
| `observed_at` | frontmatter | 記録が何をいつ観測したかの宣言 | 約45.2%欠落 | note contractに依存 | 対象noteで使用可。note creationとは分離する |
| `updated` | frontmatter | note contract上の更新日 | 約17.6%欠落 | 手動・tool更新に依存 | 補助証拠。FS mtimeとは別物 |
| current links | current Markdown graph | 現在解決できる明示関係 | noteにより不在 | 内容変更で更新 | 使用可。当時のlink状態ではない |
| past link/change history | 現行通常snapshotにはない | 取得不能 | 100% | なし | 使用不可。推測復元しない |
| deleted notes | 現行通常snapshotにはない | 取得不能 | 100% | なし | 使用不可 |
| `50_履歴` | legacy protected area | 過去の監査・更新資産 | 通常表示から除外 | protected/inert | 使用禁止。Life Weatherのために再活性化しない |
| 感情・意図・人生上の重要度 | 取得元なし | 取得不能 | 100% | なし | 推定・rankingしない |

## 実処理経路の根拠

- `src/shared/types.ts`: `NoteDocument` は `modifiedAt` とoptionalな `createdAt` を持つ。
- `src/main/vault.ts`: scan時に `mtimeMs` と `birthtimeMs` を読み、`graph-file-times.json` の既存値を優先してlogical creation timeを構成する。
- `tests/vault.creation-times.test.ts`: 初見時の記録、再scanでの不変、read-only scan、保存、rename/move、trash後のpath再利用を検証している。
- `src/renderer/App.tsx`: 通常発見・Graph・観測宙域は `50_履歴` を除外する。
- `src/core/graph.ts`: noteの `createdAt` をGraph nodeへ渡す。
- `src/core/graph-timeline.ts`: finiteな `createdAt` だけを時系列化し、fallbackで `modifiedAt` を作成日扱いしない。
- `src/renderer/components/DailyCalendar.tsx`: createdとmodifiedを別activityとして扱い、`50_履歴`を除外する。

installed app bundle（0.6.0）にも `graph-file-times.json`、`birthtimeMs`、`50_履歴` exclusionの処理が存在することをread-onlyで確認した。一方、production delivery statusは `mismatch` であるため、現在のdirty source全体とinstalled productionの完全一致は主張しない。

## Gate 0時点の当初停止理由（2026-09-04の起点採用により更新済み）

1. 5週間では、短期の活動密度変化は描けても人生の地層とは呼べない。
2. `createdAt`は執筆時刻、経験時刻、TSUZUNE取込時刻を識別できない。
3. 過去のlink状態・変更履歴・削除は通常正本から得られず、結び直しを歴史的事実として再構成できない。
4. 1,788件の保護履歴を使えば件数は増えるが、採用済みのprivacy・保護・通常発見境界に反する。

## 当初検討した安全な選択肢

### A. 当初推奨: TSUZUNE Weatherへ限定して続ける

- 母集団: 現在の通常表示対象598ノート
- 時間表現: `first-known-file-time` と `last-written-time` を明示的に分ける
- 現象: 約5週間内の発芽、短期再訪、同時期の空気
- 禁止: 人生、年代、遠い過去からの回帰、歴史的な結び直しという主張
- 完了境界: 描画前に、時間shuffleで現象が変わるprofile testを作る

### B. 当初案: Life Weatherを保留し、将来の証拠を育てる

- 今日以降、初見・更新・link再接続を意味別に保持する最小contractを別途設計する。
- Markdown正本を置換するDB、常駐daemon、過去の推測復元は加えない。
- 十分な期間と件数が蓄積した時にLife Weatherを再評価する。

### C. 不採用: 保護履歴や本文中の日付を推測で時系列化する

件数は増えるが、観測と対象、記録日と出来事日、原典と派生物を混同するため採用しない。

## 未確認境界

- 約5週間のTSUZUNE Weatherが芸術として十分かは、まだ描画も所有者鑑賞もしていない。
- frontmatter各fieldの記入主体・精度はnote群全体で統一されていると確認していない。
- installed productionとcurrent sourceはdelivery mismatchのため、Life Weather実装時には選んだsource boundaryで再検証が必要。

## 工房主による名称・起点の採用 — 2026-09-04

工房主は、約5週間しかないことを欠陥として補うのではなく、**TSUZUNEが観測を始めた時点をこの生命の始まりとする**方針を採用した。作品名は `TSUZUNE LIFE Weather` とする。

ここでの `LIFE` は人間の出生から現在までの生涯ではない。TSUZUNEへ記録された分節が、蓄積、再訪、結合、沈殿を始めてからの「TSUZUNE内で観測できる生」である。したがって約5週間は短すぎる人生ではなく、第一紀／誕生直後の観測期間として扱う。

Gate 0の計測事実は変更しない。変更するのは停止判定の前提だけである。`createdAt`を真の執筆・経験時刻と呼ばず、過去を推測せず、`50_履歴`を再活性化せず、表示を存在相そのものと同一視しない境界は維持する。

この採用によりGate 1は再開可能。最初のprofileは、現在観測できる598件と約5週間を母集団に、TSUZUNEの発芽、短期回帰、同時期の空気、合流候補を描画なしで構成し、資料shuffleで因果差が出ることを先に検証する。
