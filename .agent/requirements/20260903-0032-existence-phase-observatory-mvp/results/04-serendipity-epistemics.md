# SERENDIPITY-01 — 偶発的発見とアイデア生成の認識論監査

> **Research boundary:** Source／Observation／Proposalの分離は継続採用する。cameraやone-hopなどMVP画面への具体提案はR2によりsupersededし、将来案は未実装のまま扱う。

## 結論

観測宙域が将来「思いがけない結びつき」を扱うとき、守るべき最小原則は、**意外さを真実らしさへ変換しないこと**である。画面上の意味を `Source / Observation / Proposal` の三層へ固定し、層をまたぐたびに表示と人間の操作を変える。

- **Source（出典）**: Vaultに実際に保存されているノート、本文、metadata、明示Wiki link、人間が明示的に記録した判断。
- **Observation（観測）**: Sourceを、開示された条件・規則・時点で選択、集約、配置した結果。一時的な星座はここに属する。
- **Proposal（提案）**: Sourceに明記されていない関係、問い、解釈、仮説。規則生成でもAI生成でもここに属し、未採用である。

MVPには生成AIも推論edgeも入れない。星とedgeはSource、星座の選択と強調はObservationとして明示する。それだけで将来のProposal層を誠実に追加できる土台になる。

## 参照した正本と適用境界

### Repository要件

- `1_purpose.md`: 操作なしの鑑賞、偶然の気づき、必要時だけ元ノートを開く。
- `2_alternatives.md`: MVPは既存graphの表示モード。生成AIによる自律知識宇宙はprovenance・書込み安全性が未成立のため採らない。
- `3_scope.md`: 将来のSerendipity／Idea Emergenceはsource trace、失われた情報、失敗条件、不確実性、反証条件、人間の採否、明示保存を必須とする。
- `4_requirements.md`: `D_c(x) != P0`、non-unique boundary、typed／multiscale、provenance、non-exhaustiveness。MVPのedgeは明示Wiki linkのみ。

### 本番TSUZUNE（read-only）

- `30_知識/TSUZUNE-根幹思想-知識循環と構造探索.md`
  - 本人が知識と判断の主権者。AIの推測はProposalであって原典・確定事実ではない。
  - 検索・関連候補には選定理由、除外、欠落、現在／過去を示す。
  - 利用履歴やrankingを本文・明示link・出典より強い真実にしない。
  - 「探索は大胆に、書込みは慎重に」。
- `30_知識/存在相理論-全体整理・現在地-v0.2-2026-09-02.md`
  - 存在相理論はprovisionalなResearch programであり、完成した存在論や経験科学上の実証結果ではない。
  - 有限表現は存在相そのものを尽くさず、観測・表象・測定と対象の成立を同一視しない。
  - graph、network、座標、運動、single scalarは存在相そのものではなく、局所的な表現候補にすぎない。
- `30_知識/存在相理論-本人命題・採用境界索引-2026-09-01.md`
  - 本人由来、共同推論、AI提案、最終採用を分離する。
- `10_プロジェクト/存在相理論.md`
  - current CANON、Research、Evidence、本人採用を相互に昇格させない。

したがって、本設計は存在相理論から表示上の**非混同規則**を借りるが、星座の生成・解散を存在相の法則、世界の実在構造、個体化の科学的証拠として扱わない。

## 1. 三層の表示契約

| 層 | 画面で主張してよいこと | 必須表示 | 禁止する読み替え |
| --- | --- | --- | --- |
| Source / 出典 | 「このノートがある」「この明示linkが保存されている」「本人がこの判断を記録した」 | `出典` badge、ノート名／pathへ辿る入口、取得時点 | 保存済みであることを内容の真実性・重要性・採用済みへ変えない |
| Observation / 観測 | 「この条件では、この集合が一つの場面として選ばれた」「この距離・共通点が計算された」 | `観測` badge、選択条件、対象範囲、時点、除外／未取得 | clusterを自然種・正解分類・固定所属へ変えない |
| Proposal / 提案 | 「これらが関係するかもしれない」「この問いを検討できる」 | `提案・未採用` badge、seed Source、変換過程、不確実性、反証条件、生成主体 | 発見、事実、因果、本人見解、CANON、明示linkへ昇格しない |

