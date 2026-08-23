# TSUZUNE 改善・未達成項目 実行台帳 — 2026-08-23

## 結論

- 現役の製品実装Primaryはありません。
- 今すぐ続けるのはinstalled TSUZUNEの日常利用観測です。観測のための専用dogfoodや追加実装は作りません。
- 次に行う作業はrepository closeoutのread-only棚卸しです。製品sliceではなく、削除・commit・push・production updateは別判断です。
- Graph、Context、AI履歴圧縮、現在状態コンパイラ、DB、Hooksは再開条件が成立するまで着手しません。

この台帳は候補を増やすためではなく、「今見るもの」「選べる次候補」「止めておくもの」を一枚で区別するための索引です。実装順と完了条件の正本は[PLAN.md](../../PLAN.md)、本番状態は[PROJECT_STATUS.md](../../PROJECT_STATUS.md)、固定証拠は[docs/INDEX.md](../INDEX.md)を優先します。

## 状態の意味

| 状態 | 意味 | 着手条件 |
|---|---|---|
| Observe | 実装済み機能を普段使いし、自然な摩擦だけを確認する | 追加承認不要。製品変更なし |
| Next candidate | 次に選べる作業だが、まだ承認済みPrimaryではない | 利用者の明示選択 |
| Held | 再開条件が未成立 | 再開条件と利用者の明示選択 |
| Research | 比較・調査対象であり、実装候補ではない | 固定fixture、反証、最小可逆案を先に用意 |
| Complete | 本番受入済み。再実装しない | 回帰または新しい要求が確認された場合だけ再確認 |

## 現在の実行台帳

| ID | 状態 | 項目 | 現在地 | 再開・完了条件 | 次に残す証拠 | やらないこと |
|---|---|---|---|---|---|---|
| OBS-01 | Observe | R4/R5日常利用 | 自動test、隔離Electron、installed受入は完了 | 日本語IME、720/900px、長いtitle/path、focus、tab closeを普段のVaultで確認 | 同型摩擦の内容と再現条件。問題なしの場合は追加実装なし | 先回りしたUI改修 |
| OBS-02 | Observe | 新形式AI history chain | 将来のchain metadataは実装済み。旧形式153 targetsは検証不能 | 新形式履歴が実利用で蓄積し、連鎖・復元可能性を確認できる | verified chain件数、失敗例、read-only preview | 旧履歴の推測圧縮 |
| NEXT-01 | Do next（非製品） | Repository closeout | working treeは大量dirtyで、installed sourceとはmismatch | read-onlyで所有範囲と機能契約別変更を分類し、処置案を提示 | modified／untrackedの分類、保持／除外／要確認、必要gate、残余risk | 一括削除、無関係diffの巻戻し、無断commit／push、即production update |
| HELD-01 | Held | AI history compaction | read-only previewまで。153/153がlegacy-unverifiable | verified chainとbyte-level rollbackが成立 | 対象manifest、前後digest、復元試験 | 安全条件なしのapply |
| HELD-02 | Held | Graph／Excluded files残件 | Manage UI、FileTree directory、全surface固定比較は未完 | 利用者が対象surfaceを一つ選ぶ | Obsidian固定比較、操作契約、回帰test | Graph全体互換への拡大 |
| HELD-03 | Held | Context usage measurement／X1-C2 | source/revision/range再読量と実費は未観測 | Context量が反復する主要ボトルネックと確認される | 同一task比較、model-visible量、再読回数、品質 | 先行cache、BM25、Vector化 |
| HELD-04 | Held | Current-State Compiler R1〜R10 | R0はPilotなし。State PacketとEnvelopeは安全・総量gate不合格 | 明示選択または同型摩擦に加え、完全修飾ID・明示除外validator・通常文以下の総量gateを事前登録 | write-zero fixture、exact trace、silent omission 0 | schemaやMCP toolの先行実装 |
| HELD-05 | Held | Hooks／DB／広域Graph | 現行責務で足りない反復失敗が未成立 | Skillや既存artifactでは解けない独立失敗が2件以上 | read-only trialと不採用可能な比較 | 常駐Hook、全Vault ingestion、新DBの先行導入 |
| RESEARCH-01 | Research | semantic no-op／owner候補／projection | 研究対象。製品責務には未採用 | 実在摩擦、固定fixture、最強の反証、最小可逆案 | Evidenceと不採用理由 | 研究成果の自動昇格 |

