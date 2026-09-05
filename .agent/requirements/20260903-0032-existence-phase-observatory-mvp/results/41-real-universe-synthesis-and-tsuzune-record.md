---
type: research-note
role: knowledge
category: ソフトウェア開発
topics:
  - 実在宇宙
  - 天体物理
  - 科学可視化
status: verified-research-foundation-awaiting-owner-direction
created: 2026-09-05
updated: 2026-09-05
observed_at: 2026-09-05T01:33:56+09:00
scope: project:tsuzune/observatory-life-weather
subject: real-universe-visual-foundation
confidence: mixed-observation-standard-model-unresolved-and-art-inference-separated
freshness: recheck-on-reference-target-selection-or-major-observational-update
---

# TSUZUNE 実在宇宙の構造・光・時間 — 制作基盤調査

## このノートの位置づけ

これは、[[TSUZUNE-Life-Weather-人生の時間モデル実装計画-2026-09-03]] の次の芸術方向を決めるために、いったん存在相理論から離れ、実在する宇宙の構造・物質・光・エネルギー・時間を調べた制作基盤である。

宇宙百科事典ではない。観測と物理から、持続する立体作品に何を移せるかを判断するためのノートである。Gate 3Cまでの制作物は技術検証を通過したが、工房主の「感じない」という評価により芸術方向としては不採用になった。この調査中は、prototype、製品コード、本番TSUZUNE、画像、音楽、Git deliveryを変更していない。

関連する判断と実行証拠は [[TSUZUNE-観測宙域MVP採用・要件定義-実施記録-2026-09-03]]、上位の入口は [[TSUZUNE]] に置く。

## 先に結論

実在宇宙の芸術性は、光る天体を増やすことでは生まれない。より根本にあるのは次の五つである。

1. **尺度の階層** — au、光年、pc、kpc、Mpcが同じ速度・同じ密度で動かない。
2. **不可視の主役** — 暗黒物質、冷たい分子ガス、塵、磁場、温度や速度は、可視光だけでは直接見えない。
3. **エネルギーが物質を変える因果** — 放射、重力、shock、恒星風、jetは、単に光るのではなく周囲の密度・温度・化学・運動を変える。
4. **流入と流出の同居** — 集積、降着、双極流、散逸、圧縮、再流入は一本道ではなく、異なる場所で同時に起こる。
5. **異なる時計** — 光、shock、原始星、雲、恒星、銀河は桁違いの時間尺度を持つ。短い作品では時間圧縮と異年齢構造の同居を明示する必要がある。

この条件を一つの持続する場所で最も豊かに満たす第一候補は、**一つの星形成複合体（Stellar Nursery）**である。ただし、科学simulationや観測像を名乗らず、**physics-informed artistic mapping**として扱う。実装前に、Orion Bar型PDR、L1527／Herbig-Haro型の低質量原始星＋jet、NGC 3603／30 Doradus／Carina型の大質量星団feedbackのいずれを参照軸にするか、工房主が選ぶ。

## 読み方 — 主張の四分類

- **[O] 観測**: 望遠鏡、検出器、survey、spectrum、重力レンズなどから得られた測定。
- **[M] 標準的説明**: 複数の観測と整合する物理模型・標準模型。観測そのものではない。
- **[U] 未解決**: 観測差、機構、物質の正体、一般化範囲が確定していない領域。
- **[A] 芸術への推論**: 制作に移すための判断。自然科学上の発見や実証ではない。

この四つを混ぜないことが、本調査の最重要境界である。

## 1. 宇宙史と大規模構造

### 1.1 観測可能宇宙と宇宙全体は同じではない

- [M] 宇宙年齢はbase-ΛCDMで約138億年と推定される。[S01][S03][S04]
- [M] 現在距離で表した観測可能領域は直径約920億光年である。これは宇宙全体の大きさではない。[S02]
- [O] 最古級の直接観測光である宇宙背景放射は、ビッグバン後およそ38万年の宇宙を映し、微小な温度・密度差を含む。[S03][S04]
- [M] その密度差が重力的不安定性によって成長し、銀河、銀河団、filament、sheet、voidを形づくった、という像が標準的である。[S01][S05][S06]
- [U] 宇宙全体が有限か無限か、inflationの物理的駆動源、dark energyの本性は未確定である。

