# Result 24 — Art Verification Checklist（準備のみ）

status: awaiting-prototype-url
role: ART-ADVERSARY / verifier
scope: running isolated prototype only

## 禁止境界

- この文書は実行前のchecklistであり、まだbrowser run、PASS/FAIL、screenshot、利用者受入はない。
- prototypeのcode、TSUZUNE、packet、production、Gitは変更しない。
- 美的好みを一般基準にはしない。判定するのは、採用済みArt Directionのkill criteriaに対する今回の作品の可否だけである。

## 実行前に親が渡すもの

- 同じbrowser環境で開けるprototype URL。
- `Vault aggregate` と `synthetic control` の切替方法、および同一seed／同一viewport／同一DPRで比較できる手順。
- 作品外の制作情報面（入力三系統、各変換、表していないこと）。
- reduced-motionと制作情報の到達方法。URLがなければ本checklistで停止する。

## 共通記録

各runで次を結果文書に残す。

- URL、run開始時刻、viewport、DPR、data mode、seed/date salt、pause/reduced-motionの初期状態。
- 0s、30s、90s、3m、6m、9m、12mのscreenshotまたは短い録画時刻（取得可能な場合）。
- 最初の5秒の印象を、data modeを見ずに一文で記録する。
- 固定loop、同じpeak、永久cluster、中心、四象限、scene切替、UI侵入があれば最初の検出時刻と証拠を記録する。

## A. 90秒対照 — control と Vault の因果

### 手順

1. reviewerはmode名を見ない状態で、同一seed・同一viewportの二runを90秒ずつ見る。順番は親がランダム化する。
2. 各runの5秒印象、30秒時点、90秒時点で、形態・変化の間隔・trail／密度／位相の三軸を言葉で記録する。
3. その後に制作情報面を開き、宣言済みの三入力系統（feature sketch、relation分布、時刻分布、path hashのうち採用したもの）が、独立した形態差へ効くという説明と照合する。

### PASS

- 二runの差が、単なる粒子数、palette、速度、random seedの差だけでなく、事前宣言された三系統の入力と対応する形態的差として説明できる。
- reviewerがdata mode名を伏せた記録だけから、どちらがVault aggregateかを一貫して選べる。選択の理由は「重要」「似ている」「価値が高い」等の意味・価値断定を使わない。
- 最初の5秒で、主語が数えられる星／node／edgeではなく、field、薄膜、流れ、堆積、浸食などの連続的な表面として知覚される。

### FAIL / kill

- 90秒後に二runの差を識別できない、または差が件数・seed・見た目だけで、入力三系統と追跡できない。
- 最初の印象が「粒が動いている」「Graphを隠しただけ」であり、その後も連続fieldへ読み替わらない。
- title、本文、relation、更新時刻のいずれか一属性が、光量・中心・寿命・永続性を同時に支配して、重要度／意味／同一性を暗示する。

## B. 12分無操作鑑賞 — 時間の反証

### 手順

1. 実Vault aggregate modeを、操作せず12分間連続再生する。pause、pointer、camera、preset、制作情報は使わない。
2. 0s、30s、90s、3m、6m、9m、12mで記録し、静穏、形成、増幅、崩壊、余韻がscene切替でなく重なって生じているかを確認する。
3. 12分後に最初の30秒記録と比較し、同じ構図・中心・peakの単純な再演かを確認する。

### 固定loop の判定

FAILは、12分内に同じ卓越した形態が**同位置・同じ進行方向・同じ増幅から崩壊までの順序**で再出現し、二つの時刻証拠で示せる場合。意図的な小さな乱れだけを足した同一sceneも同じ扱いとする。

### permanent cluster / center の判定

FAILは、画面の主視覚量を占める一つの凝集または中心が3分以上維持され、浸食・移動・分裂で主役を交替しない場合。単発の大きな凝集は、別の流れへ明確にほどけ、後の時点で異なる主構成へ移らなければFAIL。

### fixed zone / scene-switch の判定

FAILは、四象限、固定ring、定位置の湧出点、区切られたfade-to-black／cutによるscene交替が読める場合。fieldは連続変化である必要があり、位置が違うだけの同じpreset列でもFAIL。

### PASS

- 12分を通じて、固定loop、永久cluster、固定中心、四象限、明白なscene切替を検出しない。
- 少なくとも三つの異なる変容（例: 堆積優勢、浸食優勢、広域同期、局所の裂け目）が、同じpeakの繰返しではなく観測できる。
- 使用者が直後の三問で、(1) 見続けたい／また開きたい、(2) generic particle demoでなく自身のVaultから立ち現れた瞬間があった、(3) それを真の意味・価値・重要度と断定せず説明できる、の全てを肯定する。

## C. UI と control の侵入

### 鑑賞面 PASS

- 常設title、node、edge、node label、件数、legend、cluster名、caption、HUD、debug値、preset、camera control、pointer interactionがない。
- visual fieldはviewportの80%以上を占める。
- Escape、pause、reduced-motion、制作情報だけが到達可能で、作品面から独立した最小controlとして働く。

### FAIL / kill

- 鑑賞開始後に常設文字またはGraph読解用UIが見える。
- controlが二つを越える、またはcontrol／cardが作品より主張する。
- pauseやreduced-motionがfieldの停止・静止presentationへ正しく移らない。

## D. 作品外の provenance と privacy

### PASS

- 制作情報面に、採用入力、変換、表していないことが区別して記載される。
- 本文、title、個人史、閲覧履歴、AI推定の原文が、opt-inなしに画面・screenshot・recordingから復元できない。
- source mappingは説明可能だが、作品面のlegendには戻らない。

### FAIL / kill

- 作品の由来を説明するために、意味／感情／品質／真の関係を推定または断定している。
- provenanceを示すために固有原文、個人情報、note UIを鑑賞面へ戻している。

## E. 利用者受入と停止

- 90秒対照、12分無操作、直後三問、翌日再訪のいずれかを利用者が不採用としたらFAILとし、UI微修正やparticle増量で延命しない。
- 翌日再訪は静止画を送る代替ではなく、同じ作品を本人が自発的に再開することを確認する。
- PASSでもisolated prototypeの鑑賞受入に限る。TSUZUNE統合、production反映、Git delivery、意味的AI機能には進めない。
