# 観測宙域 MVP Discussion Log

## 2026-09-03 — 目的

利用者は、操作を最低限にし、宇宙空間のように知識を見て楽しむことを優先した。将来は集団が変化し、予想外のidea候補が生まれるLiving Cosmosを望むが、MVPは既存の実dataだけで安全に成立させる。

## R0 — 全量Graph camera: rejected

589ノート／4175リンクを全量描画したため矩形hairballとなり、camera切り出しは画面端へ飛んだ。利用者判定は「全くの駄目」。全量graph、camera、Canvas親transformを設計から除外した。

## R1 — one-hop: rejected

線数は減ったが原子模型になり、中心noteを本質的中心に見せた。局所関係を読めても鑑賞宇宙にならなかった。

## R2/R3 — 最大9星の局所tree: rejected

衝突回避と可読性は満たしたが、広い空白に小さなnode-link図だけが残った。利用者判定は「思ってたのと違う」。宇宙全体と将来の変化する集団をMVPから切り落としすぎたため、small treeを画面全体とする案を撤回した。

## R4 — Cosmos Field with focused link path: source verified, then rejected by user

- 背景を偽particleで埋めず、最大72個すべてを取得済み実ノートにした。
- 最大3本×6星の明示Wiki-link列を内部候補にし、同時に見える／開けるのは1列だけとした。
- focusを9秒ごとに移し、3focus後にscene全体をdissolve／recomposeする。
- linkは90msずつ順に現す。位置と光は今回の構図で、意味、重要度、存在度、真のclusterではない。
- 長い題名は表示だけ短縮し、caption先頭へ `72個すべて実在ノート · 線は明示Wikiリンク` を置いた。
- 自動検証は通ったが、利用者実見では星野の中に固定された小Graphが残り、「空間を量子が飛び回って集まり分離する」像と違うため不採用になった。

## Independent objections and resolution

- AMBIENT: 固定三角と時間停止をreject。固定zoneをやめ、focus移動／dark hold／edge順次表示へ変更。最終P0/P1なし。
- GEOMETRY: hub graph 11.69秒とfield fallbackの交差、public 6×6の反例を発見。近傍cache、candidate clearance、public 3×6 clampで解消。最終accept。
- VERIFY: distant候補がbuttonとして支援技術から開ける欠陥を発見。`span aria-hidden`へ変更。最終P0/P1なし。
- CEO-01: compact captionの事実説明切れを証跡画像から確認。短題と文言順を修正した。

## R5 — autonomous particle field: current

- 利用者が定めたTSUZUNE思想を製品境界として採用した。ノートは世界そのものではなく局所的な分節、すべての表示・検索・Graph・AI整理は観測表現である。
- Wiki link、名前、語彙、階層、更新時刻を運動から外し、最大72個の取得済み実ノートだけを粒子にした。
- 固定scene、固定path、edge、中心node、背景用fake starを削除し、一枚のCanvasで連続運動させた。
- 72 frameごとに生まれ、220〜320 frameで消える最大5個の移動tideを用い、各tideへ15〜35%だけが参加する。非参加粒子は漂流し、密度を避ける。近距離反発と終盤のreleaseによって、合流を恒久化させない。
- 同じseedでは決定的だが、表示上は0〜60秒の間に散在、二群、三群、大合流、再分散、別構成への再編が連続する。

## R5 objections and resolution

- DYNAMICS-PROBE: 初期案が中央へ崩壊することを発見。恒常中心力を棄却した。
- VERIFY-R5: pairwise案が一つの連続雲に留まることと、名称変更でsimulationがresetすることを発見。pairwise案を棄却し、field identityをseed＋pathだけにした。
- VISUAL-R5: 固定四象限tide案を固定配置としてreject。tideの位置、寿命、参加率を連続・非同期・決定的に生成する形へ置換した。
- 最終VISUAL-R5: 30〜40秒の大合流は強いが50秒で明確にほどけ、60秒では別構成になるためMVP accept。追加の星、線、HUD、操作は不要。
- 最終VERIFY-R5: 未提示4 seed×2,000 frameで2〜6群、最大群11〜45、RMS 0.306〜0.440。名称全置換＋900 linksでも運動不変。P0/P1/P2なし。

## Current decision

R5を検証済み開発source MVPとして採用する。R0〜R4は不採用履歴であり、現行仕様ではない。AIが出典・時点・履歴・不確実性を扱って新しいidea候補を生むLiving CosmosはHeldのままとし、runtimeや依存を先回りして作らない。自動受入は主観的な「宇宙に見える」「見続けたい」を代替しないため、実Vaultで60秒以上眺める利用者確認を次の独立gateに残す。本番反映はさらに別gate。

