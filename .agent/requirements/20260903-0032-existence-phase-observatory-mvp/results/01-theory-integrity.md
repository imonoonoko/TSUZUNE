# THEORY-01 — 観測宙域 MVP 存在相理論整合性監査

- 監査日: 2026-09-03
- 対象: 観測宙域／星巡り MVP の要件・語彙・表示規則
- authority: 理論監査結果。current CANON、本人採用、存在相理論の新命題ではない
- TSUZUNE route: read-only（本番Vaultへの書込みなし）

## 1. 結論

観測宙域MVPは、**存在相そのものを可視化する機能ではなく、取得済みのTSUZUNE Markdown記録を、宣言した条件のもとで選択・配置・強調する有限な表示**としてなら理論境界と両立する。星、星座、宇宙、距離、運動は鑑賞用の表示語彙であり、`W`、`P₀`、世界側の個体・関係・流れ・地形を指示しない。根拠: 「存在相理論 — 理論定義 Research v0.1」§1–3・§10、「存在相理論 — 知識構造MOC」崩してはいけない境界、「観測宙域 MVP Requirements」§1–2。

要件の中核である、明示Wiki linkだけをedgeにすること、固定clusterを正解として保存しないこと、観測断面を表示すること、通常グラフやMarkdownを変更しないこと、H1–H6と共同cycleを物理法則にしないことは維持すべきである。根拠: 「観測宙域 MVP Requirements」§2・§4、「観測宙域 MVP Scope」MVP／Out Of Scope／Constraints、「存在相理論 — 理論定義 Research v0.1」§4・§10。

一方、現行UI案の「Vault全体／現在」「知識宇宙」「星座が現れる」「未解決はamber」は、説明なしでは網羅性、世界そのもの、実在的集団、根拠のある認識状態を暗示し得る。MVPではcaptionとhelpで表示対象・読取時点・選択規則・欠落状態を明示し、根拠のない「未解決」符号化は採用しない。**これは監査からの推論／設計提案であり、本人採用済み命題ではない。** 根拠: 「存在相理論 — 理論定義 Research v0.1」P1・P3・P4・§5、「存在相理論 — 全体整理・現在地 v0.2」§3–4、「観測宙域 MVP UI Prompt」Primary Components／Design Tone。

## 2. 守るべき語彙と指示対象

| 語彙 | このMVPで守る意味 | 表示上の規則 | 根拠ノート |
|---|---|---|---|
| 世界 `W` | 人間の区分・命名・測定・modelより先にあると置かれる世界 | 画面、Vault、graph、全ノート集合を`W`と呼ばない | 「存在相理論 — 理論定義 Research v0.1」§2・P0 |
| 存在相そのもの `P₀` | 「ある」が現実でどう成立するかという問いのworld-side referent。新物質・場・力・量・modelではない | 描画対象にしない。「P₀を可視化」「存在相マップ」と説明しない | 「存在相理論 — 理論定義 Research v0.1」§1–2・§10、「存在相理論 — 知識構造MOC」崩してはいけない境界 |
| 局所存在相記述 `D_c(x)` | 文脈`c`のもとで暫定対象`x`について作る有限な回答。`D_c(x) ≠ P₀` | MVP画面を自動的に`D_c(x)`と呼ばない。対象`x`、条件`c`、型、出所、失敗条件を伴うResearch記述を実装した場合だけ限定使用する | 「存在相理論 — 理論定義 Research v0.1」§2・P1・P4 |
| 存在相理論 `T_EP` | `P₀`を局所記述で探究する定義・仮説・比較・provenance・誤り検出・改訂規則 | scene selector、force simulation、camera、画面全体を`T_EP`と同一視しない | 「存在相理論 — 理論定義 Research v0.1」§2・§6 |
| 観測条件 `c` | 少なくともdomain、scale、boundary、observation protocol、time windowを含む | caption/helpから、表示対象、単位、範囲、選択規則、読取時点を確認可能にする | 「存在相理論 — 理論定義 Research v0.1」§2・P1・P3 |
| 観測断面 | Vaultの記録から表示規則で得た有限なpresentation | user-facingの主要語として使えるが、「存在相の断面」ではなく「Vault表示の断面」と定義する | 「観測宙域 MVP Requirements」§1–2・§4、「存在相理論 — 理論定義 Research v0.1」P3 |
| 星 | 一つの取得済みMarkdown noteを表すvisual token | 世界側の個体、存在相、真理単位とは呼ばない | 「観測宙域 MVP Implementation Brief」Technical Assumptions、「存在相理論 — 全体整理・現在地 v0.2」§3・§5 |
| 明示リンク | Markdownに保存されたWiki linkの表示 | relation一般、因果、意味類似、存在論的結びつきへ拡張しない | 「観測宙域 MVP Requirements」§2・§4、「存在相理論 — 理論定義 Research v0.1」P2・P4 |
| 星座／注目場面 | 宣言したselectorが一時的に選んだnote集合 | 「本当の集団」「新しい個体」ではなく、「この規則で注目中の集合」と説明する | 「観測宙域 MVP Requirements」§2・§6、「存在相理論 — 全体整理・現在地 v0.2」§3・§5 |
| 距離・運動 | d3-force layout、camera、zoom／pan、opacityの画面状態 | 意味距離、存在度、世界側の流れ、知識の生成・消滅と呼ばない | 「観測宙域 MVP Alternatives」Codebase Findings、「観測宙域 MVP Implementation Brief」Technical Assumptions、「存在相理論 — 知識構造MOC」崩してはいけない境界 |