[A] 奥行きは距離だけでなくlookback timeを伴う。ただし、一画面の遠景をそのまま宇宙史と呼んではならない。

### 1.2 光るものは宇宙の総量を代表しない

- [M] Planckのbase-ΛCDMでは、全質量・energy密度の約4.9%が通常物質、約26.8%がdark matter、約68.3%がdark energyである。[S01][S04]
- [O] 暗黒物質は光を放出・吸収・反射しないが、弱い重力レンズや銀河団衝突における通常物質との位置分離から、質量分布として捉えられる。[S06][S07]
- [U] 暗黒物質の粒子的正体、銀河中心・外縁での精密分布は未解決である。[S07][S08]

[A] 不可視の骨格は、均一な青い網として描くより、発光ガス、銀河、遮蔽、速度、lensingの**配置結果**として感じさせる方が実在宇宙に近い。

### 1.3 Cosmic webは均等なnetworkではない

- [O/M] Cosmic webは、密なnode、filament、sheet、低密度のvoidからなる物質分布である。弱い重力レンズ、銀河分布、吸収線、simulationの整合が支持する。[S05][S06][S12][S13]
- [O] Euclid Q1は大規模な銀河分布と重力レンズ候補を示す観測dataであり、それ自体が最終宇宙論結果ではない。[S12][S13]
- [U] filamentやvoidの境界は分類法で変わり、すべてのfilamentが同じ密度・温度・発光を持つわけではない。

[A] 宇宙網を線の集合にせず、**節へ偏る物質、疎な空洞、太さの揺らぎ、途中で消える観測可能性**として扱う。

### 1.4 銀河は閉じた島ではない

- [O/M] 銀河はdark-matter halo、gas、dust、starsなどからなる複合系であり、多くの銀河では中心のmassive black holeも活動史へ関与し得る。周囲からのgas流入、星形成、stellar／AGN feedback、流出、衝突・合体と接続する開放系として理解される。[S09][S10][S11]
- [O] 初期銀河の周辺に、将来の星形成燃料になり得る高密度gasが観測された例がある。[S11]
- [O/M] 銀河合体はgasを圧縮して星形成を促す場合がある一方、中心活動と流出がgasを失わせ星形成を抑える場合もある。[S09][S10]
- [U] 個別銀河で流入・星形成・black-hole feedbackの因果寄与を一つの見た目から決めることはできない。

[A] 銀河を剛体的な一方向渦へ還元しない。中心、円盤、halo、流入、流出は密度も速度も時間も異なる。

## 2. 尺度と時間 — 同じ速さにしない

| 層 | 代表的な空間尺度 | 代表的な時間尺度 | 観測／模型上の意味 | 制作上の境界 |
|---|---:|---:|---|---|
| 原始星source／disk | 0.1–100 au級 | 10万–100万年級 | 降着、回転、jet launch | 円盤を完全な平板、jetを固定光線にしない |
| envelope／双極outflow | 100–100,000 au級 | 10³–10⁵年以上 | 物質供給と運動量feedback | 供給と排出を同じ流れにしない |
| 分子雲／GMC | 数pc–数十pc級 | CO-visibleで約5–30 Myrの研究例 | cooling、turbulence、gravity、magnetic field | 雲全体を高速で呼吸させない |
| feedbackによる露出・散逸 | pc–数十pc級 | 約1–5 Myrの研究例 | UV、wind、H II、PDR、shock | 常に圧縮、常に散逸とはしない |
| 銀河 | kpc–100 kpc級 | 10⁸–10¹⁰年級 | 回転、流入、合体、星形成史 | ひとつの剛体渦にしない |
| Cosmic web | Mpc–Gpc級 | 10⁹–10¹⁰年級 | gravityによる構造成長 | 実時間の動線や均等な光網にしない |

上の値は桁と代表例であり、すべての天体に共通する定数ではない。[S21][S22][S23][S24]

[A] 30〜90秒の作品で可能なのは、実時間再現ではなく、次のいずれかである。

- 小尺度の速い挙動と大尺度のほぼ静止した形を同居させる。
- 異なる年齢の領域を同じ星形成複合体の中に置く。
- 時間圧縮を明示し、物理simulationと称さない。
- camera cutで時代を飛ばさず、ひとつの場所を持続させたまま局所現象の強弱が移るようにする。

## 3. 星形成と物質循環 — 一本の物語ではない

