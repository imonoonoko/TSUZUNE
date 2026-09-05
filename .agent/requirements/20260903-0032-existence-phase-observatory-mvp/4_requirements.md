# 観測宙域 MVP Requirements（R5）

R4 の固定scene・星座・Wiki link描画は利用者確認で不採用になった。本書が現行要件を置き換える。

## 1. Data truth

- 入力は既存 `WikiGraph` に含まれる取得済み・解決済みMarkdown noteだけ。表示粒子は最大72個、すべて一意の実ノートへ対応させる。
- unresolved node、tag、attachment、架空の背景粒子を表示粒子へ混ぜない。Wiki link、degree、名前、更新時刻、AI推論を運動則へ入力しない。
- note pathは、実ノートとの対応と同一graph内の決定性を保つ不透明なsaltとしてだけ使える。pathの語彙や階層から意味・近さ・価値を導出しない。
- 同じgraph、seed、algorithm versionから同じ初期状態と時間発展を得る。
- 粒子、距離、近接、速度、光、軌跡、集散は観測用の一時表現であり、関係、分類、重要度、価値、同一性、存在度、存在相そのものを表さない。

## 2. Autonomous field

- 広い一つの空間を、すべての表示粒子が常時ゆっくり移動する。固定scene、固定cluster、中心node、恒久的な領域を作らない。
- 移動し消滅する一時的な潮目へ一部粒子だけが参加する引力、近距離反発、弱い漂流、減衰、境界の復元から、接近、まとまり、離脱、別のまとまりへの再編を生む。潮目は固定位置・固定群・意味clusterではない。
- 全体random walkにはせず、少数の一貫した規則から予測しきれない時間変化を作る。O(n²)近傍計算は72粒子を現行上限とし、新しい依存を加えない。
- 1粒子でもゆっくり漂い、0粒子では正直な空状態を示す。関係や集団を水増ししない。

## 3. Presentation

- 描画面は一枚のCanvasとし、SVG edge、DOM star群、scene切替、固定三角、node間の線を置かない。
- 粒子の短い残光、奥行き、局所密度による淡い発光だけで集散を見せる。線、輪、境界、名前付きclusterで近接を固定化しない。
- Night Workshopの深い緑黒と限定した青緑白だけを使う。neon、虹色、HUD、glass、lens flare、高速camera移動、常時ピークの明滅を使わない。
- 秒単位の個体移動、数十秒単位の集散、より長い再編を同じ連続場で重ねる。画面中央に恒常的な主役を置かない。

## 4. Interaction and accessibility

- 常設操作は一時停止／再生のみ。pan、zoom、drag、次へ、設定panelを置かない。
- Canvasを一つのTab stopにする。pointer hit-testで実ノートを選びclickで開く。矢印keyで選択を巡回し、Enter／Spaceで開き、Escapeで解除できる。
- 選択粒子は色だけでなく輪郭で示し、短いnote名と操作案内をpolite statusへ出す。通常時は名前を並べない。
- `prefers-reduced-motion` では初期構図を静止表示し、rAFを開始せず、再生できる操作も出さない。
- hidden document、graph差替え、unmountではrAFを解除し、visibleへ戻った時だけ全motionを再開する。

## 5. Observation boundary

- captionは、表示粒子が実在ノートであることと、近さ・位置・光・集散が現在の観測表現にすぎないことを簡潔に示す。
- 表示されないnoteを不存在と扱わず、link欠落を関係不在と断定せず、単一scoreや形で価値を決めない。
- 本MVPは存在相理論の図解・証明・自然科学simulationではない。将来のAI再解釈や予期しないidea生成も本sliceには入れない。

## 6. Compatibility and non-goals

- 通常Global／Local Graph、その設定、Markdown、MCP、Vault schemaを変更しない。
- LLM、embedding、vector DB、app-owned DB、daemon、外部API、自律書込み、新規packageを追加しない。
- 本work itemではproduction update、Git delivery、利用者画面の自動起動を行わない。

## 7. Acceptance

- core: 実noteだけ、72上限、seed決定性、移動、境界、集まり後の離脱／再編、empty／singletonを検証する。
- view: Canvas一枚、edge 0、唯一のpause、pointer／keyboard direct-open、reduced motion、graph swap、visibility、rAF cleanupを検証する。
- offscreen Electron: full／compactとsingletonで、実粒子数、連続移動、pause中の静止、resume後の再移動、viewport内配置、edge／scene DOM不在、direct-open一致を確認する。
- `npm run typecheck`、狭いtest、`npm test`、`npm run build`、`npm run acceptance:observatory`、`node --check`、task-owned `git diff --check`を通す。

自動検証は美しさや「見続けたい」を証明しない。実Vaultでの最終鑑賞受入は利用者に残す。
