# TSUZUNE LIFE Weather — 全体設計 v1

- 状態: 全体設計完了／実装未着手
- 更新日: 2026-09-04
- 正本範囲: 製品体験、作品構造、技術構成、MVP境界、受入条件
- 関連: `art-direction.md`、`results/36-white-reset-and-tendrils-full-study.md`

## 1. 一文で表す作品

> 人がTSUZUNEへ残してきた知識の生が、その人・その日・その観測でしか生まれない宇宙気象として立ち上がる、鑑賞優先の生成芸術。

これはGraphの豪華版でも、汎用particle visualizerでもない。作品を見た所有者が最初に感じるべきなのは「点が動いている」ではなく、**自分の蓄積が呼吸し、集まり、ほどけ、別の姿へ移っている**ことである。

## 2. 製品約束

### 2.1 看板としての約束

> TSUZUNEは、あなたの知的財産を保存するだけでなく、あなたにしか生まれない芸術として立ち上げる。

ここでいう知的財産は、法的価値や市場価値だけではない。本人のノート、経験の記録、考え、迷い、出典、判断、関係、差異、改訂と再解釈の履歴を含む。

### 2.2 初期利用者と利用場面

- 初期利用者はVault所有者本人である。
- 一日の終わり、思索の後、または何も操作せず眺めたい時に開く。
- 理解や整理を強制せず、これまで見えなかった関係や気配に出会う余白を作る。
- 主要価値は情報検索ではなく、蓄積に対する再遭遇と愛着である。

### 2.3 最小価値と到達価値

- **最小価値**: 一回の再生で、所有者が「自分のノートでなければこの作品にはならない」と感じられる。
- **強い価値**: 同じVaultでも日と観測条件が変われば別の公演になり、別のVault条件では追跡可能な固有差が出る。
- **理想到達**: 蓄積年数と再解釈が増すほど作品の時間層も育ち、同じ人生から二度と同じでない公演が生まれる。

## 3. 哲学的境界

LIFE Weatherは存在相理論から実装原則を得るが、存在相そのものを再現・証明する装置ではない。

1. 世界と経験は、分類、命名、記録より先にある。ノートはその一部への局所的な分節である。
2. 検索結果、Context、Graph、AI整理、LIFE Weatherは、知識世界に対する有限の観測と表現である。
3. 表示されないものを存在しないものとみなさない。
4. linkの欠落を関係の不在と断定しない。
5. 明るさ、大きさ、中心性、色、単一scoreで価値、重要性、同一性を決めない。
6. 集まりは固定clusterではなく、観測条件の下で一時的に安定した相として扱う。
7. 出典、時点、履歴、選定理由、欠落、不確実性を作品外のprovenanceとして保持する。
8. 流れ、地形、経路、network、粒子、場は局所的な試験表現であり、存在相そのものではない。

## 4. 鑑賞体験

### 4.1 基本動線

1. `LIFE Weather`を開くと、作品がすぐ始まる。
2. 利用者は操作せず、Vaultの資料時間と場の履歴が作る変化を見る。
3. 残す操作は一時停止／再開だけにする。
4. 一つの公演に終端を設けず、長く見ればmovementが別の組合せへ移り続ける。
5. 必要な人だけ`この作品について`を開き、使われた資料現象と観測限界を見る。

初回からeditor、parameter slider、preset一覧を見せない。制作調整用のArt Score inspectorは開発専用とし、鑑賞画面から分離する。

### 4.2 無音を作品条件にする

MVPは音楽、効果音、環境音を使わない。外部の拍、盛り上がり、感情を借りず、noteの差異、資料時間、共有場の履歴だけで緊張、解放、静寂、転調を作る。

- 無音は機能不足ではなく、所有者が自身の知識へ注意を向けるための余白である。
- 速度や劇性を一定周期の自動演出だけで作らない。
- 止まって見える静けさと、変化が枯れた定常状態を区別する。
- 音楽連携は将来候補として保持するが、作品の核が単独で成立するまで実装しない。

## 5. 作品を生む三層

### 5.1 層A — Note Life Physics

実ノートは作品の原因であり、単なる描画点ではない。