### 3.1 因果骨格

`拡散ISM → 冷却・圧縮・分子化した雲 → 密度揺らぎ／filament／dense core → 重力収縮と角運動量による降着disk → protostarと双極jet／outflow → 核融合星 → UV・stellar wind・H II／PDR・shock → 雲の圧縮または散逸 → 大質量星だけがsupernovaと元素放出 → ISM`

これは説明用の骨格であり、一本道の進行chartではない。[S15]–[S35]

- [O/M] 分子雲ではgravity、supersonic turbulence、magnetic field、radiation、chemistry、dustが相互作用する。[S15][S18][S19][S20]
- [O] 54銀河を横断した研究では、CO-visible molecular cloud lifetimeはおよそ5〜30 Myr、若い星が露出してからfeedbackで雲が散逸する時間はおよそ1〜5 Myrで、環境依存性が大きい。[S21][S22]
- [O] NGC 300を対象とした研究では、雲寿命約10 Myr、feedback段階約1.5 Myr、star-formation efficiency約2〜3%という例が得られた。これは全宇宙の固定値ではない。[S23]
- [M] 角運動量を持つ降着はdiskを作り、磁気的機構を含むjet／outflowが概ねdisk面に垂直な双極方向へ出る。[S24][S25][S26]
- [O] dust continuum、CO、SiOはそれぞれdense material、molecular outflow、強いshockなど異なる成分を追跡する。[S27]
- [O] 大質量星のUVとwindはPDR、ionization front、H II regionを作り、gasを加熱・化学変化・流出させる。[S30][S31][S35]
- [O/M] 大質量星の一部はsupernovaとなり、shock、高温gas、energetic particles、重元素をISMへ戻す。[S32][S33]

### 3.2 分岐と反証

- [O/M] すべてのdense coreが星になるわけではない。供給不足、turbulence、magnetic support、feedbackで散逸する経路がある。
- [O] Orionの304 protostarを調べた研究では、outflow cavityが年齢とともに単調に広がる証拠が得られなかった。[S28]
- [U] outflowが近隣の星形成を誘発したか、既に進行していた形成を露出しただけかは、衝突像だけでは確定しない。[S27]
- [O/M] すべての星がsupernovaになるわけではない。終末は初期質量と進化履歴に依存する。[S32]
- [U] magnetic fieldとturbulenceの相対的重要度、大質量星のdisk accretion、jet駆動機構、triggered star formationの一般則は未決着である。[S18][S19][S20][S24]

[A] 「中心へ吸い込まれ、完成し、爆発して終わる」という単線型演出を避ける。局所的な集積、失敗、遮蔽、双方向のescape、shock後の圧縮と散逸を併置する。

## 4. 光は物質ではなく、観測との関係で見える

### 4.1 物理sceneと観測画像を分ける

天文画像は一般に、`到来photon／intensity → detector response → calibration → alignment／projection → dynamic-range stretch → channelへの色割当`を経て表示される。[S36][S37][S40]

- [O] 可視以外の波長には、人間が肉眼で見る固有色はない。色はenergy、filter、元素、強度などを表すために割り当てられる。[S36][S38][S39][S40]
- [O] multiwavelength compositeは、異なるbandの測定を、必要に応じて別の望遠鏡・観測時点から位置合わせした表現であり、一瞬の肉眼風景ではない。[S38][S39]
- [O/M] redshiftはspectral lineやspectrum全体の波長変位であり、遠方天体を単に赤く塗ることではない。[S41]
- [O/M] gravitational lensingは前景質量が背景像の位置、形、倍率、複像を変える現象であり、任意の中心に付ける装飾的なradial warpではない。[S42]

### 4.2 発光・散乱・遮蔽・tracerを混ぜない

| 見え方 | 物理的な主因 | 例 | 制作での誤読 |
|---|---|---|---|
| emission | 電離gasのline、thermal dust、synchrotron、X-ray plasma | H II、warm dust、SNR | すべてを同じglowにする |
| scattering／reflection | star lightがdustで散乱 | reflection nebula | 物質自身の発光と混同する |
| absorption／extinction | 手前のdust／gasが背景光を遮る | dark cloud、pillar | 暗部を空白や黒い煙とみなす |
| spectral tracer | 原子・分子lineやcontinuumが状態を選択的に示す | CO、SiO、Hα、X-ray | 色をその物質の肉眼色と断定する |
| lensing | 前景質量による時空の曲がり | arc、multiple image | 画面効果として常時使う |