`epistemic kind` と `authority / status` は別軸にする。人間が「検討に採用」してもProposalはProposalのままであり、状態だけが `未採用 → 保留／検討採用／棄却` へ変わる。保存した場合にSourceとなるのは「本人がこの仮説を記録した」という事実であって、仮説内容の真理ではない。

操作button、pause状態、focus ringなどの純粋なUI chromeは三層の対象外でよい。ただし、文章・数値・線・囲み・星座名など、知識について何かを示す表示は必ず一層だけを持つ。

### MVPの一意対応

| 表示 | 層 | 画面上の識別 |
| --- | --- | --- |
| ノートの星、ノート名 | Source | helpで `出典: VaultのMarkdownノート`。選択時に元ノートへ辿れる |
| 明示Wiki linkのedge | Source | legendで `実線 = 保存済みWiki link`。推論線は存在しない |
| 注目中の星座の囲み、opacity、camera | Observation | caption先頭を `観測:` とする。Source edgeとは別に囲み／輪で表す |
| 星座名 | Observation | `観測: 「主要ノート名」周辺 / 明示link 1-hop` のように条件を含める |
| 距離、明るさ、大きさ、色 | Observation | それぞれの表示規則をhelpで説明し、重要度・存在度・真理ではないと明記 |
| 将来の新しい関係／問い／仮説 | Proposal | MVPには表示しない。追加時は実線edgeを使わず、`提案・未採用` cardとしてのみ出す |

## 2. 驚きと妥当性を分ける

セレンディピティは「遠いものを出した」だけでは成立しない。驚きと妥当性を一つのscoreへ畳まず、少なくとも次の二軸を独立に扱う。

### 驚き

- 驚きは本人の期待に対する関係であり、graph距離や語の希少性から確定できない。
- systemが事前に持てるのは `surprise proxy` だけである。表示語は `意外さ 82%` ではなく、`選定理由: 通常の1-hop表示では同時に現れにくい` とする。
- 本人の評価は `予想内 / 少し意外 / 意外 / 未評価` とし、時間や問いによって変わる局所的な応答として扱う。

### 妥当性

- 妥当性は「AIの確信度」ではない。どのSourceと推論段階に支えられ、どこに飛躍・欠落・反証があるかで示す。
- 表示は `根拠を直接辿れる / 条件付き / 根拠不足 / 反証候補あり / 未評価` のようなqualitative stateを用いる。
- `根拠を辿れる` は真であることを意味しない。Source自体の信頼性、現在性、採用statusは別に読む。

### 組合せの意味

| 驚き | 妥当性 | 扱い |
| --- | --- | --- |
| 高い | 根拠を辿れる | セレンディピティ候補。本人へ静かに提示する |
| 高い | 根拠不足 | 「面白い飛躍」ではなく未支持Proposal。強調を弱める |
| 低い | 根拠を辿れる | 有用な再発見かもしれないが、セレンディピティとは呼ばない |
| 低い | 根拠不足 | noise。提示候補から外す |

人間の `面白い` は個人的有用性、`違う` は当人による不採用、`保留` は未決定である。いずれも普遍的重要度、真偽、他ノートのrankingへ自動変換しない。

## 3. 根拠表示 — 静けさと監査可能性の両立

通常時は一行だけを出し、詳細は明示操作で開くprogressive disclosureにする。

### 一行表示

`観測: 明示Wiki link / 「A」から2-hop / 現在取得分`

Proposalを将来追加する場合:

`提案・未採用: A と B を「共通するC」で検討`

### 「なぜ現れた？」drawer

