# TSUZUNE LIFE Weather Current Plan

現在の設計正本は `life-weather-overall-design.md` とする。R0〜R5およびGate 1〜3B.5は採否と実験の履歴である。Gate 3C候補は工房主が「感じない」と不採用にした。現在は存在相理論を映像原理から一度外し、実在宇宙を一次資料から調べてGate 3Dの視覚・因果基盤を作るresearch段階である。

## Current research — 2026-09-05

- objective: 実在宇宙の構造、物質、光、エネルギー、時間を、Gate 3Dの芸術表現へ使える精度で徹底調査し、観測事実・有力理論・制作推論を分離した再利用可能なTSUZUNE知識へする。
- audience／decision: 工房主と後続の制作Agent。次のisolated prototypeで採用する宇宙現象と、模倣してよい形・因果・時間圧縮の境界を決める。
- scope: 宇宙大規模構造、銀河、星間物質、恒星誕生、恒星風・放射・jet、超新星残骸、光の放射・吸収・散乱、観測波長とfalse color、宇宙の尺度と時間。compact object／accretionは第一候補比較に必要な概説へ限定する。
- assumptions: 「宇宙全百科」ではなく作品制作に影響するclaim familyを深く扱う。現在までの観測と標準的な物理説明を中心にし、未解決問題と推論を明示する。
- source classes: NASA、ESA、STScI、ESO、NRAO等の公式mission／observatory資料、査読論文・公式dataset・一次研究。百科事典的二次資料は用語確認に限定する。
- deliverables: source-backed研究ノート1件、claim-to-source ledger、制作原則、比較表、同一campaignの計画・実施記録・入口導線の最小更新、workflow evidence。
- success: (1) 主要現象の因果・尺度・時間・可視／不可視がprimary evidenceで追跡できる、(2) 観測事実・理論・art inferenceが混同されない、(3) TSUZUNEでread-back、一意検索、既存入口からのbacklinkが確認できる。
- lane: Orchestrated。3つの独立research laneを最大3 Agentへ分け、CEO-01がgap matrix、反証検索、統合、最終TSUZUNE writeを所有する。
- discovery: 各laneで高信号な公式資料とoriginal researchを収集し、claim、根拠、URL、confidence、矛盾、gapを返す。
- follow-up: 最初の証拠を統合して不足・対立だけを二次検索し、重要claimを親が一次資料でspot-checkする。
- synthesis: 宇宙現象の比較、Stellar Nursery仮説の反証、映像へ移せる物理因果と禁止すべき誤読を一つの研究ノートへ統合する。
- verification: citation URL、source metadata、claim境界、TSUZUNE revision guard、read-back、一意検索、backlinkを確認する。
- non-actions: prototype code、製品、本番、Git、画像生成、音楽、WebGPU、存在相理論の正本は変更しない。
- stop: 研究ノートと導線の検証完了で止める。Gate 3D実装は研究結論を工房主へ提示した後の別gateとする。
- outcome: 42の査読論文／公式資料と24主要claimを、観測、標準的説明、未解決、芸術への推論へ分離した。実在宇宙の制作価値は、尺度階層、dark material／occlusion、物質を変えるenergy、非対称な流入／流出、異なる時計の共存にある。
- current decision: 一つの持続するStellar Nurseryを制作上の第一候補とする。科学的唯一解やsimulationではなく、physics-informed artistic mappingとして扱う。
- verification result: 独立監査の初回FAIL 4点を修正し、四分類、数値留保、42 source ledger、推薦境界を再監査PASS。TSUZUNEのexact normalized read-back、file／path一意検索1件、project／root／実施記録からのbacklink 3件を確認した。
- evidence: `results/38-cosmic-structure-and-timescales-research.md`、`39-stellar-formation-and-feedback-research.md`、`40-light-observation-and-visual-truth-research.md`、`41-real-universe-synthesis-and-tsuzune-record.md`、`42-real-universe-independent-verification.md`。
- next gate: 工房主がOrion Bar型PDR、L1527／Herbig-Haro型の低質量protostar＋jet、NGC 3603／30 Doradus／Carina型のmassive-cluster feedbackから一つの参照軸を選ぶ。選択前に実装へ進まない。

## Current evolution — 2026-09-05

