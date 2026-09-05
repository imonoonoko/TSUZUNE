# 観測宙域 Art Direction — Archive Weather

status: designed-awaiting-owner-review
date: 2026-09-03

## 一文

**ノートを星として並べるのではなく、TSUZUNEに積み重なった知識の差異と履歴が、一枚の空間に光・流れ・堆積・浸食として現れ続ける。**

仮称は `Archive Weather / 知識気象`。これは知識世界そのものでも存在相そのものでもなく、現在のVault snapshotから作る一つの生成芸術である。

理論境界は `P₀ ≠ D_c(x) ≠ T_EP` とする。粒子、場、光、流れ、密度、作品画面のいずれも、存在相そのものへ同一化しない。

## 作品の構造

### 1. Archive Field — 蓄積が作る地形

全noteを点として描かず、各noteから等量の小さなsource packetを作る。packetは本文の復元不能な特徴sketch、明示relation、時間配置を別々のseedとして共有fieldへ沈める。note数や長さをそのまま明るさ・大きさ・重要度へしない。

fieldは固定背景ではない。通過した微小tracerの運動がfieldへ弱い履歴を残し、その履歴が後続の流れを少し変える。長く残りすぎず、完全にも消えない。

### 2. Weather — 読めないが連続する時間

数万の微小tracerが、星やnodeではなく霧、薄膜、渦、筋、裂け目、降下、浮上として見える。局所的な凝集は永久clusterにならず、別の流れに浸食されてほどける。

時間はscene切替ではない。静穏、形成、増幅、崩壊、余韻が互いに重なり、12分見ても同じ周期を露出しない。日ごとにVault snapshotとdate saltから異なる気象が生まれるが、同じ日の再起動では同じ初期条件を再現できる。

### 3. Provenance without labels — 由来は表面へ貼らない

鑑賞面にはtitle、node、edge、legend、件数、cluster名、常設captionを置かない。作品外の制作情報面だけに、利用した入力、変換、表していないことを示す。

個別noteを開く機能は初回prototypeに入れない。必要性が後で確認された場合も、作品上の点をclickする方式ではなく、その時の流れへ寄与したsource群を別面で確認する。

## Vaultから作品への変換

| Vault由来の差異 | 作品内の変換 | 表していないこと |
|---|---|---|
| note本文の復元不能なfeature sketch | fieldの局所的な曲率と色相位相 | 意味、感情、品質 |
| 明示Wiki relationの分布 | 離れた領域間の弱い同期と流れの伝播 | 真の関係、類似度、中心性 |
| 作成・更新時刻の分布 | 気象の注入順序、静穏と活性の間隔 | 新しいほど重要、古いほど弱い |
| folder/pathのhash | 初期条件の空間seed | 分類が本質、folderが世界の地形 |

一つの属性が、明るさ、大きさ、中心、寿命を同時支配してはならない。入力を外した対照runで、どの形態差が消えるか追跡できるようにする。

## 借りるもの／借りないもの

- Tendrils: 履歴がfieldへ返る再帰性を借りる。線の見た目と多機能controlは借りない。
- Unsupervised: archiveを固定一覧でなく連続変容として経験させる姿勢を借りる。GANとAIの夢という語りは借りない。
- FLUX: time-varying field、減衰する軌跡、idle自走を借りる。neon palette、preset、record UIは借りない。
- Miri: 大量tracerを密度と光として扱う計算形を借りる。粒子自体を主役にせず、WebGPUは初回採用しない。
- Holtset Flow: 質量感・奥行き・粘性は鑑賞語彙としてのみ保持し、仕様の一次根拠がないため実装原理とはしない。

## MVP motion prototype

- TSUZUNE本体と切り離した一画面のWebGL2 prototype。
- synthetic control dataと、明示的に抽出したlocal Vault aggregate snapshotを切替可能にする。本文・title原文は保存・表示しない。
- persistent two-dimensional velocity field、tracer advection、短期trail、弱いfeedback、寿命と再注入だけを実装する。
- UIはEscape、pause、reduced-motion、制作情報だけ。pointer操作、preset、node open、camera、mic、AI、音楽同期は入れない。
- 新dependencyは、raw WebGL2の最小実装より明確に小さく安全になる場合だけ比較し、設計段階では追加しない。

## Kill criteria

1. 同件数の対照Vaultと実Vaultで、事前宣言した三系統以上の入力が独立した形態差を生まない。
2. 作品を見て最初に「粒が動いている」「Graphを隠しただけ」と感じる。
3. 12分以内に固定loop、中心、四象限、同じpeak、scene切替が読める。
4. 常設文字、node、edge、HUDが鑑賞面へ戻る。
5. 単一属性が重要度、価値、意味、同一性を暗示する。
6. 90秒対照比較、12分無操作鑑賞、直後三問、翌日再訪のいずれかで利用者が不採用とする。

## 次の停止線

次に実装してよいのは、このisolated motion prototypeだけである。既存`ObservatoryView`の延命、production統合、Git delivery、AI semantic整理は、prototypeが利用者鑑賞受入を通るまで行わない。