### 観測条件 `c` のMVP最小開示案

**推論／設計提案:** 内部的には表示条件を `c_view` として、次の5項を必ず保持する。これは`D_c(x)`や`P₀`の数学化ではなく、表示の説明責任を満たすためのview metadataである。根拠: 「存在相理論 — 理論定義 Research v0.1」§2・P1・P3・P4、「観測宙域 MVP Requirements」§2・§4。

| 条件 | MVPでの値 |
|---|---|
| domain | active TSUZUNE Vaultからgraph構築時に取得できたMarkdown記録 |
| scale | note単位 |
| boundary | 取得済み・対象設定内のnote集合。除外、未取得、壊れたlinkを別状態にする |
| observation protocol | 明示Wiki linkをedgeとし、scene selectorが選んだ集合を一時強調する |
| time window | graphを構築／更新した読取時点。timelineを使う場合は表示中のslice |

短いcaption例は、`観測断面: 取得済みノート / 明示リンク / 読取時点 00:32` とする。`Vault全体 / 現在`を残す場合は、help内で「全体」が対象設定内の取得済み集合、「現在」がgraph読取時点を意味すると定義する。**これは推論／文言案である。** 根拠: 「観測宙域 MVP UI Prompt」Observation caption、「存在相理論 — 理論定義 Research v0.1」P1・P3・§5。

## 3. 危険な表現と置換規則