### 4.3 波長は別々の世界ではなく、同じ物質の別の測り方

| 観測band | 主に追えるもの | 重要な境界 |
|---|---|---|
| visible | stellar continuum、ionized-gas lines、reflection、dust extinction | narrow-band RGBはnatural colorとは限らない |
| NIR／MIR | 埋もれたprotostar、warm dust、PAH、可視より透過しやすい構造 | IRは単純な温度mapではない |
| radio／mm | cold dust continuum、molecular line、velocity cube | interferometer像はuv samplingとdeconvolutionを経る |
| UV | young／hot stars、ionizing interface | 色だけで温度・年齢を一意に決めない |
| X-ray | hot shock、energetic plasma、nonthermal particles | 青いplasmaという肉眼色ではない |

[A] 制作では、**physical scene／measurement layer／display layer**を分ける。色、3D奥行き、時間補間が創作なら、astronomical-data-inspired／artistic mappingと明記する。

[A] 本調査でscientific visualizationを名乗るための最低開示項目は、target、observation ID、instrument、filter／line、calibration version、projection、color map、stretch、alignment、radioならuv sampling／deconvolutionである。[S37][S40]

## 5. カメラ・光・流れを一つの宇宙に置く

過去のprototypeで生じた「cameraと光の動きに対して流れが追従せず独立して見える」違和感は、実在宇宙を参照しても自動では解決しない。根本境界は座標と因果にある。

- [A] gas、dust、stars、shock、emission、absorptionは同じworld-spaceに存在する。
- [A] cameraは物質を動かさない。cameraが変わる時は、全layerの**投影、遮蔽、parallax、apparent brightness**が同じ変換で変わる。
- [A] light sourceは照明だけでなく、UV／wind／shockとして周囲の温度・電離・密度を変える。ただし変化には距離と時間差がある。
- [A] flowの方向はcameraではなく、gravity、pressure gradient、rotation、magnetic field、jet axis、shock frontによって決まる。
- [A] camera pathはscene cutの列ではなく、同じ場所を連続して回り込み、近景のdust、中央のfront、遠景のstar fieldのparallaxで奥行きを示す。
- [A] 大尺度形状は持続し、局所の速い粒子・shock・flickerだけが変わる。これにより「変化はあるが場所が消えない」状態を作る。

## 6. 制作候補の比較

| 候補 | 実在宇宙から得られる強み | 最大の弱点／反証 | 現在判断 |
|---|---|---|---|
| Cosmic web | 最大尺度、voidとnode、不可視gravity | 変化がGyr級。均一なgraph線に堕ちやすい | Research。第一作には広すぎる |
| 一つのgalaxy | 長時間持続、gas流入、disk／halo／feedback | rigid spiral cliché。Gyr変化を誇張しやすい | Held。第二候補 |
| Black-hole accretion | gravity、heating、relativistic jetの因果が強い | 中心依存の構図。GR／lensing表現の厳密さが必要 | Held。別作品向き |
| Supernova remnant | shock、元素、hot gas、速度の層が明確 | terminal event寄りで持続場の中心にしにくい | Held。履歴layerには有効 |
| Stellar Nursery | dark core、inflow、disk、jet、shock、PDR／H II、異年齢星を一つの場所に置ける | fog wallpaper、偽の自然色、複数天体の無根拠collageになりやすい | **第一候補** |

Stellar Nurseryを選ぶ理由は、宇宙のすべてを縮小できるからではない。一つの開放系の中で、**暗さが物質であり、光が作用であり、流入と流出が分岐し、異なる時計が共存する**からである。[S17][S21]–[S35]

## 7. Gate 3Dに渡せる制作原理

### 採用できる原理

1. **一つの場所を持続させる** — shot切替で別宇宙へ飛ばず、同じ星形成複合体の中を移動する。
2. **暗さを物質として扱う** — dense dustは空白でなく、光を遮り、奥行きを作り、内部を隠す。[S29]
3. **流れを双方向・非対称にする** — diffuse inflow、local collapse、disk rotation、bipolar outflow、photoevaporationを別の速度と幅で置く。
4. **光を作用へ戻す** — glowだけでなく、ionization front、PDR、shock、heated dustとして周囲の状態変化を伴わせる。[S30][S31][S35]
5. **尺度ごとに時間を分ける** — 大きな雲はほぼ持続し、小さなshockや粒子は速く、星の世代差は空間分布で示す。
6. **観測bandを意味として使う** — 色は雰囲気で選べるが、何を強調した割当かを制作noteに残す。[S36]–[S42]
7. **共通world transformを守る** — camera、light、flow、dust、starsを独立したscreen effectにしない。

