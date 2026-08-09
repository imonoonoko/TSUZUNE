# Obsidian Graph Parity Reference

更新日: 2026-08-03
固定参照版: Obsidian Desktop 1.13.4 / Windows 11 / Default theme

## 目的と互換性の定義

`fixtures/obsidian-graph-parity-vault`をObsidianとTSUZUNEの両方で開き、公開UIから観測できるグラフの入力、配置規則、設定効果、操作結果、表示状態を比較する。

本計画でいう「同じ」は、見た目が何となく近いことではない。同一Vault、同一入力、同一設定、同一操作に対して、次が一致することを指す。

- node／directed edgeの包含結果
- Force設定が作用する対象、変化方向、simulationの再加熱と収束
- hover、click、right-click、zoom、pan、node drag、resetの結果
- Filters、Groups、Display、Forces、time-lapseの公開設定と効果
- ノート追加・削除、リンク変更、設定変更後の再配置と更新結果

乱数seed、frame時刻、GPU、浮動小数点差により変動する最終ピクセル座標そのものは一致条件にしない。ただし、座標が一致しなくてよいことを理由に、固定リング、path順レーン、黄金角seed、固定tick後の静止配置など、参照版と異なる力学へ置き換えてはならない。同じ入力と設定には同じForce規則と同じ操作結果を適用する。

## 固定参照資料