- 一つのlogical noteは一つのidentityを持つ。
- MVPでは一つのlogical noteを一つの可視光として保つ。装飾衛星や微粒子へ分解せず、光そのものの運動、材質、残響に個性を現す。
- 各noteは、内容、時点、link、構造に加え、境界と型、出所、不確実性、改訂残留、時間痕跡などの複数軸を保持する。
- 複数軸は、慣性、拡散、結合、離脱、痕跡保持、相転移参加、揺らぎなどへ分散して作用する。
- 一つの属性が、明るさ、中心性、寿命、価値をまとめて支配しない。
- 同じnoteでも周囲、鑑賞時刻、場の履歴によって別の現れ方を許す。

### 5.2 層B — Art Score

Art Scoreは作品の時間構成である。意味や価値を決めるAIではなく、**資料から生じ得る出来事を、いつ、どの尺度、密度、極性、生成様式で見せるか**を決める演出譜である。

連続parameter:

- 共有場への書込み量と追従量
- 場の減衰、尺度、渦度、拡散
- 視覚片の密度、速度上限、寿命
- dust／filament／membrane／cloudの混合比
- 余韻、blur、露出、背景の深度
- camera drift、画角、負空間

離散cue:

- 地層からの出現
- 過去の流れからの再出現
- 回帰する主題の再点灯
- 異なる層の一時合流
- 膜化、破断、溶解、反転
- memoryの局所的な沈殿と再発光

資料現象が`何が起こり得るか`を供給し、Art Scoreが`いつ、どの規模で見せるか`を決める。呼吸の強さ、速さ、長さも、資料時間、現象密度、場の現在状態と履歴から決める。

### 5.3 層C — Material Renderer

基調は白、銀、灰と暗い宇宙で始める。note別の多色化はMVPへ戻さず、固有差はまず運動、密度、境界、残留、変態で成立させる。

- **dust**: 疎で速い微粒子。遠方、探索、離脱。
- **filament**: 点から伸びる線ではなく、共有場の通過域に連続的に現れる細流。
- **membrane**: 複数の流れが一時的に面を感じさせる薄い境界。
- **cloud**: 低周波で階調が滑らかな密度。格子状mosaicや白い塊を避ける。

直線edge、node輪郭、固定halo、全画面を埋める均一な煙は使わない。残像bufferを重ねるだけで煙を作らず、速度場の密度・発散・渦度からmaterialを変える。

## 6. 全体データフロー

```text
Markdown notes
    ↓ read-only observation
Note observations ─→ local phase signatures ─→ eligible phenomena
    ↓ identity / provenance                    ↓
logical note agents ───────────────────────→ Art Score
    ↓                                          ↑
logical note lights ↔ shared velocity/density field
    ↓
dust / filament / membrane / cloud renderer
    ↓
鑑賞Canvas           provenance receipt → 任意のmaking-of
```

`provenance receipt`は描画用状態と分ける。作品画面を説明で埋めず、後からsource note id、使った観測軸、欠落、選定理由を追跡できるようにする。

## 7. 自律する作品時間

### 7.1 固定sceneではなく重なるmovement

作品は章タイトルを表示しないが、内部では次のmovementが重なって移る。

1. **Emergence** — 広い負空間から、ごく少数の地層が立ち上がる。
2. **Coherence** — 異なるnote片が共有場へ履歴を書き、細流と仮の像を作る。
3. **Transformation** — 回帰、合流、膜化、破断によって構図が大きく変わる。
4. **Afterlife** — 元の群れを保たず、痕跡だけが次の出現へ影響する。

毎回同じ割合で切り替えるのではなく、Vault側の現象密度、資料時間の隔たり、直前の場の状態、まだ現れていない資料候補からkeyframeを組む。同じseed、同じVault snapshot、同じ鑑賞時刻では再現可能にする。

### 7.2 二つの時間尺度

- **作品脈拍**: 数秒〜数十秒。流速、渦度、発生、接触、ほどけを連続変化させる。
- **資料気候**: 数分〜数十分。地層、回帰、合流、沈殿の出現比率と構図を変える。

作品脈拍だけでは単調なloopになり、資料気候だけでは変化が遅すぎる。両者を重ね、短い呼吸が同じでも長い構図が同じ場所へ戻らないようにする。

### 7.3 永続する変化

- Art Scoreは有限の曲ではなく、Vault snapshotから作る候補poolを循環させる。
- 一度使ったcandidateはcooldownへ入り、場の履歴が十分ほどけるまで同じ役割で再使用しない。
- 一周後は組合せ、空間尺度、極性、参加率を変え、同じsceneを再生しない。
- まれな大域変化の間にも、局所的な誕生、衝突、消散を絶やさない。
- 静かな区間にも次の変化へ向かう場の勾配を残す。