- objective: Gate 3B.5の白い宇宙、599 note光、連続したflow／depth／cameraを核として残し、光の発生・凝集・解離・余韻が一つの因果として感じられる芸術的・神秘的な候補へ進化させる。
- deliverables: `work/archive-weather-prototype/`の最小renderer／composition差分、公開挙動を固定する専用test、live Codex内browser候補、統合evidence。
- constraints: isolated prototypeのみ。実note identityと資料由来現象を守り、偽の星・線・煙、固定scene切替、説明HUD、色の足し散らし、新規依存、音楽、製品統合、本番反映、Git deliveryを行わない。dirty worktreeの無関係変更を保持する。
- success: (1) Gate 3B.5の宇宙感と奥行きが残る、(2) 神秘性が単一の時間・光・場の因果から生じる、(3) focused tests／syntax／live WebGLと複数時点の実景がPASSする。
- lane: Orchestrated。独立した美的監査、renderer経路監査、失敗境界監査を先に統合し、親Agentが実装、別検証者がlive候補を反証する。
- evidence: current source／focused tests／Codex内browser／`results/` packet。美的採用は工房主判断であり、機械PASSと分離する。
- stop: live候補を工房主が鑑賞できるところで止める。工房主採用前に12分runや製品化へ進まない。
- outcome: 「光は消えず、観測された通過だけが空間の透過率を変える」を一原理として採用。既存history fieldを灰色の星雲として加算せず、履歴の稜線がある局所だけ暗部を連続露光曲線で開く。39 focused tests、syntax、複数時点のvisible WebGL／`glError=0`を確認し、独立検証の静的契約PASSと親のlive unseen checkを統合した。
- owner outcome: 工房主はGate 3Cを「感じない」と作品不採用にした。codeと検証証拠は履歴として保持するが、この候補を製品正本にせず、実在宇宙の制作基盤調査へ移行した。

## Current boundary — 2026-09-05

- 状態: Gate 3B.5の白い宇宙、depth、速度連続cameraをexact baselineとして復元した上で、Gate 3C「通過が空間の透過率を変える」を隔離prototypeへ実装・機械検証・実画面検証済み／工房主の作品判定待ち。
- 製品像: 実note由来の局所力学、Tendrils型の共有場、自律するArt Score、材質renderer、provenanceを一つの無音作品契約として統合する。
- 実装済み: 599 logical notesを599個の光として保ち、実資料の発芽・回帰・合流だけをcue源とする一時重心まわりの公転・捕獲・離脱、90秒Art Score、dust／advected filamentの二材質、hoverによるsource note名表示を接続した。noteを衛星状の装飾片へ分解する案は工房主の実見で不採用とし撤去した。捕獲・離脱が速すぎるという再実見を受け、一現象を最低30秒へ減速した。さらに、検出済み資料現象が共有履歴へ渦状の稜線を刻み、その密度勾配と回転が後続のnote運動と残光移流へ戻る形態場feedbackを実装した。背景用のprocedural noise／mosaic fogは撤去し、雲・腕・裂け目の明暗をnote通過履歴だけから合成する。直近の「芸術的ではない」という判定を受け、同時現象を一つへ絞り、各30秒をvoid／ignition／formation／rupture／afterimageへ再構成した。非参加noteは間引かれた暗い星野へ退き、資料現象へ反応したnoteと高精細な通過履歴だけが大きな非対称形態を作る。全noteは論理的に残り、見えないことを不存在とは扱わない。
- Gate 3B差分: 工房主の「墨彩画系が強すぎて宇宙感が少ない」という判定を受け、通過履歴を主成分から背景レベルへ下げた。遠景／近景の投影倍率と視差、粒径差を広げ、現在のnote光だけを増光した。資料由来履歴は力学には残るが、画面では光の周囲の希薄なガスに限る。
- Gate 3B.1差分: rupture後の暗転をafterimageとして扱う構成をやめ、解けた光が星野へ受け渡されるseeding相へ変更した。実資料由来の現象を最大2つ重ね、実source noteを複数の小核として使う。参加noteは高速離脱、三次元的な周回、緩い漂着の三様へ分かれ、次の現象は前の余韻が消える前に始まる。偽星、関係線、全画面の一様増光は加えていない。
- Gate 3B.2差分: 3B.1で同形の白い光が画面端へ偶然集まり、中央の空白も意図ではなく欠落に見えた。速度方向へ光を伸ばす案は米粒状になったため同turn内で撤回した。採用候補は、同時に走る二つの実資料現象のトーラス上の中点を観測重心とし、両者の実際の軸を対角方向へ投影する。発光体の最大粒径とsignature倍率も縮小し、偽の線・星・煙を加えず余白を戻した。
- Gate 3B.3差分: 現象担当の交代ごとに観測中心と角度を即時更新していたことを、カメラ切替感の共通原因と特定した。トーラス中心と角度を最短経路で18秒時定数の持続フレームへ補間し、描画とhoverで共有する。現在光は丸い点のまま保ち、実速度の向きは活動noteの通過残光だけへ接続した。残光強度は資料現象内の5局面とevent energyから連続変調し、偽の線・煙・星を追加せず流れと抑揚を作る。
- Gate 3B.4差分: 残光textureは画面座標、共有flow textureはnote世界座標のまま同じUVで読まれ、さらに前frameの残光が新しい観測中心・角度へ再投影されていなかった。流れ場の密度・方向を現在の観測フレームへ投影し、蓄積済み残光を前frameから現在frameへ再投影してから移流する。現在光、hover、流れ、残光が一つの連続座標系を共有する。
- Gate 3B.5差分: 一次遅れ補間は目標変更時に位置速度を暗黙に作り直すため、軌道の接線が不連続だった。観測中心と角度を速度状態を持つ臨界減衰系へ置換し、現象担当が交代しても現在の運動から曲線的に新目標へ向かう。遠近の視差、透視倍率、粒径、輝度差を同じdepthから拡大し、描画とhoverの投影式を一致させた。粒子数や偽の星・線・煙は増やしていない。
- Gate 3C差分: 既存の`nebula`加算を撤去し、note通過履歴の`memorySignal`、密度稜線、flowの折れ、資料現象の局面だけから局所透過率を作る。初期の閾値式は濃部が平坦な灰色blobへ寄ったため同作業内で不採用とし、連続露光曲線と稜線局所化へ置換した。note数、力学、カメラ、projection、palette、依存は変更していない。
- 反省点正本: `retrospective.md`。R0〜Gate 3Cの失敗原因、再発防止原則、残課題、停止線を最新状態へ統合した。
- 次の一手: 工房主が開いているCodex内ブラウザで、形成期に光の通過が局所の闇を開き、種蒔き期に広い黒へ戻る一続きの呼吸が、説明なしに芸術的・神秘的と感じられるかを判定する。
- 停止線: 工房主の採否前に星雲再増量、4分構成、音楽入力、製品統合へ進まない。
- 非実施: 音楽連携、本番反映、Git delivery、新規依存、WebGPU。

