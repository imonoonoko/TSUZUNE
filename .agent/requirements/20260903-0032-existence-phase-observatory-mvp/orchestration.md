# 観測宙域 オーケストレーション記録

## Real-universe foundation research — complete

- COSMOS-SCALE／調査員（`gpt-5.6-terra`／medium）: 宇宙史、大規模構造、銀河、尺度・時間を一次資料中心にread-only調査。観測事実、base-ΛCDM、未解決を分離し、`results/38-cosmic-structure-and-timescales-research.md`を親が統合した。
- STAR-FORMATION／調査員（`gpt-5.6-terra`／high）: 分子雲、星間物質、恒星誕生、feedback、jet、超新星残骸をread-only調査。単線因果の反証と環境依存を含む`results/39-stellar-formation-and-feedback-research.md`を親が統合した。
- LIGHT-OBSERVATION／調査員（`gpt-5.6-terra`／medium）: 放射・吸収・散乱、波長、dust、spectral line、false color、観測画像処理をread-only調査。physical scene／measurement／displayを分けた`results/40-light-observation-and-visual-truth-research.md`を親が統合した。
- VERIFY-01／検証員（`gpt-5.6-terra`／high）: `results/38`〜`41`をread-onlyで独立監査。初回に過度一般化、分類誤り、source不整合を検出し、親修正後に四分類、数値留保、42 source、推薦境界をPASSした。結果は`results/42-real-universe-independent-verification.md`。
- CEO-01／工房長（`gpt-5.6-sol`／medium）: gap matrix、一次資料spot-check、反証、候補比較、統合研究ノート、未提示境界検証、唯一のTSUZUNE writebackを所有した。subagentはrepo／TSUZUNEを変更せず終了した。
- adopted: 尺度階層、dark material／occlusion、energyによる物質変化、非対称なinflow／outflow、異なる時計、共通world-space。一つのStellar Nurseryを制作上の第一候補とする。
- held: Cosmic web、galaxy、black-hole accretion、supernova remnantを第一作の主舞台にする案。科学的唯一解、公開画像collage、均一な光網、cameraに従うscreen-space flowは不採用。
- verification: S01〜S42の42件とC01〜C24の24 claim、独立再監査PASS、TSUZUNE exact read-back、file／path一意検索1件、backlink 3件。
- stop: 工房主が三つの実在target familyから一つを選ぶまでGate 3D実装へ進まない。横断資料数やagent数を増やすための追加調査はしない。

## Art-first redesign — current

- REFERENCE-MOTION／調査員: `gpt-5.6-terra`／medium。5基準作品の一次資料比較をread-onlyで担当。Tendrilsの履歴feedback、Unsupervisedのarchive traversal、FLUXの時間変化と減衰、Miriのpersistent fieldを採用候補として分離し、Holtset固有仕様はunknownとした。
- THEORY-TRANSLATION／正本・文脈監査員: `gpt-5.6-terra`／high。存在相とTSUZUNE正本をread-onlyで監査。採用済みsource、局所的芸術仮説、禁止claimの三層を返し、作品を理論実証へ格上げしない境界を固定した。
- RUNTIME-FEASIBILITY／制作系scout: `gpt-5.6-luna`／low。current code pathをread-onlyで追跡。Canvas 2D延命を最小差分として提示したが、親は作品要件を満たさないため不採用。WebGPUも既存根拠不足で不採用とし、isolated WebGL2 prototypeだけを次候補にした。
- ART-ADVERSARY／検証員: `gpt-5.6-terra`／high。R0〜R5と新思想を反証し、R5豪華化をreject、`Archive Weather`と対照Vault／12分／翌日再訪gateを提案。read-only packetの契約に反してpacket本文へ結果を追記したため、親がpacketを復元し、成果を`results/18-art-adversary.md`へ分離した。codeとTSUZUNEへの変更はなかった。
- CEO-01／工房長: 全packetを統合し、node／edge／particleを表面から退場させる`Archive Weather`、複数Vault差異の追跡可能な変換、isolated WebGL2 prototype、kill criteriaを`art-direction.md`へ確定した。

採用: 履歴feedback、archive由来の連続変容、減衰、再出現、非node連続体、三系統以上のVault入力、制作情報の別面化。

不採用: R5のCanvas 2D装飾延命、reference表層コラージュ、WebGPU先行、常時label／edge／HUD、semantic embedding、AI意味断定。

未提示境界: 同件数controlとの識別、12分無操作、翌日再訪、実FPS／DPRはprototype実装後でなければ未確認。設計完了を美的受入と同一視しない。

## R5 final packet boundary

- CEO-01／工房長: `gpt-5.6-sol`、利用者指定ultra。Task Contract、Skill選定、renderer／CSS／acceptance統合、未提示境界検証、workflow、唯一の本番TSUZUNE writebackを所有。production update、Git delivery、可視起動は範囲外。
- DYNAMICS-R5／Ampere: 継承`gpt-5.6-sol`／ultra。`src/core/observatory.ts`と`tests/observatory.test.ts`だけを所有。renderer、CSS、acceptance、workflow、TSUZUNEは禁止。有限寿命の非同期tide案を実装し、親が採用。
- DYNAMICS-PROBE／Copernicus: 継承`gpt-5.6-sol`／ultra。力学のread-only反証のみ。初期の恒常中心収束を検出し、親が中心力案を棄却。
- VISUAL-R5／Kepler: 継承`gpt-5.6-sol`／ultra。画像列のread-only defect-first監査のみ。固定四象限版をrejectし、最終0〜60秒列をaccept。
- VERIFY-R5／Wegener: 継承`gpt-5.6-sol`／ultra。code、tests、receipt、未提示seedのread-only検証のみ。pairwise一雲化と名称変更resetを先行版で検出。最終版はP0/P1/P2なしでaccept。
- 全員が無関係なdirty-tree workを保持し、本番TSUZUNEへ書かず、契約拡張時に停止する境界を守った。