### 禁止するshortcut

- 宇宙全体を一枚の均等な光るnetworkにする。
- すべての流れを画面中央への吸引または同じ方向のparticle motionにする。
- camera cutごとに物質場、光源、流れの位相をresetする。
- redshiftを単なる赤色化、X-rayを自然な青色、dark matterを発光物質として描く。
- nebulaの暗部を透明な背景や黒いfogにする。
- すべてのcoreが星になり、すべての星がsupernovaになる一本線を作る。
- 複数の実在天体を一つの観測対象のように合成し、出典と創作範囲を隠す。
- 30〜90秒の変化を実時間の天体物理simulationと称する。

## 8. 未解決事項と停止線

調査で決まったのは**題材の第一候補と誠実な表現境界**までである。実装はまだ始めない。

次に工房主が選ぶ最小判断は、同じStellar Nurseryの中でも何を主因にするかである。

1. **Orion Bar型PDR** — UVが分子gasを解離・電離し、層状frontを動かす。光と物質変化が最も直接的。
2. **L1527／Herbig-Haro型の低質量protostar＋jet** — 降着と双極outflowの流れが最も追いやすい。
3. **NGC 3603／30 Doradus／Carina型のmassive-cluster feedback** — pillar、cavity、H II、winds、異年齢星団が共存し、最も壮大。ただし複雑で混成しやすい。

選択後に、対象固有の一次観測、band、物理尺度、創作する3D奥行き、時間圧縮規則を限定調査する。それまではshader、WebGPU、camera、particle、音、製品配線を変更しない。

## 9. Claim-to-source ledger

| Claim ID | 要点 | 分類 | 根拠 | 信頼境界 |
|---|---|---|---|---|
| C01 | 宇宙年齢約13.8 Gyr | M | S01,S03,S04 | base-ΛCDM依存 |
| C02 | 観測可能領域直径約92 Gly | M | S02 | 宇宙全体の直径ではない |
| C03 | CMBは約38万年後の光 | O/M | S03,S04 | 時期は標準宇宙論で解釈 |
| C04 | density fluctuationから大規模構造が成長 | M | S01,S05,S06 | 個別形態を一意に決めない |
| C05 | baryon／DM／DE比率 | M | S01,S04 | base-ΛCDM内部の推定 |
| C06 | dark matterをlensing・cluster衝突で検出 | O/M | S06,S07 | 粒子的正体は未解決 |
| C07 | cosmic webはnode／filament／sheet／void | O/M | S05,S06,S12,S13 | 境界は分類法依存 |
| C08 | galaxyは流入・feedback・合体と接続する開放系 | O/M | S09,S10,S11 | 個別因果は対象依存 |
| C09 | diffuse ISMからmolecular cloud形成 | M | S15,S16 | 形成経路は複数 |
| C10 | 星形成はgravity以外も含む多要因系 | M/U | S18,S19,S20 | 要因の相対寄与は未決着 |
| C11 | cloud lifetime約5–30 Myr、feedback約1–5 Myrの研究例 | O | S21,S22 | 54銀河sample、環境依存 |
| C12 | NGC 300で短寿命・低効率の研究例 | O | S23 | 一銀河の結果を普遍化しない |
| C13 | diskとbipolar jet／outflow | O/M | S24,S25,S26 | mass域・駆動機構に未解決あり |
| C14 | CO／SiO／dustは異なるtracer | O | S27 | tracerと物質の一対一対応ではない |
| C15 | cavity widthは年齢と単調対応しない | O | S28 | Orion sample内の反証 |
| C16 | 暗部はdense gas／dustになり得る | O | S29 | 2D像から密度・奥行きは一意でない |
| C17 | UV／windがPDR・H II・frontを作る | O/M | S30,S31,S35 | 圧縮／散逸の結果は領域依存 |
| C18 | stellar lifetime・終末は質量依存 | M | S32 | 全星がsupernovaではない |
| C19 | SNRはshock・hot gas・metalsを残す | O/M | S33 | ISM再混合の経路は対象依存 |
| C20 | 一領域に複数の形成段階が共存し得る | O | S17,S29,S34 | 同じ物体の時間経過ではない |
| C21 | 天文画像はcalibration・stretch・色割当を経る | O | S36,S37,S40 | pipeline／releaseごとに異なる |
| C22 | 波長ごとに追跡成分が異なる | O/M | S38,S39,S40 | compositeは肉眼の一瞬ではない |
| C23 | redshiftはspectral displacement | O/M | S41 | 単なる赤色化ではない |
| C24 | lensingは前景質量と幾何に依存 | O/M | S42 | 装飾的warpではない |

