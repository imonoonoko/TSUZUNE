# COSMOS-01 — 観測宙域の動的グラフ設計

> **Phase 1 historical proposal:** global layout、camera、`GraphEdgeCanvas`再利用は実機FAILで棄却された。現行R2は `results/09-spanning-constellation.md` と `6_implementation_brief.md` を正本とする。

## 結論

観測宙域は、通常Graphの別モード化や意味的な再クラスタリングではなく、**同じVault由来の明示Wiki linkグラフを入力に、停止可能な独立scene/camera stateを重ねる薄い表示コンポーネント**として作る。

星（note）と線（既存の明示Wiki link）は残し、sceneだけを一時的な「観測断面」として浮上・消滅させる。これは存在相そのもの、固定クラスタ、知識の因果、または不存在の判定ではない。自動巡回はworld座標を変えず、cameraのpan/zoomと注目集合のopacityだけを変える。通常Global/Local Graphの状態、force settings、node drag、保存データは読取もしない必要はなく、少なくとも書き換えない。

以下の設計は現物調査に基づく推奨であり、未実装のcomponent名・数値・scene選択則は提案である。

## 現行根拠と守る境界

| 現行の事実 | 設計への帰結 |
| --- | --- |
| `buildWikiGraph` はMarkdown noteからWiki linkを解決し、node/edgeをpath順に返す。タグ・添付・未解決nodeはoptionにより混在し得る（`src/core/graph.ts:94-209`）。 | 観測宙域のMVP projectionは `kind === 'note'` の既存noteだけとし、両端がnoteであるedgeだけを通す。これで描画edgeは解決済みの明示Wiki linkに限られる。未解決・除外・孤立を「存在しない」と表示しない。 |
| Global/Localの切替とGraphデータ組立ては `App.tsx` が持ち、Globalは `WorkspaceTab.kind === 'global-graph'` と `viewMode === 'graph'` により開く（`src/renderer/App.tsx:1213-1242`, `2000-2129`; `src/renderer/components/WorkspaceTabBar.tsx:6-39`）。 | 観測宙域は `global-graph` を流用せず、独立したworkspace tab kind（例: `observatory`）または同等に独立したrouteにする。通常Graph tabを観測状態へ変換しない。 |
| force layoutは `createWikiGraphSimulation` に閉じ、`randomSource` を注入できる。既存nodeの位置は `setGraph` で維持される（`src/core/graph-layout.ts:39-56`, `105-188`）。同seedの軌道は既存testで確認済み（`tests/graph-layout.test.ts:191-198`）。 | 観測宙域は専用simulationを一つだけ生成し、初期layoutの限定tick後に停止する。通常Graphのsimulation object、drag、tickを共有しない。 |
| 通常Graphはsimulationを開始してDOM node位置を購読更新する（`src/renderer/components/WikiGraphView.tsx:531-607`）。 | 観測宙域には、常時物理運動を「宇宙の動き」として足さない。鑑賞中の連続更新はcamera interpolationだけにする。 |
| edgeは固定viewportのCanvasで描かれ、node半径を使って両端を円周までclipする。Canvasはnode stageより先にrenderされ、`pointerEvents: none` である（`src/renderer/components/GraphEdgeCanvas.tsx:216-405`; `WikiGraphView.tsx:1519-1537`）。 | `GraphEdgeCanvas` は再利用候補である。観測宙域でもedge layerをnode stageの背面に置き、同じworld positions/radii/zoom/panを渡す。別SVG edgeや中心まで届くedgeを作らない。 |
| 既存viewportはworld座標を `translate(pan) scale(zoom)` し、wheel/drag/keyboardでcameraのみを動かす（`src/renderer/components/WikiGraphView.tsx:683-908`, `1519-1543`）。 | scene遷移はこの座標系の `pan` と `zoom` を補間する。sceneごとにnode座標を再配置しないので、pause時・手操作時・更新時に視界を保てる。 |
| `prefers-reduced-motion` は共通CSSでanimation/transitionを縮めるが、Graph固有のcamera schedulerはない（`src/renderer/styles.css:3205-3214`）。 | 観測宙域自身がmedia queryを購読し、reduced motion時はcamera rAFを開始せず、scene切替をopacity/focusだけにする。全体CSSへの依存だけでは要件を満たさない。 |