## R5 integration decisions

- adopted: 一時的な移動tide、部分参加、近距離反発、late release、pathだけのfield identity、Canvas-only renderer、one pause。
- rejected: 恒常中心力、全粒子pairwise引力、固定四象限tide、固定path／edge、fake star、追加HUD／操作。
- parent unseen boundary: final hashを独立検証へ渡し、visible testsと異なるepsilon／iota／kappa／lambdaを2,000 frame、名称全置換＋900 linksを検証。親は最終full suiteを再実行した。
- final evidence: core/view 17 tests、independent scope 115 tests、full 973 tests、typecheck、build、script syntax、dense／singleton offscreen acceptanceがPASS。
- residual: 美的採否、実Vault、installed productionは未確認。利用者画面は開いていない。本番TSUZUNE writebackはstale runtime guardが変更前に拒否し、MCP client再起動待ち。

## R0–R4 historical owner and packets

- CEO-01 / 工房長
- model / effort: gpt-5.6-sol / user-selected ultra for redesign
- ownership: Task Contract、Skill選定、source実装、統合、未提示境界検証、本番TSUZUNE最終書戻し、利用者説明
- forbidden／stop: 本番更新、Git delivery、active Vaultの自動操作、理論命題の新規採用をこのwork itemへ広げない

## Temporary agents

### AMBIENT-R2 / Godel — 鑑賞体験反証

- model / effort: inherited gpt-5.6-sol / ultra
- ownership: 失敗画像、latest screenshots、時間・注意・最低操作のread-only監査
- forbidden: product／tests／TSUZUNE編集、主観的美しさの自動確定
- findings: R3の固定三角、edge一斉表示、「観賞用」文言をreject
- adopted: focus移動、edge stagger、実ノート文言、短題化
- final: dense fixture MVPとしてaccept、P0/P1なし。実Vaultの主観受入は未確認

### GEOMETRY-R2 / Helmholtz — 配置・性能反証

- model / effort: inherited gpt-5.6-sol / ultra
- ownership: selector、layout、第三node clearance、性能のread-only監査
- forbidden: product／tests／TSUZUNE編集、意味scoreの導入
- findings: hub-heavy 11.69秒、fallback clearance欠落、public 6×6で0.00252 viewBox交差
- adopted: neighbor cache、4096 candidates、fallback >=2.4、template拡張、public max3×6 clamp
- final: 100 seedでminimum 3.2054 viewBox、hub-heavy 207.8ms、accept。契約外手製sceneの最終fallbackだけP2

### VERIFY-R2 / Schrodinger — アクセシビリティ・受入反証

- model / effort: inherited gpt-5.6-sol / ultra
- ownership: code、19 tests、acceptance receiptのread-only defect-first監査
- forbidden: product／tests／TSUZUNE編集、fixtureを美しさの証明にすること
- findings: distant12星が非TabでもbuttonとしてATから開けた
- adopted: distant／fieldをpassive `span aria-hidden`、acceptanceへpassive／path照合を追加
- final: P0/P1なし。runtime reduced-motion切替testとcaption全文視認はP2

### ACCEPTANCE-R4 — bounded acceptance制作

- role: 制作
- ownership: `scripts/run-observatory-acceptance.mjs`のR4 dense／compact／transition／singleton受入
- forbidden: product UI、TSUZUNE、通常Graph変更
- parent integration: 589/4175 fixture、phantom path検知、passive star、focus movement、sequential delay、clearance、hashを採用・補強

### DOCS-R2 / Epicurus — workflow文書制作

- model / effort: gpt-5.6-luna / low
- ownership: このrequirement directoryだけ
- forbidden: product、tests、共有PLAN／PROJECT_STATUS、本番TSUZUNE
- result: R4のpurpose／scope／requirements／result pointerを更新。親が残るR2/R3文書と最終evidenceを統合した

## Historical R4 verification

- R4では公開option clamp、第三node clearance、passive star、focus transitionを検証した。しかし「正しく動く固定link列」であっても利用者像を満たさないため、結果を現行採用根拠には使わない。
- reusableだった実ノートprovenance、offscreen fixture、accessibility境界だけをR5へ移した。

## Improvement decision

- maintain: 力学、視覚、実装受入を独立反証に分けたことで、中心崩壊、一雲化、固定四象限、name-resetという異なる欠陥を実際に除去できた。
- change: 静止画一枚や30秒だけで採否せず、合流がほどける60秒列を標準の観測単位にする。
- stop: agent数のための追加分業、同じ画面への装飾追加、production操作は行わない。次は利用者が望む時の実Vault鑑賞だけ。