## 8. 技術構成

### 8.1 再利用する現行資産

- `src/core/life-weather.ts`: 実note観測、128次元の損失的内容特徴、地層、発芽、回帰、空気、合流、出典と不確実性。
- `work/archive-weather-prototype/note-model.mjs`: 8 phase軸、9 dynamic signature、note間の非対称応答、48×30の共有memory場。
- `work/archive-weather-prototype/prototype.mjs`: WebGL2 instancingと材質描画の隔離試験場。
- `src/renderer/components/ObservatoryView.tsx`: 将来の製品統合先。設計検証中は触らない。

### 8.2 次に追加する最小責務

1. `Art Score compiler`: Vault snapshot、現象候補、seed、鑑賞時間からkeyframeとcueを作る純粋処理。
2. `Art Score player`: clock位置を補間し、共有場とrendererへ現在値を渡す。
3. `orbital event field`: 実資料から生じる一時重心の周囲で複数noteの光を捕獲、公転、離脱させる。
4. `higher-resolution field`: まず既存WebGL2で実測し、48×30 CPU場を段階的に高精細化する。
5. `provenance receipt`: cueとsource noteの対応を開発時とmaking-ofで確認できる小さな派生data。

最初からWebGPU、新規physics engine、audio library、永続DBを加えない。WebGL2と標準Web APIで品質または性能が不足すると実測された時だけ再判断する。

### 8.3 Rendererとsecurity境界

- Electronは`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`を維持する。
- LIFE Weatherの鑑賞中に外部network、任意navigation、popup、downloadを要求しない。
- note本文、raw特徴量、作品中間bufferをVault外へ送信しない。
- derived profileとprovenanceは実行中の派生物とし、Markdown正本を置き換えない。

## 9. MVP境界

MVPは一度に製品へ入れず、隔離prototypeで作品性、因果、長時間性を順に通す。音楽入力は含めない。

### Gate 3A — White Field Composition

実装:

- 一noteから複数の追跡可能な視覚片
- 共有速度／密度場の高精細化
- dust／filament／membrane／cloudの遷移
- Vault由来の固定seed Art Score
- 4分以上続き、さらに長く見ても変化が枯れない無音公演

合格:

- 4分間に少なくとも三度、遠目にも別の構図と分かる大域変化がある。
- どの時点も「点から線が伸びるnode graph」へ戻らない。
- cloudは格子mosaic、均一白blur、固定haloに見えない。
- 同じ入力／seedは再現し、note由来条件を変えると局所と大域の両方に説明可能な差が出る。
- 工房主が少なくとも90秒見て「漂う点」ではなく一つの作品と判定する。

### Gate 3B — Vault Causality

実装:

- time、content、link、structure、phaseの各入力が、異なる局所力学と出来事候補へ作用する。
- 一件差替え、各track ablation、candidate除去を比較できる。
- making-of用provenanceで、大きなcueのsource noteと選定理由を追跡できる。

合格:

- 同じsnapshot／seedでは再現可能である。
- 一trackを外した時、そのtrackが担う差だけが失われる。
- 一noteの変更が全体をrandom resetせず、局所差から後続の場へ伝播する。
- linkを外しても全現象が消えず、linkの欠落を無関係と断定しない。
- provenanceが作品の真理やnote価値を主張しない。

### Gate 3C — Long-lived Composition

実装:

- candidate cooldownと再編成
- 作品脈拍と資料気候の二時間尺度
- 長い静けさ、局所活動、大域変化の非同期構成
- pause／resumeと長時間boundedness

合格:

- 12分後も中心収束、固定cluster、全画面飽和、完全停止を起こさない。
- 4分ごとの三時点が、遠目にも別の大域構図を持つ。
- 同じ候補の同じ演出が短周期で反復しない。
- pause中は止まり、resume後は履歴を破壊せず続く。
- 工房主が「別の日にもう一度見たい」と判定する。

## 10. 性能方針

現行約599 logical notesを一件一particleのまま増やすのではなく、logical noteと描画fragmentを分離する。目安は一noteあたり8〜16 fragmentsだが、固定仕様にせず実測で決める。