## 2026-09-04 — LIFE Weather全体設計

- 工房主は、好きな音楽、とくにYouTube URLを作品へ合わせる構想を含めて、先に全体設計を固める方針を採用した。
- 作品構造を、実noteが可能な現象を供給する`Note Life Physics`、時点・尺度・密度・生成様式を編曲する`Art Score`、音楽が呼吸と強度を変える`Music modulation`へ分離した。
- YouTubeは公式IFrame Playerの時刻／状態同期とし、raw音声の抽出、hidden player、FFT済みという虚偽を禁止した。実周波数反応はLocal audioとWeb Audio APIで扱う。
- Silent／Local audio／YouTube clockを最終MVPへ含めるが、実装順は作品の核を先にする。次は隔離prototypeのGate 3A前半だけを作り、90秒の工房主採否まで音楽UIと製品統合を着手しない。
- 設計正本: `life-weather-overall-design.md`。

## 2026-09-04 — 音楽なしへの設計変更

- 工房主は、まず音楽なしでLIFE Weatherを芸術として成立させる方針を採用した。
- 音楽、Local audio、YouTube同期をMVPから外し、将来のHeld候補へ移した。
- 作品の呼吸、緊張、転調、静寂は、資料時間、note由来現象、場の現在状態と履歴だけから作る。
- MVPを、Gate 3Aの無音作品性、Gate 3BのVault因果、Gate 3Cの長時間構成へ再定義した。

## 2026-09-04 — Gate 3A前半の初回実装

- 599 notesは力学上のlogical agentとして維持し、各noteからsource indexへ戻れる8 visual fragments、合計4,792片を描画する形へ変更した。
- 実snapshotの発芽・回帰・合流候補だけをcue源として選び、90秒をemergence、gathering、transformation、afterlifeの四相へ構成した。各相は速度、場への応答、dust、filament、露光、移流を変える。
- nodeから線を生成せず、visual fragmentsの残像を共有速度場で移流してfilamentを作る。白黒paletteと最小操作は維持した。
- 24件の力学／描画契約testはPASS。Codex内ブラウザで初期、集積、変容、余韻を実見し、描画停止やshader失敗は見られなかった。
- 自動確認では作品としての採否を確定しない。高精細場、membrane／cloud、4分構成、本番統合、音楽は未着手のまま、工房主の90秒判定で停止する。

### 工房主追補 — 小さな太陽系とhover

- 工房主の「太陽系のような動き」という比喩を受け、8片を一つの発光核と7周回片へ変更した。周回片は軌道半径、軌道面、速度、順逆方向が異なり、奥行き通過で光量と見かけの大きさも変わる。
- 光へpointerを合わせるとsource note名を表示する。高速周回で対象を見失っても読めるよう1.4秒だけ表示を保持する。本文とpathはsnapshotへ含めない。
- Codex内ブラウザで実際のpointer操作により`会話-新しいソフト作成希望`のnote名が表示されることを確認した。

### 工房主実見 — 可視fragment案の不採用

- 工房主は、一つのnoteを核と複数の微粒子へ分けた姿について、作品としては変更前の方が良かったと判断した。この判断を自動testより優先する。
- 4,792片のvisual fragmentと核・衛星表現を撤去し、599 notesを599個の光として再び一対一で描く。由来は光へのhoverでnote名を示すことで保ち、本文とpathは表示用snapshotへ含めない。
- 太陽系らしさは装飾衛星ではなく、実資料の発芽・回帰・合流から生じる一時重心の周囲を複数noteの光そのものが公転し、捕獲・圧縮・離脱・残響する大域力学へ移した。
- 90秒Art Score、共有場で移流するfilament、白黒palette、最小操作は維持する。作品としての最終採否は工房主の再実見まで確定しない。

### 工房主再実見 — 捕獲・離脱tempoの減速

- 工房主は、一note一光への回帰後も捕獲と離脱の切替えが速く、現象を見届ける前に次へ移ると判断した。
- 原因は90秒へ4候補を詰め、3本のevent laneを時間差で走らせたことで、画面内の対象が約7.5秒ごとに切り替わっていたことだった。
- Art Scoreの資料現象を発芽・回帰・合流の3種に絞り、同時重心を最大2つ、一現象を最低30秒とした。capture／compressionを合わせて約20秒、rupture／afterglowを約9秒へ延ばし、各段階の力も弱めた。
- 24件のmodel／renderer契約testとCodex内ブラウザの再読込を確認した。美的な速度の最終採否は工房主の実見へ残す。