## 10. Source ledger — 2026-09-05確認

### 宇宙史・大規模構造

- **S01** Planck Collaboration, *Planck 2018 results VI: Cosmological parameters* (A&A 641 A6, 2020). https://doi.org/10.1051/0004-6361/201833910
- **S02** NASA, *How Big is Space? We Asked a NASA Expert: Episode 61*. https://www.nasa.gov/science-research/astrophysics/how-big-is-space-we-asked-a-nasa-expert-episode-61/
- **S03** NASA Science, *Overview: The Universe’s History*. https://science.nasa.gov/universe/overview/
- **S04** ESA, *Planck science highlights*. https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_science_highlights
- **S05** NASA Hubble, *Mapping the Cosmic Web*. https://science.nasa.gov/mission/hubble/science/science-highlights/mapping-the-cosmic-web/
- **S06** NASA Hubble, *Hubble Maps the Cosmic Web of “Clumpy” Dark Matter in 3-D* (2007). https://science.nasa.gov/missions/hubble/hubble-maps-the-cosmic-web-of-clumpy-dark-matter-in-3-d/
- **S07** NASA Hubble, *Hubble Dark Matter*. https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-dark-matter/
- **S08** ESA Gaia, *Does the Milky Way contain less dark matter than previously thought?* (2023). https://www.cosmos.esa.int/web/gaia/iow_20230927
- **S09** NASA Science, *Evolution: Galaxies*. https://science.nasa.gov/universe/galaxies/evolution/
- **S10** NASA Science, *Why Do Some Galactic Unions Lead to Doom?* (2019; updated 2024). https://science.nasa.gov/universe/exoplanets/why-do-some-galactic-unions-lead-to-doom/
- **S11** NASA Webb, *Galaxies Actively Forming in Early Universe Caught Feeding on Cold Gas* (2024). https://science.nasa.gov/missions/webb/galaxies-actively-forming-in-early-universe-caught-feeding-on-cold-gas/
- **S12** ESA, *Euclid opens data treasure trove, offers glimpse of deep fields* (2025). https://www.esa.int/Science_Exploration/Space_Science/Euclid/Euclid_opens_data_treasure_trove_offers_glimpse_of_deep_fields
- **S13** ESA／Euclid Consortium, *Euclid Explanatory Supplement: Data Release Q1*. https://euclid.esac.esa.int/dr/q1/expsup/master.html
- **S14** ESA, *Planck reveals first stars were born late* (2015). https://www.esa.int/Science_Exploration/Space_Science/Planck/Planck_reveals_first_stars_were_born_late

### 星形成・feedback・物質循環

