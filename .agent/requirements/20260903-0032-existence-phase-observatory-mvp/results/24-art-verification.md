# 24 Art Verification — final read-only pass

## 対象・方法

- 対象: `http://127.0.0.1:4174/` の隔離 Vite prototype、Archive Weather。
- 状態: 親から「FBO completeness guard を含むこれ以後変更しない凍結候補」と通知された後に reload し、観察を再開した。
- 方法: read-only browser observation。実装、TSUZUNE、packet は変更していない。
- 時間: 凍結候補での wall-clock 観察は少なくとも 90 秒（reload 後の約 0 秒、55 秒、90 秒超で静止画を確認）。UI に simulationTime 値は露出しておらず、simulation seconds は直接計測不能。したがって本記録の「90秒」は wall-clock evidence であり、simulation-time 90 秒の証明ではない。

## 観察証拠

### 凍結候補の 90 秒

- 開始時は暗い背景に淡い点が散る。約55秒には左右を横切る広い、ゆるく曲がる directional sheets が見え、90秒超では再びかなり暗く疎な状態へ変化した。
- この範囲では、ノード、ノード間の線、ラベル、中心へ吸い込む固定渦、四隅に反復する格子は観察されなかった。R5 の「固定 vortex lattice」と同一には読めない。
- 一方、最初の静止画だけを見れば「暗い粒子が動く画面」と読める余地がある。時間経過で場へ変わるが、first-impression の generic-particle risk をゼロにはできない。

### Vault aggregate / matched control

- 制作情報パネルは Vault aggregate と Matched control の排他的な切替を提示し、Vault aggregate が既定選択だった。
- パネルは、本文・題名を含まない集約 snapshot の「空間・時間・scale」の三系統を弱い入力として別々に用いること、光・流れ・密度・空白を価値、重要性、意味、同一性、存在相として扱わないことを明記していた。576 notes は粒子数・明るさには不使用、`50_履歴`、raw labels/content、attachments は除外とも表示された。
- pass 中、matched control は Vault aggregate と異なる、より拡散した点群的な画面として観察できた。これは「対照が無い」状態ではないことの機械的証拠である。
- ただしその control の長い静止画比較は、後続の hot reload より前の画面で取得した。凍結候補では90秒 Vault 観察を優先したため、同一凍結版での control 再比較は未実施。よって「対照が切替可能」は PASS、「凍結版で知覚可能な因果差がある」は未確認のままとする。

### 操作と UI

- pass の先行画面では、一時停止を切替えると表示が `再生` になり、約10秒の静止中は画面が変化せず、再生後に変化を再開した。pause/resume の機械動作はそこで確認した。
- 凍結候補では情報パネルと `一時停止` checkbox の存在まで確認したが、freeze 後の pause/resume 再試験は実施していない。従って凍結候補への pause/resume 合格を主張しない。
- 画面上の常時操作は右下の停止・制作情報だけで、小窓 UI や Graph preview は観察されなかった。情報パネルは開いたときだけ表示され、閉じられる。
- ただし左下に `Archive Weather — 観測中` の常時 caption が視認できた。art-direction の「art surface に title/caption を置かない」条件に対する **P1 UI intrusion** である（アクセシブルな名称とは区別し、視覚 caption を指す）。

## 判定

| 論点 | 機械的判定 | 根拠／限界 |
| --- | --- | --- |
| runtime blocker | PASS | 凍結後に再現する runtime failure は観察されなかった。 |
| node graph / constellation | PASS（90秒範囲） | ノード、接続線、ラベル、中心構造なし。 |
| fixed vortex / permanent cluster | PASS（90秒範囲） | 55秒・90秒超で固定渦・常駐クラスタなし。ただし12分検査は未実施。 |
| generic particle demo | 条件付き PASS / P1 risk | sheets は demo の単純反復から離れているが、開始静止画は粒子画面に読める。 |
| Vault と control | 部分 PASS | 切替と差は観察したが、凍結候補での長い paired comparison は未実施。 |
| pause/resume | 先行画面で PASS、凍結候補は未再確認 | hot reload で候補が変わったため分離して扱う。 |
| UI 内小窓化 | P1 FAIL | 常時視覚 caption が残る。操作ボタン自体は最小。 |

## Capture limitation

先行観察中に一度だけ browser の `Page.getLayoutMetrics` capture timeout が起きた。その直後の snapshot は回復し、凍結候補の reload 後には再現しなかった。親の指示どおり、これを prototype runtime defect には数えない。capture tooling の一過性制約として記録する。

## 結論と受入境界

**mechanical verdict: 条件付き PASS。** 凍結候補は少なくとも90秒の観察で node graph、constellation、固定渦格子という主要な失敗形から外れており、制作情報の非意味化・privacy boundary と aggregate/control の構造も確認できた。再現 runtime blocker はない。

**owner aesthetic acceptance: 未承認。** これは単に「動く粒子」から抜けたという機械的な暫定判定であり、「自分のノートが芸術になる」「高級 screensaver として長く観たい」の受入ではない。常時 caption は直ちに解消対象の P1 であり、開始時の粒子印象も残る。凍結候補について、少なくとも次を owner が行うまで aesthetic PASS は出さない。

1. 同一候補で Matched control と Vault aggregate を90秒ずつ盲検比較し、制作者が理由を後付けせず三つの知覚差を言えること。
2. 12分連続観察で固定 loop、3分常駐クラスタ、疲労、操作を探す誘惑を確認すること。
3. 翌日に戻り、内容を読まない状態でも「また見たい」と判断するかを記録すること。