1. **層**: Source / Observation / Proposal。
2. **seed**: 元ノートのtitleとpath、取得時点。
3. **既知の関係**: 保存済みWiki link、引用可能な本文箇所、typed relation。別種類を一本のedgeへ混ぜない。
4. **変換**: 選択規則、filter、比較、要約、AI生成などを順に示す。
5. **欠落**: 未取得、除外、古いSource、切り捨てた候補。
6. **失敗条件**: 何が確認されたらこの観測／提案を取り下げるか。
7. **行動**: 元ノートを開く。Proposalだけ `面白い / 違う / 保留` を選べる。

説明は内部scoreやembedding値の羅列ではなく、人間の言葉で「何を見て、どう変換し、何を見ていないか」を追えるようにする。説明自体がSourceの代替にならないよう、必ず元ノートへ到達できるようにする。

## 4. 集団の生成と解散

### 生成

- 表示名は `cluster` や `分類` ではなく `観測場面` または `一時的な星座` とする。
- 生成の主語は世界でも存在相でもなく、`現在の観測条件` とする。
- 星座は `condition + seed + source revision set` から得られたObservationであり、同じ星が複数場面へ重なってよい。
- まとまりの境界は囲み、輪、opacityで表し、所属edgeを新設しない。
- titleは自動的な意味要約ではなく、可能なら `「A」周辺 / 明示link 1-hop` のような規則名にする。意味ラベルを生成した場合はProposalへ上げる。

### 解散

- 解散するのは強調状態だけであり、ノート、Wiki link、node position、分類、価値は変わらない。
- `関係が消えた`、`集団が死んだ` とは表現せず、`この観測場面を閉じる` と扱う。
- 解散後も星は背景に残す。未接続・非表示・除外を不存在へ変えない。
- 星座の生成／解散履歴を正本へ自動保存しない。必要なら評価fixture内の一時session記録に限る。

## 5. 「アイデアが生まれる」の誠実な表現

Idea Emergenceは、AIが世界に新しい事実を見つけた演出にしない。表示上は**関係edgeではなく、Sourceへ紐づくProposal card**として扱う。

### 表現

- 見出し: `問いの種` または `仮説候補`。
- 常時badge: `提案・未採用`。AI生成なら `生成主体: AI` も表示する。
- 本文: 一文の問い／仮説。断定形を避けるだけでなく、何が未確認かを明記する。
- 下部: `Source A + Source B → 共通項C → 未確認の接続` のtrace。
- 視覚: Sourceの実線edgeを使わない。open ring、破線枠、cardなど、色以外でもProposalと分かる形にする。
- event wording: `この仮説候補を生成しました`。`新しい関係を発見しました`、`真の星座が現れました` は使わない。

### 人間の採否

1. `面白い`: 個人的に再訪したい。真偽や採用を意味しない。
2. `違う`: この文脈では不適切。任意で理由を添えられるが必須にしない。
3. `保留`: 判断を先送りする。
4. `検討に採用`: 別の明示操作。Proposal statusを変えるだけで、Sourceの真実性やCANONを変えない。
5. `ノートへ保存`: さらに別の明示確認。destination、内容、provenance、未採用statusをpreviewしてからだけ書く。

閲覧、hover、長時間表示、`面白い`、自動巡回は、保存・link追加・CANON更新の許可ではない。

## 6. MVP / Future / Reject / Experiment