- WebGL2 instancingを維持する。
- DPRを上限管理する。
- 最初にfragment数、場の解像度、blur passを計測する。
- 通常目標は45fps以上、望ましい目標は60fpsとする。
- 負荷時は意味層を削らず、fragment数、場の解像度、material passの順に落とす。
- 長時間で停止、NaN、中心収束、全画面飽和、永久固定clusterを起こさない。

WebGPUはWebGL2で作品要件を満たせない測定証拠が出るまでHeldとする。

## 11. 因果と作品性の受入

### 11.1 四つの比較

1. **Same Vault / Same seed**: 再現可能。
2. **Same Vault / Different daily seed**: 同じVaultらしさを保ちながら別公演になる。
3. **Different Vault condition / Same seed**: 出来事、集団、残留が変わる。
4. **Track ablation**: time、content、link、structure、phaseの寄与差を確認できる。

### 11.2 失敗と判定する状態

- 点が漂い続けるだけ。
- 外部刺激がないため数分後に定常化する。
- 全公演で同じmovementが同じ構図になる。
- note差がhash色やrandom seedだけに見える。
- 細流がnodeから伸びるedgeに見える。
- cloudが白いmosaic、汚れ、screen blurに見える。
- 時間経過で変化がなくなる、または一つの塊へ収束する。
- sourceを変えても作品がほぼ同じ。
- 説明を読まないと良さが分からない。

### 11.3 工房主の最終三問

1. これは、自分のノートだからこうなったと感じるか。
2. 説明なしに、少なくとも90秒見続けたいか。
3. 別の日、蓄積後にもう一度見たいか。

一つでも否なら、製品統合へ進めない。自動testはこの採否を代替しない。

## 12. Roadmap

### 完了

- 実note観測とLife Weather Profile
- phase signatureとnote固有dynamic signature
- 共有memory場の初期試験
- Tendrils全編とeditorから、共有場、個体差、描画残留、spawn、preset、keyframeを分離
- paletteの白〜灰へのreset
- 本全体設計

### 次の一手

**Gate 3Aの前半だけ**を隔離prototypeで実装する。

1. logical noteと可視光を一対一に保ち、一時重心まわりの公転を共有力学として作る。
2. Art Scoreの純粋なdata modelと90秒分の最初のscoreを作る。
3. 共有場を高精細化し、dustとfilamentの二材質だけで90秒を成立させる。

ここで工房主が実見し、成立した場合だけmembrane／cloudと4分構成へ進む。音楽なしで作品の核を検証する。

### Held

- 製品`ObservatoryView`への統合
- 本番反映、Git delivery
- WebGPU、3D camera、VR
- 音楽連携全般。Local audio、YouTube、効果音、AI作曲、推薦
- mic、camera、system audio capture
- YouTube音声の抽出、download、FFT
- preset editorの利用者公開
- 動画export、共有gallery、cloud rendering
- note value／importanceの自動評価

### Research

- 無音作品が長時間の注意を保つ構成原理
- 長期Vaultでの資料時間と再同定
- membrane／cloudのmaterial研究
- 将来音楽を足す場合もArt Scoreの自律性を保てるか
- 同じVaultらしさを、固定styleへ閉じずに評価する方法

## 13. PRFAQ要約

### Q. Graph viewと何が違うのか

Graphは主に明示linkを読む道具である。LIFE Weatherは、実noteの差異、時間、関係、履歴、不確実性が共有場へどう作用するかを鑑賞する作品であり、link線を中心にしない。

### Q. なぜ音楽を付けないのか

外部の曲が作品の劇性を代行すると、TSUZUNEの知識が芸術になったのか、曲に合わせた粒子映像なのか判別できないためである。まず資料と場だけで作品を成立させる。

### Q. ノートが画面のどれか分からなくならないか

鑑賞中は説明を抑えるが、各光のlogical note identityを保持する。光へのhoverと任意のmaking-ofで、作品cueとsource note、使用軸、欠落、不確実性を追える。

### Q. 何をもってMVP完成とするのか

無音の4分作品、Vault因果比較、12分の長時間構成と工房主の三問を通り、初めてMVPとする。

## 14. 非実施境界

本設計ではcode、runtime、CSP、package、本番アプリを変更しない。外部依存と音楽機能を追加せず、production updateを行わない。次の明示指示を受けた場合だけ、Gate 3A前半へ進む。