- [Obsidian Desktop 1.13.4 release](https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.13.4)
- [Obsidian Desktop 1.13.4 changelog](https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/)
- [Obsidian Graph view](https://obsidian.md/help/plugins/graph)
- [Obsidian Search](https://obsidian.md/help/plugins/search)
- [公式Helpが参照するGraph画像（固定commit）](https://github.com/obsidianmd/obsidian-help/blob/1d26fe9d22673ba476c77919800ce514dc0907e0/en/Attachments/obsidian-graph-view.png)

公式Help画像の固定情報は1989×1331px、blob SHA `2a58e38f6309c5a18d0463da2291a1f1bb094b4f`、画像SHA-256 `70D2B9F8AEF3428FEA490A9CDAF6FDC1B8071D95296B38D8E8D17C72A3E2F276`とする。画像から直接確認できるのは、不規則なForce配置、中立色の小さな円ノード、細く淡いedge、zoomによりフェードするlabel、選択ノートと直結edgeのaccent強調、非関連要素のdimである。設定panelは閉じているため、その寸法やcontrol配置の根拠には使わない。現行Help本文が公開する設定section順と項目は別に記録し、固定参照版1.13.4の最終的なピクセル根拠は同版の実機captureだけで確定する。

2020年にObsidian開発者が説明した`d3-force`、PixiJS／WebGL、位置を保存しないForce simulationは実装方針を考えるための歴史的参考に限る。Obsidian Desktop 1.13.4の内部実装保証として扱わない。1.13.4で公式文書に書かれていない挙動は、固定参照版の実機観測で決める。

## Fixed 1.13.4 artifact observations

公式releaseの`obsidian-1.13.4.asar.gz`を比較専用の一時領域へ取得し、release記載のSHA-256 `4DA84F44ED4232FEEE2BB33BF94DB3D22E8E5D206787268183CEA22402CB093A`と一致することを2026-08-02に確認した。ここから観測した公開UI定数と既定値を、推測ではなく固定版の比較証拠として扱う。配布物のソースをTSUZUNEへ複製せず、公開画面に現れる値だけを互換契約へ転記する。

| 対象 | 1.13.4 Default light observation |
|---|---|
| Graph controls | 幅240px、上／右12px、section padding 6px 12px |
| Section order | Filters、Groups、Display、Forces |
| Base node | `#5c5c5c` |
| Unresolved node | `#ababab`、opacity 0.5 |
| Focused node | accent HSL `258, 88%, 66%` |
| Base edge | `#dadada` |
| Label | `#222222` |
| Filter defaults | Attachments off、Existing files only off、Orphans on、Tags off |
| Local defaults | Outgoing links on、Incoming links on、Neighbor links off、Depth 1 |
| Display defaults | Arrows off、Text fade 0、Node size 1、Link thickness 1 |
| Display ranges | Text fade -3..3 step 0.1、Node／Link size 0.1..5 |
| Force defaults | CenterはUI 0.1の変換値、Repel 10、LinkはUI 1の変換値、Distance 250 |
| Force ranges | Center 0..1、Repel 0..20、Link 0..1、Distance 30..500 step 1 |

Local GraphのDepth 1は参照値として記録するが、TSUZUNEでは唯一の意図的例外としてsliderを公開しない。Outgoing／Incoming／Neighbor linksは例外に含まれないため実装対象とする。

## TSUZUNE implementation snapshot（2026-08-02）

この表は実装の有無を記録するものであり、Obsidian 1.13.4との実機比較を通過した`matched`判定ではない。未観測の寸法、力学、fade、操作結果を「同じ」と扱わない。

| Slice | 現在の実装 | 未受入境界 |
|---|---|---|
| Graph surface | TSUZUNE独自のGraph見出し、scope bar、zoom button列、説明文を除去し、白いcanvasへ幅240px・上／右12pxの設定panelを重ねる。固定参照版の日本語設定名を使用する | 実機captureによる全寸法・余白・色・折り畳み動作の一致判定 |
| Entry points | 編集画面に`ローカルグラフ`と`グラフビュー`の独立入口を置き、左ペインから選択ノートなしでもGlobal Graphを開ける。scope切替をcanvas内へ表示しない | 実機captureによる入口、tab、戻り先の一致判定 |
| Current selection | 現在ノートと接続edgeのaccent強調をhover終了後も維持する | focus／hover／currentの全状態遷移の実機一致 |
| Graph input | note、unresolved、tag、attachmentを別kindとして持ち、Wikiリンクのheading／block fragmentを基底ノートへ解決する。tag／attachmentは設定に応じてnodeとedgeへ加え、file-backed nodeの論理createdAtをVault内sidecarへ保存し、Animateへ作成日時順の増分graphとして接続する。通常のlive topology更新でも生存node座標を保持しForceを再加熱する | 固定参照版のnode／edge集合とtime-lapse開始・途中・終了の比較 |
| Filters | Search filesへimplicit AND、OR、括弧、否定、phrase、regex、file／path／content／tag／case、line／block／section／task、scalar・配列propertyのpresence／value／null／数値比較、入力途中の寛容な解釈を接続する。binary attachmentは通常termの対象外とし、`file:`／`path:`では検索できる。Tags、Attachments、Existing files only、Orphans、LocalのOutgoing／Incoming／Neighbor linksをsettingsへ保存し、Files and links共通のExcluded filesをアプリ設定として保存する | Excluded filesのManage UIと全機能共通効果、malformed queryを含む固定fixtureでの実機一致 |
| Display／interaction | Arrows、Text fade、Node size、Link thickness、Force sliders、継続simulation、node drag、wheel／keyboard zoom、background pan、node context menu、tag検索、attachment／file-backed nodeの種別別openを実装する。unique undirected neighbor数とLocal root特別値30をnode径へ使い、zoom連動のnode／label／line／arrow式と相互edgeの単一線・両方向arrowを適用する | 色、fade、dim、arrow alpha、余白、slider、drag解放後、menu項目・順序の固定参照版比較 |
| Advanced Graph | 順序付きGroups、query、色、先勝ち優先、保存、Reset、色スウォッチのdrag reorder、Animate／time-lapseを実装する。Local／Global別にscale、設定panel開閉、section折り畳みを保存する。Animate中の増分Forceと通常のlive topologyを狭いtest・隔離Electron captureで検証する | Windows実操作でのGroup drag、pan／queryを含む正確な保存境界、固定参照版とのGP6比較 |

Restore defaultsは現在、Search files入力、Tags、Attachments、Existing files only、Orphans、Local固有Filter、Groups、Display、Forcesを参照版の既定値へ戻す。Animateは永続設定を持たない実行操作として実装する。Excluded filesはGraph panel内の設定ではなく、Obsidianと同じくFiles and linksの全機能共通設定として扱う。

TSUZUNE側の隔離Electron証拠は`docs/reports/graph-explorer-gp1-2026-08-02.html`へまとめ、機械判定値は`docs/reports/assets/graph-gp1/capture-result.json`へ保存する。これはGP5-2実装の証拠であり、固定参照版との`matched`証拠ではない。

## 唯一の意図的な互換例外

Local Graphの可変Depthは、過去の明示指示により撤廃したままにする。

- TSUZUNEのLocal Graphは、現在ノートと直接つながるリンク先・バックリンクだけを表示する。
- ObsidianにあるDepth sliderは実装しない。
- 2段先以降を探索しない。
- この差異だけを`intentional exception`として記録する。

中心ノート固定、固定座標、固定tick、独自のnode省略、独自検索構文などは、この例外に含めない。

## Fixture coverage

| 対象 | Fixture |
|---|---|
| outgoing／incoming／cycle | `00_Home.md`、`Project Alpha.md`、`Reference.md` |
| Local direct links | Home → Project Alpha。2段先のProject BetaはTSUZUNEでは意図的に表示しない |
| orphan | `90_orphan/Orphan.md` |
| unresolved link | `[[Missing Note]]` |
| tag node | `#hub`、`#project/active`、`#reference` |
| attachment node | `![[attachments/diagram.svg]]` |
| excluded path | `80_excluded/Hidden.md` |
| group query | `path:"10_projects"`、`tag:#reference` |
| group overlap | 複数group queryへ同時一致するノート |
| inbound size | 被参照数が0、1、複数のノート |
| live topology update | ノート追加、削除、Wikiリンク追加・削除 |
| creation order | 作成日時が異なるノート群 |

## Parity matrix

| 領域 | Obsidian 1.13.4で比較する公開挙動 | TSUZUNE受入結果 |
|---|---|---|
| Initial Global state | 未保存の初回Global Graphで設定パネルが開く | `matched`。Obsidian `close: false`、TSUZUNE Vault既定`settingsOpen: true`。Local既定と明示保存済み状態は対象外 |
| Global input | Vault内ノート、孤立ノート、解決済み／未解決リンク、tag、attachmentの設定別包含 | 同一設定でnode／edge集合が一致 |
| Local input | 現在ノートと接続ノート、Local固有設定 | Depth以外は一致。Depthは直接リンク固定の意図的例外 |
| Base display | ノートは円、内部リンクは線、被参照数に応じたnode径 | 種類、包含、相対的な径の変化が一致 |
| Filters | Search files、Tags、Attachments、Existing files only、Orphans、Excluded files | 対応するtoggle／queryで同じ集合になる |
| Groups | 複数query、色、重複一致時の優先 | 実機観測した優先規則を含め一致 |
| Display | Arrows、Text fade threshold、Node size、Link thickness、Animate | 設定対象、変化方向、端値の結果が一致 |
| Forces | Center、Repel、Link force、Link distance | 同じ設定変更で同じForce規則、再加熱、収束方向になる |
| Pointer | hover、click、right-click、背景drag、node drag、wheel zoom | 強調、open、menu、pan、drag、zoom結果が一致 |
| Keyboard | `+`／`-` zoom、矢印pan、Shift+矢印pan、focus操作 | 公開操作結果が一致 |
| Camera | zoom限界、pan、fit／reset、world座標との分離 | 実機観測値と結果が一致し、cameraでworld座標を再正規化しない |
| Runtime update | ノート／リンク／filter／force変更後の更新 | 同じ変更で同じ再配置・表示更新が起きる |
| Persistence | Graph設定、node drag／pin、cameraの保存単位と再起動後状態 | 実機観測した保存境界と一致 |
| Reset | Restore defaults | 参照版と同じ項目・既定値・更新結果へ戻る |
| Time-lapse | creation time順、開始・途中・終了 | 順序、表示対象、操作結果が一致 |

## Capture matrix

ウィンドウサイズ1265×768、表示倍率100%、Windows 11、Default themeへ固定する。各行でObsidian 1.13.4、TSUZUNEの順に撮影し、ファイル名へ`obsidian-1.13.4`または`tsuzune`を付ける。

1. Global baseline: Homeを選択し、参照版の既定設定を記録する。Vault内の全`.md`、孤立ノート、リンク対象を比較する。
2. Local direct: Homeを起点に直接リンク先・バックリンクを比較する。TSUZUNEだけはDepth sliderなし、直接リンク固定であることを明記する。
3. Filters: Search files、Tags、Attachments、Existing files only、Orphans、Excluded filesを一項目ずつ切り替える。
4. Groups: `path:"10_projects"`と`tag:#reference`へ異なる色を指定し、重複一致時の表示も記録する。
5. Display: Arrows、Text fade threshold、Node size、Link thickness、Animateを既定値とslider両端で撮影する。
6. Forces: Center、Repel、Link force、Link distanceを一項目ずつ既定、最小、中央、最大へ動かす。UI表示値または保存値を記録し、TSUZUNE独自の0／50／100へ読み替えない。
7. Pointer interaction: hover、click、right-click、背景drag、node drag、wheel zoomを操作前・操作中・操作後で記録する。
8. Keyboard interaction: `+`／`-`、矢印、Shift+矢印、focus移動を記録する。
9. Live update: ノート追加・削除、Wikiリンク追加・削除、filter変更の直後と収束後を記録する。
10. Persistence: node drag／pin、camera、各設定について、Graphを閉じて再表示、アプリ再起動、Vault再読込後を記録する。
11. Restore defaults: 変更した全設定のうち何がどの値へ戻るかを記録する。
12. Time-lapse: creation time順の開始、中間、終了を撮影する。

## Recording contract

- node一覧、directed edge一覧、設定値を機械比較可能なJSONでも保存する。
- Forceは単一静止画だけでなく、変更直後、移動中、収束後を動画または連続captureで残す。
- 各設定は、対象、変化方向、端値、相互作用、reset値を記録する。
- TSUZUNE未実装項目は`missing`、挙動差は`different`、一致は`matched`、Local Depthだけは`intentional exception`とする。
- capture前後でFixture内のMarkdown件数と複合SHA-256が一致することを確認する。
- 非公開なslider範囲、group重複時の色優先、node drag／pin、zoom限界、設定保存単位は、実機観測値へ日付、OS、版を添える。
- 未観測項目を推測で`matched`にしない。

## Layout and runtime contract

- Graph worldはForce simulationが保持し、cameraのzoom／pan／fitとは分離する。
- Force値、node／edge集合、node drag、filter変更で参照版と同じ条件によりsimulationを再加熱する。
- simulationは画面更新に追従して継続し、参照版と同じ観測可能な停止・収束挙動を持つ。
- Global node dragは、押下中だけ一時固定し、pointerup後は固定を解除してForce simulationへ戻す。Graph再表示／アプリ完全再起動へnode座標・pinを保存しない。再シード後の座標値そのものは互換条件にしない。
- Local中心ノートを固定するかどうかも1.13.4実機観測で決め、過去のTSUZUNE実装を互換根拠にしない。
- path sort、黄金角seed、固定180 tick、対称percent正規化、固定リング、固定レーンを互換レイアウト仕様にしない。
- 「全体表示」などTSUZUNE拡張は、Force worldを再配置せずcameraだけを調整し、Obsidian互換操作を妨げない場合に限り残せる。

## Renderer contract

- 辺はグラフごとに一枚のCanvasへまとめて描画し、リンク数に比例するDOMまたはSVG要素を作らない。
- ノートはCanvas上へ操作可能なDOM要素として重ね、pointer、keyboard、screen reader向けの名前、focus、現在ノート状態を維持する。
- Canvasの辺とDOMノートは、hover、focus、選択、zoom、pan、node drag、simulation frameの同じworld／camera状態を共有する。
- renderer内部構造はObsidianと同一である必要はないが、公開UIの結果と性能を変えてはならない。

## Current graph scope contract

- Vault全体グラフは、孤立ノートを含む全`.md`と、設定に応じた解決済み／未解決Wikiリンク、tag、attachmentを入力にする。
- 固定のnode数・edge数上限による切り捨ては行わない。
- Orphans、Search files、Excluded filesなど、利用者が明示した設定だけで表示集合を変える。
- Local Graphは直接リンク固定の意図的例外を除き、Globalと同じ公開設定の意味を保つ。
- 現行TSUZUNEは未解決Wikiリンク、tag、attachment、Tags、Attachments、Existing files only、Orphans、Outgoing／Incoming／Neighbor linksに加え、Files and links共通のExcluded files設定まで実装済みとする。Graph、Searchなど全対象での効果とManage UIの固定参照版一致はGP6で判定する。
- 現行Global Graphは左ペインから選択ノートなしでも開ける。
- 現行Search files入力はimplicit AND、OR、括弧、否定、phrase、regex、file／path／content／tag／case、line／block／section／task、scalar・配列propertyのpresence／value／null／数値比較、入力途中のquote／括弧／operator／regex／propertyを寛容に扱う解釈まで実装済みである。binary attachmentは通常termでは一致せず、`file:`／`path:`では一致する。malformed queryを含む同一fixtureで固定参照版と比較していないため、Search全体を`matched`とはしない。
- GP0-3b-cではGlobal Graph、空query、8 node、1265×768、DPR 1、light theme、隔離profileを固定し、制御された論理wheel `deltaY=-120`と背景drag `+96,+64 CSS px`を入力した。Obsidian側はCDPマウス入力、TSUZUNE側は隔離オフスクリーンのDOM合成入力であり、物理マウス／trusted event parityは未証明である。Obsidian 1.13.4とTSUZUNEはいずれもzoom `1.5`をGraph再表示後・アプリ完全再起動後まで保持し、panは両時点で中央へ戻った。これは6比較項目を`matched`にする狭い証拠であり、pan永続化を互換仕様にしてはならない。正本は`docs/reports/assets/graph-gp0-camera-persistence/comparison.json`とする。
- GP0-3b-dでは同じ画面条件で`00_Home.md`を`+96,+64 CSS px`ドラッグし、押下中、pointerup直後、250ms後、settled、Graph再表示後、アプリ完全再起動後を比較した。両製品とも押下中だけ一時固定し、pointerup後は固定を解除してForce simulationへ戻り、Graph再表示／再起動へnode座標・pinを保存しなかったため、意味契約5/5を`matched`とする。Obsidianの再シード座標とTSUZUNEの決定的baselineは永続化契約の差ではない。物理マウス／trusted event、ピクセル単位のForce軌跡、Local Graph、touch／penは未証明である。正本は`docs/reports/assets/graph-gp0-node-drag-persistence/comparison.json`とする。
- GP0-3b-eではGlobal Graph node context menuを同条件比較し、Obsidian 1.13.4の11操作に対してTSUZUNEは2操作、6比較中3一致・3差分の`different`を固定した。GP0-3b-fでは先頭の`新規タブに開く`を実動作へ接続し、note tabの作成・active化を一致させ、TSUZUNEのattachment内部previewも固定した。GP0-3b-gでは残っていた元Global Graph保持の差を閉じ、Graph workspace tabの保持とTSUZUNEでの復帰を確認した。GP0-3b-hでは公開フィルタからattachment nodeを表示し、新規内部preview tabと元Graph tab保持・復帰を`matched`にした。GP0-3b-iでは両製品で2つ目のトップレベルウィンドウを生成し、SVGを内部画像ビューで表示し、元Global Graphを保持してmenuを閉じる公開動作を`matched`にした。独立ウィンドウのworkspace装飾と添付context menu全体は未一致である。最新正本は`docs/reports/assets/graph-gp0-attachment-new-window/comparison.json`とする。

## Current gap and reopened boundary

固定tick／静的正規化は継続Force runtime、node drag、再加熱、camera分離へ置換済みである。全Markdown・上限なし・Local直接リンク契約も継続する。ただし、これらは実装基盤の完了であり、Obsidian 1.13.4実機との一致証拠ではない。Force slider、drag、live update、収束、保存境界は固定fixtureのcaptureで引き続き判定する。

Surface／Filter／Unresolved／tag／attachment／Local・Global独立入口／Groups／論理createdAt／Excluded files／Search境界／context menu／種別別open／scope別view state／zoom描画式／Animateのsliceは実装済みである。Graph parity全体は未完了であり、次を未受入・未検証境界として残す。

1. Animate中の増分graph feed、Force再加熱、通常のノート／リンク変更を含むlive topology更新は実装済みである。狭いtestと隔離Electron captureでは、開始0件、途中1件、終了7件のMarkdown表示と、終了時に8辺へ戻ることを確認した。固定参照版との順序・速度・操作結果比較は未完了である。
2. 隔離したuserDataと比較fixtureでForce既定値・最大値・fit・time-lapse開始／途中／終了の観測証拠を固定した。Global node dragの一時固定、pointerup解放、再表示／再起動後の非永続化は固定参照版と一致した。通常のlive更新と収束方向、Local Graphは同条件captureが未完了である。
3. GP0-3b-eのcontext menu項目比較、GP0-3b-fの`新規タブに開く`実動作比較、GP0-3b-gのGlobal Graph workspace tab保持、GP0-3b-hのattachment新規tab比較、GP0-3b-iのattachment新規window比較は完了した。次のGP0-3b-jではattachment nodeの`ファイルを移動…`を固定参照版から採取する。その後、残るmenu操作、Excluded filesのManage UIと全機能共通効果、Searchのmalformed query境界を一項目ずつ比較する。
4. unique neighbor数、Local root特別値、zoom連動のnode／label／line／arrow式、相互edge、色、dim、fade、arrow alpha、余白、sliderを同一viewport／DPI／themeの画像で比較する。
5. Global Graphの未保存初回状態で設定パネルが開く点、非空queryのGraph再表示／再起動保持、Global cameraのzoom保持／pan中央復帰、Global node dragの一時固定／release／非永続化は固定fixtureで`matched`にした。Localのcamera、他query、panel／section、context menu、fit／reset、zoom限界、workspace leaf自動復元は固定参照版で引き続き判定する。
6. Windows版ElectronでGroup色スウォッチdragを実操作確認する。
7. 同一fixtureの画像、操作動画、node／edge／settings JSON、性能値、Markdown SHAをGP6 HTML比較レポートへまとめる。大規模Vaultの性能改善とviewport cullingは、計測で必要性が確認された場合だけ追加する。

過去のpath順、中心固定、表示上限、独自凡例、独自検索をObsidian互換として正当化しない。上記の未受入・未検証境界を閉じるまでGraph parityを`matched`または完了と表現しない。Local GraphのDepth撤廃だけを唯一の`intentional exception`として維持する。

## Completion gate

1. Parity matrixの全項目が`matched`または唯一の`intentional exception`で埋まる。
2. 同一Fixture・同一設定のnode／directed edge集合が一致する。
3. Force変更、node drag、live updateで同じ規則、再加熱、収束方向を示す。
4. Pointer／keyboard操作とRestore defaultsの結果が一致する。
5. 比較前後でMarkdownと添付原本が不変である。
6. 同一条件の画像、操作動画、JSON、性能値、未受入境界をHTMLレポートへまとめる。
