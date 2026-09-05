# ART-01 — LIFE Weatherの作品基盤

## 結論

LIFE Weatherが目指すべきものは「ノートを可視化する宇宙」ではない。**読み終えたあとにも本人の中に残る、まだ名づけ直されていない蓄積の時間へ、無言で再入場するための私的な公演**である。

そのための断絶点は、データの振る舞いを見せることから、作品がすでに途中から続いており、所有者がその時間へ立ち会うことへ移すことにある。光・場・地形・流れは、Vaultの有限な観測表現であって、存在相そのもの、ノートの価値、真の関係を示す図ではない。この境界は維持する。[`art-direction.md:8-12`](../../20260903-0032-existence-phase-observatory-mvp/art-direction.md) [`life-weather-overall-design.md:37-46`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)

価値の下限は、所有者が説明を読まずに「自分のノートでなければ、この時間にはならない」と感じること。強い到達は、翌日、何かを調べるためではなく再びこの時間へ戻りたくなることにある。[`life-weather-overall-design.md:22-33`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)

## 現在の美的天井

現行候補は、Graph／関係線／分類色／偽星を退け、一note一光、無彩色、資料由来の出来事、共有場への履歴feedbackまで到達している。これは「きちんと設計された生成的スクリーンセーバー」にはなり得る土台である。[`work/archive-weather-prototype/README.md:3-17`](../../../../work/archive-weather-prototype/README.md) しかし持続作品としての天井は、現時点では **由来を持つ高品質なparticle demo** に留まる。

理由は三つある。

1. 最初の静止画がなお「暗い粒子が動く画面」と読め、時間経過後に初めて場になる。これは基盤語彙の問題で、質感を足して解けない。[`results/24-art-verification.md:14-16`](../../20260903-0032-existence-phase-observatory-mvp/results/24-art-verification.md)
2. 現行の90秒scoreは、出来事を追う技術実証としては明快だが、所有者を「公演の途中にいる観測者」にする長い呼吸には未達である。12分の無操作鑑賞、反復・疲労・翌日再訪は未検証である。[`retrospective.md:157-165`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)
3. 常時captionが鑑賞面を説明画面へ戻している。情報を隠しただけでは作品にならず、視界に置かないという構図上の決断が必要である。[`results/24-art-verification.md:25-30`](../../20260903-0032-existence-phase-observatory-mvp/results/24-art-verification.md)

この評価は機械的FAILではない。現在の技術的PASSを「作品が前進した」証拠に取り違えないための、美術上の停止線である。[`retrospective.md:20-32`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)

## 捨てるもの／戻さないもの

- **「宇宙だから星を置く」という比喩。** 初手から点を見せると一般particle demoへ戻る。開始時に必要なのは、前史を持つ残留・空白・局所的な圧ではあって、整然とした星野ではない。
- **Graphの語法。** node、edge、中心、軌道図、cluster名、値の大小で見せる優劣を戻さない。これらは過去にGraphを化粧し直しただけだった。[`retrospective.md:38-42`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)
- **個性を色・分裂・飾り粒で作ること。** 分類色、衛星、数千fragment、独立fog、線、輪郭、白いモヤの増量を捨てる。一note一光の存在感を、応答、速度、残留、近づき方、ほどけ方で守る。[`retrospective.md:43-49`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)
- **preset巡回と短い見せ場の連打。** 同じエンジンの派手な別形態を順番に消費しない。資料から起き得ることと、作品が選んで見せる順序を分ける。[`results/36-white-reset-and-tendrils-full-study.md:40-42`](../../20260903-0032-existence-phase-observatory-mvp/results/36-white-reset-and-tendrils-full-study.md)
- **鑑賞面のcaption、HUD、note名hover。** provenanceは捨てないが、鑑賞面から完全に退場させる。個々のsourceや限界は、明示的に開く別面のreceiptへ置く。[`art-direction.md:28-32`](../../20260903-0032-existence-phase-observatory-mvp/art-direction.md)
- **音楽・外部の感情曲線を先に借りること。** 無音で緊張、休止、転調が成立しないなら、作品の核は未成立である。[`life-weather-overall-design.md:60-67`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)

## 作品文法：七つのトレードオフ原則

1. **「データを理解する」より「時間へ立ち会う」を優先する。** 鑑賞中の説明、選択、探索を削る。理解は任意のmaking-ofで回収し、Canvasは所有者の注意を要求しない。
2. **完全なデータ駆動より、資料に拘束された作曲を優先する。** 資料現象は「起き得ること」を決め、Art Scoreは「いつ、どの尺度で見せるか」を決める。放置simulationにも固定映像にも逃げない。[`life-weather-overall-design.md:82-104`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)
3. **視覚片の量より、一note一光の居場所を優先する。** 各noteは作品内で孤立・接近・沈殿・離脱を経験してよいが、飾りのために分裂しない。見えない瞬間は低価値を意味しない。[`life-weather-overall-design.md:71-80`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)
4. **劇的な変化より、変化の因果を優先する。** 膜、谷、細流、密度は前の通過履歴から生じ、次の状態を少し曲げる。突然のscene切替、無由来の「きれいな形」、周期の山場は拒む。[`art-direction.md:18-26`](../../20260903-0032-existence-phase-observatory-mvp/art-direction.md)
5. **常時の充満より、働く余白を優先する。** 暗さは停止や暗転ではない。遠い光、弱い勾配、前の構図の残留によって、次の変化がすでに始まっている余白にする。[`retrospective.md:47-49`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)
6. **視覚上の純度より、作品外の説明責任を優先する。** 表面にtitle、値、凡例を置かない代わりに、別面で入力、変換、欠落、非主張を追えるようにする。沈黙はブラックボックスの言い換えではない。[`life-weather-overall-design.md:43-46`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)
7. **「宇宙らしさ」より、本人固有の再遭遇を優先する。** 白・銀・暗さ、奥行き、流れは目的ではなく材料である。同じ見栄えを別Vaultへ被せる提案、単一scoreが価値を匂わせる提案は採用しない。[`art-direction.md:36-43`](../../20260903-0032-existence-phase-observatory-mvp/art-direction.md)