`buildWikiGraphForView` は `viewMode === 'graph'` 以外では空graphを返す（`src/core/graph.ts:217-225`）。したがって「薄い別component」を選ぶ場合も、App側では観測宙域が開いている時にだけ同じ既存note集合からgraphを組み立てる小さな入口が必要である。これは通常Graphの挙動変更ではない。

## 推奨component境界

| 境界 | 責務 | 入出力・禁止事項 |
| --- | --- | --- |
| `observatory-projection`（純粋core、提案） | `WikiGraph` からMVPのnote-only projectionを作る。caption用の観測条件も返す。 | 入力は既存Global相当のgraph。`note` nodeとnote-to-note edgeのみを返す。類似度、履歴、タグ、欠損link、source推定をedgeへ加えない。 |
| `observatory-seed`（純粋core、提案） | graph revisionとscene-algorithm versionからstable seedを作る。 | node pathとdirected edgeのcanonical列をhashし、seedを32-bit値へ落とす。`Date.now()`、tab id、Math.random、DOM順を入力にしない。 |
| `observatory-scenes`（純粋core、提案） | candidate sceneの生成、stable order、次scene決定。 | component / 1-hop近傍 / singletonを有限な候補として返す。sceneは `id`, `focusPaths`, `label`, `cameraTarget`, `caption` のデータであり、Vaultへ保存しない。 |
| `ObservatoryView`（renderer、提案） | 初期layout、scene scheduler、camera、controls visibility、accessibility、node open。 | 受け取るのはprojection、既存表示設定の読取値、`onOpen(path)`。固有stateは `playing`, `sceneIndex`, `camera`, `controlsVisible`, `reducedMotion` のみ。Graph設定のcommit callbackは持たない。 |
| 既存 `GraphEdgeCanvas` | Canvas edge geometry・theme・Canvas resize/drawを担当。 | `graph`, positions, radii, pan, zoom を渡すだけ。MVPで改変不要。 |
| App/tab host | 観測宙域を開閉し、同じVault snapshotと `onOpen` を渡す。 | `WorkspaceTab` に独立kindを追加する場合は、tab label、activate/close、note openの遷移を明示する。通常 `global-graph` のstateを観測状態に再利用しない。 |

最小実装では既存の `WikiGraphView` を抽出・汎用化しない。これは設定UI、context menu、timeline、drag、persist callbackが一体化しているためである（`src/renderer/components/WikiGraphView.tsx:53-86`, `234-607`）。共有が不足として実測された場合だけ、`GraphViewport` のような小さな描画/座標helperを後で抽出する。

## Data flow

```text
VaultSnapshot.notes
  -> App の既存 graphNotes / path alias 解決
  -> buildWikiGraph(... explicit Wiki link ...)
  -> observatoryProjection(note-only, edge両端note)
  -> canonical graph fingerprint + scene algorithm version
  -> seed / seeded randomSource
  -> 専用 d3 simulation (bounded initial settle -> stop)
  -> positions + scene candidate list
  -> ObservatoryView
       |- GraphEdgeCanvas (背面; clipped endpoints)
       |- node buttons (前面; focus/selection/label)
       |- scene caption / constellation label
       `- minimal controls (play/pause, 全体, node open)