| 危険な表現 | 危険性 | 使用可能な置換 | 判定 | 根拠ノート |
|---|---|---|---|---|
| 「存在相を可視化する」「これが存在相である」 | `P₀`と有限表示を同一視する | 「Vaultの明示構造を条件付きで表示する」 | Reject | 「存在相理論 — 理論定義 Research v0.1」§2・P3・§10 |
| 「世界／知識宇宙そのもの」 | `W`または知識全体の網羅を暗示する | 「宇宙を模した鑑賞表示」「取得済みVault記録の星空」 | Rewrite | 「存在相理論 — 知識構造MOC」崩してはいけない境界、「存在相理論 — 全体整理・現在地 v0.2」§3–4 |
| 「星座が生まれた」「新しい集団を発見した」 | selector出力を実在的個体・真理へ昇格する | 「この選択規則で注目集合が浮上した」 | Rewrite | 「存在相理論 — 全体整理・現在地 v0.2」§5、「観測宙域 MVP Requirements」§2 |
| 「近いノートは意味が近い」 | force layoutをsemantic relationへ取り違える | 「画面上の距離はlayout結果。関係根拠は明示link」 | Reject | 「存在相理論 — 理論定義 Research v0.1」P4・§10、「観測宙域 MVP Requirements」§4 |
| 「星が引き合う／流れる」「地形が形成される」 | simulationをH1/H4や共同cycleの実証・物理法則へ見せる | 「layoutが緩やかに更新される」「cameraが移動する」 | Rewrite | 「存在相理論 — 理論定義 Research v0.1」§4・§11、「観測宙域 MVP Requirements」§2 |
| 「明るいほど重要／真実／存在が強い」 | 一つの視覚量を価値・真理・存在度へ統合する | 明るさの意味を一つだけlegendで宣言。重要度等には使わない | Reject | 「観測宙域 MVP Scope」Out Of Scope、「存在相理論 — 理論定義 Research v0.1」§5・§10 |
| 「linkなし＝関係なし／孤立した知識」 | 明示されていない関係、未取得、壊れたlinkを不存在へ潰す | 「表示中の明示linkなし」 | Rewrite | 「観測宙域 MVP Requirements」§2・§5、「存在相理論 — 理論定義 Research v0.1」P1 |
| 「Vault全体」「現在」 | 除外・未取得と読取時点を隠すと、完全性・即時性を暗示する | 「対象設定内の取得済みnote」「graph読取時点」 | Rewrite／help必須 | 「存在相理論 — 全体整理・現在地 v0.2」§9 unseen、「存在相理論 — 理論定義 Research v0.1」P1・P4 |
| 「未解決はamber」 | 未解決という認識状態のsource／authorityがない場合、画面が判定を捏造する | 明示metadataとprovenanceがある場合だけ表示。MVPでは装飾色へ戻すか未使用にする | MVP Reject | 「観測宙域 MVP UI Prompt」Design Tone、「存在相理論 — 全体整理・現在地 v0.2」§2、「存在相理論 — 理論定義 Research v0.1」§9 |
| 「観測が星座を作る」 | 表示操作からworld-level constitution claimへ飛躍する | 「表示規則が注目集合を選ぶ」 | Reject | 「存在相理論 — 理論定義 Research v0.1」P3・§5 |
| 「同じ星座が続く」 | 異なるscene／time slice間のidentity criterionを省略する | 「同じnote集合／同じselector結果」とcriterionを明記する | Rewrite | 「存在相理論 — 理論定義 Research v0.1」P2、「存在相理論 — 全体整理・現在地 v0.2」§3 |

## 4. MVP / Future / Reject / Experiment

### MVP

- 別入口の鑑賞表示、既存Global Graph由来のnote集合、明示Wiki linkのみ、決定的なscene selector、camera／opacityによる一時強調、pause、全体へ戻る、note open、reduced motion、静かなfailure stateを実装範囲とする。根拠: 「観測宙域 MVP Scope」MVP、「観測宙域 MVP Implementation Brief」Smallest Implementation Shape／Technical Assumptions。
- captionとhelpに、表示対象・note単位・明示link・読取時点・selector規則・visual encodingを開示する。根拠: 「観測宙域 MVP Requirements」§2・§4、「存在相理論 — 理論定義 Research v0.1」P1・P3・P4。
- scene切替は星を消滅・生成せず、非注目対象も不存在扱いせず、強調だけを変える。根拠: 「観測宙域 MVP Requirements」§2・§5、「存在相理論 — 全体整理・現在地 v0.2」§3。
- Markdown、通常graph設定、node world position、cluster正解、理論判定を保存しない。根拠: 「観測宙域 MVP Requirements」§2・§4、「観測宙域 MVP Implementation Brief」Technical Assumptions。

### Future

- 条件`c`を明示して切り替える観測sequence、note／概念群／projectのscale変更、history／boundary／source／roleを別型で重ねる表示はFutureに置く。根拠: 「観測宙域 MVP Scope」Future、「存在相理論 — 理論定義 Research v0.1」P2・P4。
- 遠い領域の一時的接近は、source、保存された関係、translationで失われる情報、failure conditionを示せる場合に限る。根拠: 「観測宙域 MVP Scope」Serendipity、「存在相理論 — 理論定義 Research v0.1」P4。
- idea候補は、元note、変換、推論段階、不確実性、反証条件を持ち、本人の明示操作まで保存しない。根拠: 「観測宙域 MVP Scope」Idea Emergence、「観測宙域 MVP Implementation Brief」Future Architecture Boundary。