- **S15** Hennebelle, Mac Low & Vázquez-Semadeni, *Diffuse interstellar medium and the formation of molecular clouds* (2007). https://arxiv.org/abs/0711.2417
- **S16** NASA, *NASA’s GUSTO Prepares to Map Space Between the Stars* (2023). https://science.nasa.gov/missions/scientific-balloons/nasas-gusto-prepares-to-map-space-between-the-stars/
- **S17** NASA Webb, *Webb’s Star Formation Discoveries*. https://science.nasa.gov/mission/webb/science-overview/science-explainers/webbs-star-formation-discoveries/
- **S18** McKee & Ostriker, *Theory of Star Formation* (2007). https://arxiv.org/abs/0707.3514
- **S19** Krumholz, *Star Formation in Molecular Clouds* (2011). https://arxiv.org/abs/1101.5172
- **S20** Pattle et al., *Magnetic fields in star formation: from clouds to cores* (2022). https://arxiv.org/abs/2203.11179
- **S21** Chevance et al., *The molecular cloud lifecycle* (2020). https://arxiv.org/abs/2004.06113
- **S22** Kim et al., *Environmental dependence of the molecular cloud lifecycle in 54 main sequence galaxies* (2022). https://arxiv.org/abs/2206.09857
- **S23** Kruijssen et al., *Fast and inefficient star formation due to short-lived molecular clouds and rapid feedback* (Nature 569, 2019). https://www.nature.com/articles/s41586-019-1194-3
- **S24** Frank et al., *Jets and Outflows From Star to Cloud* (2014). https://arxiv.org/abs/1402.3553
- **S25** ALMA, *How Newborn Stars Prepare for the Birth of Planets* (2020). https://www.almaobservatory.org/en/press-releases/how-newborn-stars-prepare-for-the-birth-of-planets/
- **S26** NASA, *Chapter 1 — A Star is Born*. https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-1/
- **S27** ALMA, *Outflows from Baby Star Affect Nearby Star Formation*. https://www.almaobservatory.org/en/press-releases/outflows-from-baby-star-affect-nearby-star-formation/
- **S28** NASA／ESA／STScI, *Hubble Shows Torrential Outflows from Infant Stars May Not Stop Them from Growing* (2020). https://science.nasa.gov/missions/hubble/hubble-shows-torrential-outflows-from-infant-stars-may-not-stop-them-from-growing/
- **S29** NASA Webb, *NASA’s Webb Explores Largest Star-Forming Cloud in Milky Way* (2025). https://science.nasa.gov/missions/webb/nasas-webb-explores-largest-star-forming-cloud-in-milky-way/
- **S30** NASA, *NASA’s Webb to Study How Massive Stars’ Blasts of Radiation Influence Their Environments* (2021). https://science.nasa.gov/missions/webb/nasas-webb-to-study-how-massive-stars-blasts-of-radiation-influence-their-environments/
- **S31** ESA／Hubble／NASA, *A transformation in progress* (2024). https://www.esa.int/ESA_Multimedia/Images/2024/06/A_transformation_in_progress
- **S32** NASA, *Star Lifecycle*. https://science.nasa.gov/mission/webb/star-lifecycle/
- **S33** NASA／CXC, *Chandra Finds Oxygen and Neon Ring in Ashes of Exploded Star* (2000). https://chandra.harvard.edu/press/00_releases/press_011400sn.html
- **S34** NASA Hubble, *The Life of Stars*. https://science.nasa.gov/missions/hubble/the-life-of-stars/
- **S35** NASA Webb, *How Dense Pillars Form in Molecular Clouds* (2024). https://science.nasa.gov/asset/webb/how-dense-pillars-form-in-molecular-clouds/

### 光・観測・可視化

- **S36** NASA, *Visualization: From Energy to Image* (2016). https://science.nasa.gov/ems/04_energytoimage/
- **S37** STScI, *JWST Science Calibration Pipeline*. https://jwst-docs.stsci.edu/jwst-science-calibration-pipeline
- **S38** NASA, *The Electromagnetic Spectrum with Hubble, Webb, and Spitzer Highlights*. https://science.nasa.gov/asset/webb/the-electromagnetic-spectrum-with-hubble-webb-and-spitzer-highlights/
- **S39** NASA, *Sensing the Universe*. https://science.nasa.gov/universe/sensing-the-universe/
- **S40** Chandra X-ray Center, *Adding Color to Chandra Images*. https://chandra.si.edu/photo/false_color.html
- **S41** ESA, *What is red shift?*. https://www.esa.int/Science_Exploration/Space_Science/What_is_red_shift
- **S42** NASA Hubble, *Gravitational Lenses*. https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-gravitational-lenses/

## 11. 関係

- foundation-for → [[TSUZUNE-Life-Weather-人生の時間モデル実装計画-2026-09-03]]
- evidence-for → [[TSUZUNE-観測宙域MVP採用・要件定義-実施記録-2026-09-03]]
- navigated-by → [[TSUZUNE]]
- constrained-by → [[TSUZUNE-AI実施記録契約]]
- source-results → `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/results/38-cosmic-structure-and-timescales-research.md`
- source-results → `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/results/39-stellar-formation-and-feedback-research.md`
- source-results → `.agent/requirements/20260903-0032-existence-phase-observatory-mvp/results/40-light-observation-and-visual-truth-research.md`