```

AppがVault updateを受けた場合は、現在のsceneを直ちに中央へ飛ばさない。projectionのfingerprintが変わるまでは現在のpositions/camera/sceneを保持する。変わった場合も、(1) 生存nodeのpositionを引き継ぐ `setGraph` の既存性質、(2) 現在sceneの生存focus pathの再解決、(3) 失われた時だけ次scene境界でfallback、の順に処理する。これは「graph更新中に新しい星を急激に中央へ飛ばさない」という要件への設計上の対応であり、`setGraph` の位置保持は既存testにもある（`tests/graph-layout.test.ts:138-165`）。

## 決定論とscene scheduler

### Seed contract

1. canonical inputを、path順のnote node列と `sourcePath + NUL + targetPath` 順のedge列から作る。`buildWikiGraph` 自体もpath順で返すが、scene selector側で再sortして入力契約を明文化する。
2. seedは `hash('observatory-scene-v1' + canonicalInput)` とする。hash方式とalgorithm versionはpure functionの定数で公開する。
3. 同一canonical input・同一algorithm version・同一viewport bucketなら、候補順と最初のsceneは同じにする。viewportが変わるとcamera targetだけ再計算してよく、node/scene membershipは変えない。
4. d3-forceには同seedから作る `randomSource` を渡す。`createWikiGraphSimulation` がこの注入点を既に提供し、testにもseeded randomの例がある（`src/core/graph-layout.ts:129-134`; `tests/graph-layout.test.ts:29-51`）。
5. Vault内容が変わってfingerprintが変わる時だけ新しいsequenceになる。これは「毎回の偶然」を偽装しない可逆な条件であり、MVPではユーザー履歴、時刻、AI推定をseedに混ぜない。

### Scene candidateと遷移

- 候補はまず、明示edgeの連結領域（大小を区別するが「唯一の正解cluster」ではない）から作る。大き過ぎる領域はseeded rootの1-hop近傍へ縮める。孤立noteは1星sceneとして残す。link 0件でも空表示にしない。
- scene集合はnode/edgeを複製・保存しない一時view modelである。星は常に全体fieldにあり、sceneはcaptionとfocus/label opacityを変えるだけにする。
- schedulerは `playing` かつ `!reducedMotion` の時だけ一つの `requestAnimationFrame` を持つ。`dwell -> ease camera -> dwell` のphaseを単調時計から算出し、intervalを重ねない。pause、unmount、visibility hiddenでrAFをcancelする。
- scene切替時は `sceneIndex = (sceneIndex + 1) mod scenes.length` とし、同一focus set連続・直前rootへの即時復帰を純粋selectorで避ける。候補が一つならcameraは動かない。
- dwell/easeの製品値は実機鑑賞で決める。実装時は注入可能な `SceneTiming` を使い、固定fixtureで「2分に少なくとも3つの異なるscene、急なjumpなし」を測る。仕様策定前にテンポを永続設定へ昇格させない。
- pointer drag、wheel、keyboard pan/zoomはviewを止めずに可能にするが、最初の手操作で自動巡回をpauseする。自動cameraが手入力と競合しないことを優先する。再開は明示playのみとする。
- reduced motionではscene indexをdwell境界で変えてもcamera値を固定し、focus/label opacityだけを切り替える。play/pause操作は残す。

creation-time timelineはscene schedulerとして流用しない。既存timelineはfile-backed nodeを時刻順に徐々に**追加表示**する機能（`src/core/graph-timeline.ts:20-97`; `WikiGraphView.tsx:505-565`）であり、観測宙域の「星は維持し、星座が現れてほどける」要件とは異なる。creation timeは将来の観測sequence比較では入力候補になり得るが、因果・存在の強さ・物理法則を表す値ではない。

## Edge / node occlusion と表示の真実性

1. edge Canvasをnode DOMより先に置く。現行実装どおり `pointerEvents: none` にして、星のbuttonがpointer/focusを受ける。
2. endpointは中心-to-中心ではなく `edgeEndpointsAtNodeBoundaries` に、**表示中のnode半径**を渡してclipする。関数は重なった円でも距離に応じてinsetを縮める（`src/renderer/components/GraphEdgeCanvas.tsx:159-188`）。これは「edgeはnode円周で止まる」MVP条件を直接満たす。
3. radiusは既存 `calculateGraphNodeRadius` とzoom geometryを再利用する（`src/shared/graph-display.ts:45-88`）。camera zoomとnode radiusがずれるとedgeが星の内部へ潜るため、Canvasとnode stageへ同じ値を渡す。
4. 非注目sceneのedgeは消して「関係なし」と示さず、低いopacityにするか全体表示時の既存色を保つ。注目edgeのみ強調できるが、色だけではscene/focusを表さずcaption、focus ring、labelで補う。
5. labelは全nodeに常時出さない。scene focus、keyboard focus、hover、選択nodeだけを優先し、残りは既存のzoom由来opacityを上限として抑える（`calculateGraphLabelOpacity`, `src/shared/graph-display.ts:55-59`）。これにより密集Vaultで文字が星を覆うことを避ける。
6. captionには少なくとも「観測断面」「明示Wiki link」「表示外/未接続は不存在を意味しない」を短く出す。星の明るさ・大きさ・色・ringに意味を追加する時は、help/captionで各々を分けて説明する。MVPはdegree由来の既存size以外の意味を足さない。

## 性能budget と測定

### 実装時の不変budget

- graph構築とscene候補化は開場時/graph fingerprint変更時に一回だけ。scene遷移ごとに `buildWikiGraph`、layout、全edge集合、DOM nodeを作り直さない。
- simulationは初期のbounded settle後に `stop()` する。鑑賞中に常時force tickを走らせない。camera rAFは最大一つ、pause/reduced motion/unmount/hiddenでゼロに戻す。
- full fieldの星と明示edgeは入力から削らない。性能対策が必要なら先に非注目**label**とscene UIを抑え、根拠なしにnoteやlinkを間引かない。
- MVPでnew cache、worker、DB、package、WebGL rendererは入れない。既存Canvas rendererが描画上の前提である。

### 既知の基準とrelease gate

2026-08-02の保存済みlarge-Vault測定は、2,000 noteの通常Global GraphでrAF cadence p95中央値164.4 ms、`d3-force` 180 tick p95 3,725.7 msを記録している（`docs/reports/tsuzune-large-vault-performance-2026-08-03.artifact.json` のTechnical summary / Exact measurements）。この測定は現在のdirty working treeの保証ではなく、GPU paint時間でもない。しかし「2,000件で常時simulationを回さない」根拠として十分に強い。

観測宙域のMVP gateは、既存 `npm run measure:vault:large` の隔離fixture（既定500/2000、fresh profile trial）を再利用し、同一revision・1440x900/100%・2分traceで比較する。`scripts/run-large-vault-performance.mjs:113-224` が既にfixture、Graph first usable、rAF cadenceを収集するため、観測宙域用に次だけ追加測定すればよい。

| 指標 | 判定 | 理由 |
| --- | --- | --- |
| scene切替回数 | 120秒で3以上、同じfocus setの連続なし | automatic viewing acceptanceを機械的に確認する。 |
| camera discontinuity | scene境界でpan/zoomの一frame差が補間契約を超えない | camera jumpを画面印象だけにしない。閾値は実装したtiming/curveから導出してfixtureで固定する。 |
| active rAF | playing時1本以下、pause/reduced/hidden/unmount時0本 | timer漏れと二重schedulerを検出する。 |
| Global Graph回帰 | 同じfixtureのGlobal Graph first usable/rAFが観測宙域追加前baselineから悪化しない | 別viewのコードが通常Graphを重くしないことを確認する。 |
| Observatory rAF | 500/2000の同条件で通常Global Graphの同revision測定を併記し、悪化率を記録する | 現時点に普遍的fps閾値はない。既知の2000件基準は余裕が小さいため、数値は再計測後に採否する。 |

これは「2,000件まで快適」と先に主張するbudgetではない。MVPは静的layout + cameraだけで先に測り、未達ならまずlabel/focus表示の実測原因を切り分ける。全nodeを隠す、継続AI、常駐cacheに進むことは別の判断である。

## 段階的導入

| 区分 | 採用内容 | 境界 |
| --- | --- | --- |
| **MVP** | note-only explicit-link projection、seeded初期layout、連結領域/近傍/singleton scene、camera pan/zoom、play/pause、全体、node open、caption、reduced motion、既存Canvas edge clipping。 | UI renderer内だけ。Markdown・settings・通常Graph・MCP・main processは変更しない。 |
| **Future** | source trace付きのObservation engine、時点を明示した観測sequence比較、複数scaleの暫定集団、利用者が確認するProposal engine。 | source field / observation / proposalを分離し、各集団の根拠と不確実性を表示してから。 |
| **Reject (このwork item)** | LLM similarity edge、vector/embedding、hidden semantic cluster、常駐daemon、DB/cache、scene/meaningの自動保存、既存Graph設定への観測宙域state混入、world座標のsceneごと再計算。 | 理論境界、可逆性、MVP scope、通常Graph互換性に反する。 |
| **Experiment（実装前にfixtureで比較）** | 初期sceneを連結領域、seeded 1-hop近傍、またはsingleton含む混合候補のどれにするか。captionの「星座名」を人名風にするか構造記述にするか。 | 固定fixtureで候補順、2分巡回、誤認（AIが意味を発見したように見えないか）を比較する。結果を固定しない限りproduct ruleに昇格させない。 |

## 故障モードと検証案

| 故障モード | 防止/検出 | 検証 |
| --- | --- | --- |
| 同一graphでscene順やlayoutが変わる | canonical sort + algorithm version + injected seeded random。時刻/Math.randomを禁止。 | pure selector testとlayout testで、同graph/seedが同一scene列・positionsを返す。node順を入替えたinputも同値にする。 |
| 通常Graphのcamera/drag/settingsが変わる | 独立tab/state、ObservatoryViewへcommit callbackを渡さない。 | Global/Local Graph既存testを実行し、観測宙域open/close後の`GraphViewStates`、force/display/filter/groupsが不変であるintegration testを追加。 |
| pause後もcameraやtimerが動く | schedulerをrAF一つに限定し、cleanupを一箇所にする。 | fake rAF/visibility test: pause、unmount、reduced motionでcallback数0、camera snapshot不変。 |
| 手操作と自動cameraが綱引きする | pointer/wheel/keyの最初の操作でpauseし、再開は明示buttonだけ。 | interaction test: drag/wheel後のpan/zoomが次frameで戻らず、play後だけscene遷移する。 |
| edgeが星を貫く/前面に出る | 既存Canvasのclip関数と描画順を再利用。 | `tests/graph-edge-canvas.test.tsx:12-43` の円周clipを保持し、観測宙域の異なるradii/zoomでCanvas commandを検査。 |
| node/labelが密集し鑑賞不能 | focus外labelのopacity制御、全fieldは維持。 | 500/2000 fixtureのscreenshotとDOM countを採取。node/edge減少ではなくlabel表示規則を確認する。 |
| Vault更新でcameraがjumpする | surviving positionsとcurrent focusを引継ぎ、次scene境界までfallbackしない。 | add/remove fixtureで、既存node座標とcameraが更新直後に保持されることをassertする。 |
| reduced motionでも連続移動する | component-level media query分岐。 | simulated `matchMedia('(prefers-reduced-motion: reduce)')` でrAF未開始、opacity切替のみを確認する。 |
| 星空が意味・因果・不存在を断定する | note-only explicit links、caption、根拠のないcluster保存なし。 | visual acceptanceでcaptionとedge sourceを確認し、link 0 / 0 note / 1 note / unresolved・excluded混在fixtureをそれぞれ確認する。 |
| 大規模VaultでschedulerがCPUを増幅する | simulation停止、sceneごとの再構築禁止、large fixture remeasure。 | 2分traceでrAF、scene数、memory/DOM node数、Global Graph回帰を記録する。未達時は原因を計測し、Future技術を自動投入しない。 |
| 描画失敗から戻れない | hostに通常Global Graphまたはnote一覧への明示入口を残す。 | Canvas context不取得/例外を注入し、error stateから戻るbuttonとVaultデータ不変を確認する。 |

## 実装開始時の最小受入セット

1. pure `observatory-projection` と `observatory-scenes` のfixture testを先に作り、MVP edgeがresolved note-to-note Wiki linkだけであること、空・単一・孤立・複数component・同seedを固定する。
2. `ObservatoryView` は既存 `GraphEdgeCanvas` を入力互換のまま使い、専用simulationを停止してからcameraだけを動かす。
3. Global/Local Graph regression、edge geometry、reduced motion、2分visual captureを通す。通常Graphの既存layoutとendpoint clippingはすでにtest入口がある（`tests/graph-layout.test.ts`, `tests/graph-edge-canvas.test.tsx`, `tests/wiki-graph-view.test.tsx`）。
4. 500/2000 fixtureを同revisionで再測定し、結果に基づいてtempoとlarge-Vaultの表示境界を採否する。ここまでで「見て楽しい自動鑑賞」が実機確認できれば停止し、semantic similarityやproposal保存へ進まない。

## 調査範囲と未確認事項

- この文書はworking treeをread-onlyで確認した設計であり、コード、package、Vault、通常Graph設定を変更していない。
- 外部documentationは不要だった。使用中の `d3-force` のseed注入点と現在のCanvas/renderer実装は、上記のrepository source/testで直接確認した。
- 2026-08-02 large-Vault測定は履歴的な性能根拠であり、現在のdirty working treeの本番値ではない。MVP実装後に同じisolated fixtureで再測定する必要がある。