### Reject

- `P₀`、`W`、存在相そのものを宇宙、graph、network、座標、force、movement、single scalarとして描く。根拠: 「存在相理論 — 理論定義 Research v0.1」§10、「存在相理論 — 知識構造MOC」崩してはいけない境界。
- H1–H6または`濃淡 → 流れ → 分化 → 統合 → 安定 → 地形 → 次の流れ`をscene順、force parameter、普遍的時間順序、因果法則として実装する。根拠: 「存在相理論 — 理論定義 Research v0.1」§4・§11、「観測宙域 MVP Requirements」§2。
- link、history、source、semantic similarity、AI推論を同じedge型に混ぜる。根拠: 「観測宙域 MVP Requirements」§2、「存在相理論 — 理論定義 Research v0.1」P2・P4。
- layout距離、次数、明るさ、size、色を、真理、価値、意味、因果、存在度へ変換する。根拠: 「観測宙域 MVP Scope」Out Of Scope、「存在相理論 — 理論定義 Research v0.1」§5・§10。
- 一時集団をCANON、本人採用、個体、正解clusterとして保存する、または利用者操作なしでVaultへ書く。根拠: 「観測宙域 MVP Scope」Out Of Scope、「存在相理論 — 知識構造MOC」権限層ごとに読む。

### Experiment

- scene selectorは「明示linkの連結領域」「注目nodeの近傍」「既存Group query」を固定fixture・同一seedで比較し、説明可能性、場面差、過大集合、孤立noteの扱いを先に評価する。結果前に一つへ固定し、複数規則を結果に応じて切り替えない。根拠: 「観測宙域 MVP Requirements」§6、「存在相理論 — 理論定義 Research v0.1」§9 自己封印禁止。
- `観測宙域`／`星巡り`、標準tempo、星座名の生成・表示は実機鑑賞で検証する暫定案とする。根拠: 「観測宙域 MVP Requirements」§6、「観測宙域 MVP Implementation Brief」Stop Condition。
- `Vault全体 / 現在`と、より限定的なcaption案を利用者理解テストで比較し、「表示外＝不存在」「scene＝真の集団」という誤読が起きないか確認する。**これは推論／検証提案である。** 根拠: 「存在相理論 — 理論定義 Research v0.1」P1・P3、「観測宙域 MVP Requirements」§4。

## 5. 最強の反証

### 反証A — 存在相語彙の非冗長性

同じinput、同じscene selector、同じcaption予算、同じfailure statesを使い、(a) `W/P₀/D_c/T_EP`境界から導いた監査規則と、(b) 通常のgraph visualization checklistだけを比較する。存在相側が、表示と対象の混同、scale smuggling、観測・表象の混同、provenance mixing、欠落＝不存在の誤りについて、追加検出もmeaning-preserving compressionも再現可能に与えないなら、観測宙域における存在相理論の役割は固有設計原理ではなく`organizing vocabulary only`へ降格する。**これは既存strongest nullをMVPへ適用した推論である。** 根拠: 「存在相理論 — 理論定義 Research v0.1」§8・§13、「存在相理論 — 全体整理・現在地 v0.2」§6。

### 反証B — 比喩による還元の実害

captionとhelpを読める状態でも、利用者が反復して「画面の宇宙＝存在相そのもの」「星座＝実在する真の集団」「画面距離＝意味距離」と理解するなら、この宇宙比喩はP3の観測・表象非同一を実用上守れていない。文言修正で解消しなければ、存在相を冠する説明を外し、ambient graph visualizationとして扱うべきである。**これは監査上の反証条件／設計提案である。** 根拠: 「存在相理論 — 理論定義 Research v0.1」P3・§9、「観測宙域 MVP Purpose」Success Definition 2。

## 6. 実装・受入時の検証質問