| 区分 | 内容 | 理由／再開条件 |
| --- | --- | --- |
| **MVP** | Sourceの星と明示Wiki link、Observationとしての一時的な星座、`観測:` caption、表示規則help、元ノートへの入口 | 既存graphだけで「表現と対象の分離」を検証できる。AIも新規knowledge DBも不要 |
| **MVPの布石** | すべてのknowledge表示を三層のどれかへ一意分類できる命名規則。sceneの `seed / rule / scope / as-of / omitted` を必要時に説明できること。Proposal用の実線edgeを予約しないこと | 将来機能を足してもSourceとの混同を防ぐ。UIへ常時大量表示する必要はない |
| **Future 1** | 明示linkだけを用いたdeterministicな「普段は同時に見ない」場面。提示のみ、書込みなし | MVPで鑑賞価値とcaption理解が成立した後 |
| **Future 2** | rule-basedの問い候補。Proposal card、source trace、反証条件、人間feedbackを持つ | 固定fixtureで誤意味付け率と根拠到達を合格した後 |
| **Future 3** | LLMによる仮説候補。生成主体、model条件、seed、変換、欠落、反証、preview付き明示保存 | 単純なexplicit-link baselineより人間評価で増分価値があり、proposal-onlyで安全に止まれる時だけ |
| **Future 4** | 個人feedbackを用いた局所的な提示調整 | feedbackが真理・重要度へ昇格せず、reset／disable／説明が可能な最小trial後 |
| **Reject** | 推論を明示Wiki linkと同じ線で描く、星座を固定分類へ保存、AI案を「発見」と呼ぶ、単一のserendipity／truth score、自動採用、自動ノート／link追加、全Vault embedding・常駐生成をMVPへ入れる | Source／Observation／Proposalを混同し、静かな鑑賞と本人主権を損なう |
| **Experiment** | 下記の固定fixtureと人間評価。既存明示link baselineを必ず比較対象にする | 生成機能の採用可否を「AIらしさ」ではなく増分価値と誤認riskで決める |

## 7. 最強の反証

本提案への最強の反証は、**説明可能なセレンディピティは鑑賞体験と両立しない**というものだ。根拠、欠落、失敗条件を正直に見せるほど画面は分析dashboardになり、隠すほど利用者は星座や提案を世界の事実と誤認する。その両立点がprogressive disclosureでも見つからなければ、観測宙域にProposal層を置くべきではない。

機能価値への最強nullは、意外な気づきの大半が既存の明示Wiki linkを静かに再提示するだけで得られ、生成された遠距離接続は `randomness theater` にすぎない、というものだ。simple 1-hop／2-hop baselineと比べて、`意外で、根拠を辿れ、後日も検討価値がある` 候補が増えなければ、LLM／embedding／学習を追加しない。

## 8. 評価プロトコル

### Fixture

本番Vaultへ書かず、固定fixtureに次の5種を用意する。

1. 明示linkで強く結ばれた、予想内かつ根拠明確な集合。
2. 2-hopの明示linkで辿れる、意外だが根拠明確な集合。
3. 見た目や語が似ているだけで明示根拠がない集合。
4. Source A／Bから生成した、反証可能なProposal。
5. 観測条件を変えると重なり方が変わる集合。

### 手順

1. **無操作2分**: MVP表示で三場面を見る。常時UIは一行captionのみ。
2. **層判別**: 星、edge、囲み、星座名、距離表示、Proposal cardなど全knowledge表示について、本人が `Source / Observation / Proposal` を選ぶ。
3. **根拠到達**: `なぜ現れた？` からseed、rule、除外、失敗条件、元ノートまで辿る。
4. **二軸評価**: 各候補の驚きと妥当性を別々に評価する。先にsystemの統合scoreを見せない。
5. **人間主権**: `面白い / 違う / 保留 / 検討に採用` を試し、保存操作をしない限りfixtureとMarkdownが不変であることを確認する。
6. **解散確認**: 場面を三回切り替え、解散後もnode／link／position／内容が変わらないことを確認する。
7. **baseline比較**: explicit-link 1-hop、deterministic 2-hop、Proposal生成の順をblindに比較する。
8. **後日再評価**: 少なくとも一度時間を置き、`面白い` が一時的な驚きだったか、実際に再訪・検討したかを分ける。

### 合格条件