NEXT-01は[PLAN.md](../../PLAN.md)の製品Nextを変更しません。承認済みの製品sliceは引き続き「なし」です。今回選んだのは、次の製品判断を安全にするための非製品closeout棚卸しだけです。

## 批判的・現実的な決定

### する

1. R4/R5と新形式AI historyは普段の利用の中だけで観測する。専用の観測期間や追加機能は作らない。
2. 次作業としてrepository closeoutのread-only棚卸しを行い、modified／untrackedを機能契約・所有者・証拠・生成物へ分類する。
3. 棚卸し結果を提示した後、保持、commit候補、除外候補、要確認を個別に決める。

### 今はしない

- AI history compactionのapply。旧形式153 targetsを安全に検証できない。
- Graph／Excluded filesの追加実装。利用者が困っている単一surfaceが選ばれていない。
- Context cache、BM25、Vector化、X1-C2。Context量が主要ボトルネックという実測がない。
- Current-State Compiler R1〜R10とCompact Decision Envelope。Pilotがなく、比較案はexact traceと総量gateに不合格。
- Hooks、DB、全Vault ingestion、広域Graph、自動整理。解決対象となる反復失敗がない。
- 新しい研究テーマ。既存Researchは必要が生じるまで読むだけにし、能動的に進めない。

### 条件成立時だけする

- Graphは、実利用の困りごとと対象surfaceが一つに絞れた時だけ比較する。
- Context測定は、同じ再読・過剰Contextが独立taskで2回以上起きた時だけ行う。
- AI history compactionは、verified chain、対象manifest、前後digest、byte-level rollback試験が揃った時だけ再審査する。
- 製品sliceは、利用者の明示目的または同型摩擦2件以上があり、何もしない案と最小可逆案を比較してから一件だけ選ぶ。

### 現実的な停止線

- Repository closeoutは最初にread-only分類まで。削除、移動、stage、commit、push、production updateへ自動で進まない。
- 観測結果が「問題なし」なら、それを有効な完了として機能を追加しない。
- 便利そう、将来使いそう、研究として面白い、だけでは着手しない。

## 再実装しない完了群

- Markdown編集、検索、Wiki link、backlink、Context、Temporal Memory Lite。
- revision付き単一note更新、exact no-op／patch、Review、AI履歴、protected path。
- Drive preview／apply、Path Alias、単一note move。
- Quick Switcher、Command Palette、Full-text Search、右Context tabs。
- R4 FileTree keyboard／ARIA、R5 Workspace Tabs keyboard／ARIA。
- stale runtime guard、delivery info、production gate。
- R0棚卸し、State Packet比較、Compact Decision Envelope benchmarkは「比較完了・不採用」であり、製品実装完了ではありません。

## 更新案の採否

| 更新案 | 判定 | 理由 |
|---|---|---|
| Daily-use Acceptance | Observeとして採用 | 製品変更なしで未観測境界を確認できる |
| Repository Closeout | 次候補 | 新機能より先にsource／installed境界を整える価値が高いが、実行は別承認 |
| Verified History Compaction | Held | legacy履歴の検証可能性が不足 |
| Graph／Excluded Narrow Slice | Held | 対象surfaceの明示選択がない |
| Context Usage Measurement | Held | 主要ボトルネックという実測がない |
| DB／Vector DB／Hooks | 不採用継続 | 現行責務との重複と複雑化を上回る根拠がない |

## 判断順

1. OBS-01とOBS-02の自然利用を続けます。
2. 利用者が作業を選ぶ場合、まずNEXT-01 Repository closeoutを候補にします。
3. 同型摩擦が2件以上になった場合だけ、対応するHeldを一件選びます。
4. 一件の受入が終わるまで別候補を並行Primaryにしません。

## 停止条件

- 明示選択も再開条件成立もない間は、新しい製品sliceを開始しません。
- 調査や監査の完了を実装承認へ読み替えません。
- dirty sourceをinstalled productionと同一視しません。
- この台帳へ日々のログや完了証拠本文を複製しません。状態が変わった時だけ更新します。

## 根拠

- [Product Plan](../../PLAN.md)
- [Project Status](../../PROJECT_STATUS.md)
- [Latest production receipt](production-update-latest.json)
- [AI history compaction preview](history-compaction-preview-2026-08-16.md)
- [Daily Workspace Phase A](daily-workspace-phase-a-2026-08-22.md)
- [Daily Workspace Phase B](daily-workspace-phase-b-2026-08-22.md)
- [Compact Decision Envelope benchmark](compact-decision-envelope-benchmark-2026-08-23.md)