1. 画面は何を表すかを「取得済みMarkdown記録の条件付き表示」と一文で説明でき、`W`や`P₀`を表すと言っていないか。根拠: 「存在相理論 — 理論定義 Research v0.1」§2・P3。
2. caption/helpから`c_view`のdomain、scale、boundary、protocol、読取時点を確認できるか。根拠: 「存在相理論 — 理論定義 Research v0.1」§2・P1。
3. 「観測断面」が`D_c(x)`そのものではなく、Vault記録のpresentationだと区別されているか。根拠: 「存在相理論 — 理論定義 Research v0.1」§2・P3。
4. 全edgeを特定の明示Wiki linkへtraceでき、類似・因果・history・AI推論edgeが混入していないか。根拠: 「観測宙域 MVP Requirements」§2・§4、「存在相理論 — 理論定義 Research v0.1」P2・P4。
5. scene selectorの規則が表示前に固定され、同一input／seedで同一sequenceを返すか。結果に合わせたrule switchingがないか。根拠: 「観測宙域 MVP Implementation Brief」Smallest Implementation Shape、「存在相理論 — 理論定義 Research v0.1」§9。
6. sceneが変わってもnoteの存在、group identity、link、node world positionを変更・保存しないか。根拠: 「観測宙域 MVP Requirements」§2・§4。
7. 未接続、壊れたlink、未取得、除外、未判定、描画失敗を別状態として扱い、どれも「不存在」と言っていないか。根拠: 「観測宙域 MVP Requirements」§2・§5、「存在相理論 — 理論定義 Research v0.1」P1。
8. brightness、color、size、halo、opacityにそれぞれ一つの表示上の意味があり、真理・価値・存在度へ結びつかないか。根拠: 「観測宙域 MVP Requirements」§4、「観測宙域 MVP Scope」Out Of Scope。
9. 「未解決」等のepistemic statusを出す場合、Markdown上のsource、authority、時点、未判定との差をtraceできるか。できなければ表示しないか。根拠: 「存在相理論 — 全体整理・現在地 v0.2」§2、「存在相理論 — 理論定義 Research v0.1」P4・§9。
10. layout movement、camera movement、fadeを世界側の流れ・濃淡・地形・生成・消滅と説明していないか。根拠: 「存在相理論 — 理論定義 Research v0.1」§4・§10。
11. helpを見ない二分間の鑑賞後でも、利用者がsceneを「一時的な注目集合」と理解できるか。誤読時にcaptionだけで訂正できるか。**これは推論／受入質問である。** 根拠: 「観測宙域 MVP Purpose」Success Definition 1–2。
12. 通常graph checklistだけとの比較で、存在相境界が追加の誤り検出を与えたか。与えなければ固有理論実装を主張せず、`organizing vocabulary only`へ降格できるか。根拠: 「存在相理論 — 理論定義 Research v0.1」§8・§13。

## 7. 参照ノート・要件

### 本番TSUZUNE（read-onlyで全文確認）

- `30_知識/存在相理論-理論定義Research-v0.1-2026-09-01.md` — 「存在相理論 — 理論定義 Research v0.1」
- `30_知識/存在相理論-知識構造MOC-2026-09-01.md` — 「存在相理論 — 知識構造MOC」
- `30_知識/存在相理論-全体整理・現在地-v0.2-2026-09-02.md` — 「存在相理論 — 全体整理・現在地 v0.2」

### repository要件（全文確認）

- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/1_purpose.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/2_alternatives.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/3_scope.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/4_requirements.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/5_ui_prompt.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/6_implementation_brief.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/discussion_log.md`
- `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/packets/01-theory-integrity.md`

## 8. 未確認境界

本監査は指定されたcurrent Research定義、MOC、current synthesisとrepository要件の整合性監査である。external current CANON原ファイル、R01–R13原文、40_情報源、50_履歴、実装コード、実機画面、利用者理解テストは確認していない。そのため、理論の真理、MVPの実装完了、鑑賞価値、誤読が実際に起きないことは主張しない。根拠: 「存在相理論 — 全体整理・現在地 v0.2」§9 unseen、「存在相理論 — 理論定義 Research v0.1」§10・§14。