以下はR5完了時点の履歴である。

# 観測宙域 R5 自律生成粒子場 Orchestrated Plan（完了）

状態正本は `state.json`、詳細なTask Contractと検証は `implementation-plan.md` とする。R0〜R4は利用者不採用の設計履歴として保持し、現行実装対象はR5だけとする。

## R5 current tracks

| Track | Owner | Result |
|---|---|---|
| 自律粒子力学 | DYNAMICS-R5 → CEO-01 | 一時的な移動tide、部分参加、漂流、反発、releaseで集散・再編する決定的simulationを実装・検証済み |
| 鑑賞画面 | CEO-01 | 一枚のCanvas、短い残光、淡い密度光、唯一のpauseへ置換済み |
| 非表示受入 | ACCEPTANCE-R5 → CEO-01 | denseの0〜60秒、compact、pause／resume、direct-open、singletonをbuild-boundで受入済み |
| 独立反証 | VERIFY-R5／VISUAL-R5 → CEO-01 | 未提示seed・semantic invariant・長時間boundedness・7時点画像を監査しaccept |
| TSUZUNE writeback | CEO-01 | fresh runtimeで既存一件へrevision付き更新。全読戻し、一意検索、project backlinkを確認済み |

## R5 dependency order

1. 現行sourceとR4の失敗境界を固定する — complete。
2. 粒子simulationの公開挙動を失敗testで固定し、最小実装する — complete。
3. Rendererを連続粒子場へ接続し、固定path演出を除く — complete。
4. narrow、typecheck、build、offscreen acceptance、full regressionを通す — complete。
5. 独立反証を統合し、workflowとTSUZUNEを最終境界へ同期する — complete。

## R5 stop

開発source、非表示受入、独立反証、既存実施記録のread-backまでで止める。本番更新、Git delivery、利用者画面の自動起動は別gateとする。

## Historical boundary

R0の全量hairball、R1のone-hop原子模型、R2/R3の小さなtree、R4の星野＋固定link列はいずれも利用者実見で不採用。検証済みだったことは採用を意味せず、現在のruntime・acceptance・説明から除外した。

## Final evidence

- narrow core/view: 2 files / 17 tests PASS。
- independent core/view/app safety: 3 files / 115 tests PASS。
- typecheck、build、acceptance script syntax: PASS。
- full regression: 101 files PASS / 1 SKIP、973 tests PASS / 1 SKIP。
- offscreen dense／singleton: PASS。denseは72実ノート、0 edge、0〜60秒の7時点、pause中静止、resize中静止、resume後移動、direct-open一致。
- independent visual: accept。固定四象限・固定群数・恒久中心収束なし。
- independent unseen: 4 seed×2,000 frameで2〜6群、最大群11〜45、RMS 0.306〜0.440、名称・900 links追加でも運動不変。

## Stop

このplanは開発source verifiedと既存TSUZUNE実施記録のrevision付きread-backで閉じる。利用者の実Vault鑑賞、production update、Git deliveryは次の明示gateであり、自動着手しない。