- 全knowledge表示が実装・仕様上、一意に三層へ割り当てられる。複合表示は分割する。
- 初回legend確認後、本人がfixtureの全表示を層誤認なく判別できる。ProposalをSourceと答える誤認は1件でもfail。
- high-surprise／low-supportとlow-surprise／high-supportの例を別々に認識でき、単一scoreとして読まれない。
- Source claimはすべて元ノートまたは明示Wiki linkへ到達する。Observationはruleとscopeを再現できる。Proposalはseed、変換、欠落、反証条件を持つ。
- `面白い / 違う / 保留 / 検討に採用` のどれでもMarkdownは変わらない。明示した保存preview以外のwriteは0件。
- 一時的な星座の生成／解散でSourceと通常graph状態が変わらない。
- 生成案を追加する場合、simple explicit-link baselineより `意外かつ根拠を辿れ、後日も検討価値あり` の割合が改善し、誤意味付けを増やさない。

### 停止条件

- ProposalとSourceの誤認が一件でも残る。
- 根拠drawerを閉じると誤認し、開くと鑑賞不能になる。
- surprise proxyが本人の驚きと安定して対応しない。
- `違う` の主因が「飛躍を事実のように見せた」である。
- 生成案の多様性が縮み、同じ語彙・構図へ収束する。
- explicit-link baselineに増分価値で勝てない。

停止時はProposal生成を撤回し、MVPのSource + Observationへ戻す。失敗を追加model、ranking、常駐学習で自動的に埋めない。

## 9. 外部一次研究から得る限定的示唆

- Adamopoulos & Tuzhilinはunexpectednessを期待からの逸脱として形式化し、novelty／serendipity／diversityと区別した。TSUZUNEではこの区別を、`距離がある = 有益な発見` としない根拠に使う。([DOI](https://doi.org/10.1145/2559952))
- Kotkov, Veijalainen & Wangのserendipity評価では、relevance・novelty・unexpectednessを分け、diversity増加がaccuracyやserendipityを常に改善するわけではないと報告する。これは驚きと妥当性の別評価、単純な「遠さ最大化」のRejectを支持する。([paper](https://link.springer.com/article/10.1007/s00607-018-0687-5))
- Herlocker, Konstan & Riedlはrecommendationのdata／reasoningを説明interfaceの対象として扱った。ここから採るのは「内部scoreを見せる」ことではなく、推薦の根拠へ到達できるUIという限定原則である。([DOI](https://doi.org/10.1145/358916.358995))
- Swansonのliterature-based discoveryは、別々の文献群に既知の断片があり、その未明示接続を仮説候補にする形を示した。A–BとB–CがSourceでも、A–CはProposalであるという境界に使う。([PubMed](https://pubmed.ncbi.nlm.nih.gov/3797213/))
- Si, Yang & Hashimotoの100人超のNLP研究者によるblind評価では、LLM案はnoveltyで高く、feasibilityでやや弱く、self-evaluationとgeneration diversityに課題があった。新奇性を妥当性・自己採点と分離する必要を示す。([arXiv](https://arxiv.org/abs/2409.04109))
- Doshi & Hauserの実験では、生成AI支援が個々のstory評価を高める一方、作品間の類似性を増やした。個別の「面白い」だけでなく、候補群の多様性収束を監視する根拠にする。([Science Advances](https://doi.org/10.1126/sciadv.adn5290))

これらは推薦・文献発見・創作実験の限定的Evidenceであり、個人Vault、存在相理論、観測宙域で同じ効果が成立する証明ではない。採用するのは評価軸と反証の置き方であり、性能主張は固定fixtureと本人評価で別途確認する。

## Verification checklist

- [x] ノート、edge、星座、caption、生成案をSource／Observation／Proposalのいずれか一つへ割り当てた。
- [x] 三層を色だけで区別せず、badge、線種／枠、文言、原典への入口で区別した。
- [x] 驚きと妥当性を別軸にし、統合truth scoreをRejectした。
- [x] 人間の採否を真偽・普遍的重要度・自動書込みと分離した。
- [x] 集団の生成／解散を表示状態に限定し、固定分類・存在相そのものへ昇格させなかった。
- [x] Idea EmergenceをProposal cardとして設計し、AI案を事実化しなかった。
- [x] MVP、Future、Reject、Experiment、最強の反証、評価／停止条件を示した。
- [x] コード・他ファイル・本番TSUZUNEは変更していない。