## 時間構成：始まる前から続いている十二分

作品を「起動→粒子が発生→見せ場→終了」とは組まない。毎回、すでに時間が経過した状態へ入る。これが、鑑賞者を操作主ではなく一時的な立会人にする最小の距離である。

| 内部movement（画面には表示しない） | おおよその滞在 | 観測者が受け取るもの | 次へ渡すもの |
| --- | ---: | --- | --- |
| **前史／到着** | 0–2分 | 大きな暗さの中に、前から続いていた局所的残留と弱い密度差がある。点の出現では始めない。 | まだ読めない方向性と、少数の再浮上。 |
| **寄り合い** | 2–5分 | 異なる時間層が互いの通過を受け、細流や一時的な境界を作る。中心は固定しない。 | 残留した場、密度の谷、揺らぐ遠景。 |
| **仮の身体** | 5–8分 | 膜、雲、空洞、集まりが「何か」に見えかけるが、命名される前に変態する。 | 圧縮された光量ではなく、複数の逃げ道。 |
| **解体／継承** | 8–12分 | 形は解けるが、光も歴史もゼロへ戻らない。別尺度の星野と次の局所圧へ受け渡される。 | 次回の到着にすでに存在する前史。 |

四つは楽章名でもタイマーでもない。資料時間、現象候補、直前の場の履歴で重なり、前後する。短い脈拍は数秒〜数十秒、構図の変態は数分という二つの尺度に分ける。こうして90秒の候補を速度で引き延ばすのではなく、12分でも固定loop・常駐cluster・同じpeakを読ませない時間を成立させる。[`art-direction.md:22-26`](../../20260903-0032-existence-phase-observatory-mvp/art-direction.md) [`life-weather-overall-design.md:257-284`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)

## 提示場所と観測者との距離

LIFE Weatherは、日常の「静かな知識工房」の上に常設する装飾ではない。書く、探す、証拠を確認する場とは別に、所有者が一日の終わりや思索後に自分で入る、単目的の鑑賞面とする。常時動く背景、editor横の小窓、dashboard card、Graphの代替tabには置かない。日常UIを静かに保つ既存の製品人格とも両立する。

- 入場後はすぐ作品が進行し、画面はCanvasだけに近づける。pause／resumeと`この作品について`はfocusまたは明示操作時だけ現れる。
- `この作品について`は鑑賞を覆う可逆な別面とし、source、使った観測軸、欠落、非主張を示す。ここに調整UI、preset、node openを混在させない。
- 鑑賞面にはnote名hoverも置かない。名前を確かめる行為は分析への切替なので、receipt内の「このmovementへ寄与したsource群」に移す。
- 現段階はproduction surfaceへ繋がず、隔離prototypeで作品gateを通す。これは技術都合ではなく、日常の道具と私的公演を混ぜないための提示原理でもある。[`results/21-runtime-placement.md:3-20`](../../20260903-0032-existence-phase-observatory-mvp/results/21-runtime-placement.md)

## 最強の反証

常時の文字を外した同一候補を、作品説明なしに90秒見た所有者が、**「よくできた粒子スクリーンセーバーだが、自分の蓄積とは感じない。明日また見たい理由もない」**と言うこと。これが最も強いFAILである。

対照Vaultとの差やtestの緑は、この反証を覆さない。なぜなら因果が内部で正しくても、それが鑑賞経験として本人の時間に変換されていないからである。機械gateと因果gateを通っても作品gateは代替できない。[`retrospective.md:26-32`](../../20260903-0032-existence-phase-observatory-mvp/retrospective.md)

## 最小のArt Proof

次に必要なのは新しい効果ではなく、次の一公演だけである。

1. **無音・無caption・無hoverの12分版**を、上記四movementの重なりとして用意する。入口は前史の残留から始め、ゼロ状態や整列した粒子から始めない。
2. **同一Vault／同一seed、同一Vault／別日seed、matched control**を、説明を伏せて各90秒比較する。所有者が後付けの理屈でなく、少なくとも三つの非意味的な構図・変態差を言えることを確かめる。
3. 本番を一切開かず、所有者が12分無操作で鑑賞する。操作を探す誘惑、固定loop、三分以上の常駐cluster、白い塊、疲労が出ないことを記録する。
4. 翌日、説明を読まずに自発的な再訪があるかを問う。三問――「自分のノートだからこうなったか」「90秒見続けたいか」「別の日にまた見たいか」――の一つでも否なら不採用とし、効果追加ではなく作品文法へ戻る。[`life-weather-overall-design.md:278-284`](../../20260903-0032-existence-phase-observatory-mvp/life-weather-overall-design.md)

このproofが通るまで、production統合、音楽、AI意味づけ、公開用操作群を進めない。通ったとき初めて、LIFE Weatherは「粒子を使う作品」ではなく、TSUZUNEという個人の蓄積が時間を持つための作品面になり得る。