### Gate 3A形態場feedback — 漂流から形態形成へ

- 「時間が経っても漂う点にしか見えない」という不採用理由を、粒子の集散が画面全体の形態へ蓄積せず、背景表現も運動を変えない一方向描画だったことに置いた。
- 発芽・回帰・合流の各現象が、参加noteの位置を中心に二本または三本の渦状稜線を共有履歴へ刻むよう変更した。稜線の向き、巻き数、位相は現象種とsource noteから決まり、新しい資料現象を乱数だけで捏造しない。
- 共有履歴の密度勾配と回転をnote運動へ戻し、残光も場の接線方向へ運ぶfeedback loopにした。これにより、雲・腕・裂け目が粒子を曲げ、粒子が次の形態を更新する。
- procedural noise、grain、独立haze形状をrendererから外した。可視の白い体積はnoteの通過履歴と資料由来の形態場からだけ合成する。
- model／renderer契約26件とtypecheckはPASS。Codex内ブラウザで形態場、粒子群、時間変化を実見し、WebGL error 0、browser warn／error 0を確認した。
- 自動検証は芸術性を確定しない。製品統合、本番更新、Git delivery、音楽、新規依存は未実施のまま、工房主の美的採否へ渡す。

### Gate 3A構図優先reset — 星野から一つの現象へ

- 工房主の「芸術的ではない」という再判定を受け、均等な599点と薄い煙を高級screen saverへ留まる原因と判断した。粒子数やshader装飾ではなく、主役、余白、時間的な起伏を作り直した。
- 599 noteは削除せず、一巡で同時に前景化するLife Weather現象を一つへ限定した。非参加noteはnote由来の位相で疎な暗い星野へ退き、現象energyを持つnoteだけが明るい物質と長時間露光を担う。
- 各資料現象の30秒をvoid、ignition、formation、rupture、afterimageへ再構成した。大半が暗闇の状態から、一つの非対称な墨流し状形態が生まれ、破断し、履歴だけが残る。
- 低解像度のflow densityを直接表示せず、高解像度のnote通過履歴だけを拡散・移流・露光する。したがって今回の大形態は独立した煙画像ではなく、実noteの運動が残した像である。
- 27件のmodel／renderer契約test、typecheck、構文検査がPASS。Codex内ブラウザで599 particles、単一のrecurrence現象、afterimage、WebGL error 0、大形態と暗い余白、実pointerによるsource note名表示を確認した。美的採否は工房主へ残す。

### Gate 3B宇宙奥行きreset — 墨面から星野へ

- 工房主はGate 3Aを「墨彩画系が強すぎて宇宙感が少ない」と判定した。原因を、低密度の通過履歴まで持ち上げる合成と、小さい遠近投影差に分離した。
- 投影倍率をdepth 0.76〜1.24へ広げ、奥行き別の視差を増やした。疎な遠景noteを増やし、現在そこにあるnote光だけを増光した。
- 通過履歴の拡散、粒径、露光、最終合成を段階的に縮小した。履歴は力学feedbackとafterimageの由来として保持するが、可視上は光の周囲に限られた希薄なガスへ退く。
- renderer契約8件、全model／renderer契約28件、typecheck、構文検査がPASS。Codex内ブラウザで599 particles、depth spread 0.7245、WebGL error 0、再読込後のwarn／error 0を確認した。作品性は工房主の実見待ち。

### Gate 3B.1播種相 — 離散後の暗転から次の宇宙へ

- 工房主は、rupture後に全体が暗くなる構成を作品上の弱点とし、複数の改善を一度に統合して試すことを承認した。
- 離散を消失ではなく光の移送として扱い、afterimageをseedingへ置換した。中程度のevent energyを持つnoteへ残光を戻し、背景noteも完全には眠らせない。
- 同時現象を実snapshot由来の最大2件へ戻し、各現象の実source noteを複数の小核として使う。参加noteの離脱は、高速放出、三次元的な周回、緩い漂着の三様へ決定的に分けた。
- 次の現象を前の余韻と重ねることで、核から星野、星野から別の核へ構図が連続する。装飾用の偽星、関係線、独立した煙模様、全画面の一様増光は追加していない。
- model／renderer契約30件、typecheck、構文検査がPASS。Codex内ブラウザのseeding相で599 particles、2つの実資料現象、affected share 0.4558、depth spread 0.7489、WebGL error 0を確認した。暗転は解消した一方、画面端の高密度核が強くなる瞬間は美的判定事項として残る。
