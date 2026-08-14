# TSUZUNE Priority Reset — 2026-08-12

## 結論

次に進める主線は、単にGraphの残項目を消化することではない。まず現在のdirty working treeを次の作業の検証可能な境界に整え、実Windows accessibilityの未測定部分を測り、実Vaultの7日dogfoodを始める。

その後の次の製品sliceは、O0 Graph Parityの **Filters/Search** とする。`GP0-3b-p`の再試行、Hooks、BM25、SQLite、行動ログ、Retrieval Graphはこの順序に入れない。

この文書は優先順位の決定であり、製品コード、本番Vault、installed v0.5.0、releaseを変更する指示ではない。

## 判断に使った現物

- installed productionはv0.5.0で、2026-08-12 01:06 JSTに`installed-and-verified`。receiptはdirty source fingerprintを受入した時点の固定点であり、その後のworking treeを自動的に本番反映済みにはしない。
- 現在のbranchは`agent/tsuzune-mcp-integration`、HEADは`5266131`、working treeはdirty。次の実装前に意図した差分と検証範囲を再び対応付ける必要がある。
- Windows accessibilityはUI Automation名とGraph DOM 42 testsまで確認済みだが、実Windowsのkeyboard、screen reader、High Contrast、100〜200% DPI、720px幅は未実測である。
- O1の入力機能は実装済みだが、7日間の自然な利用と、作成ノートが検索、Wiki link、backlink、Graph、MCPへ接続する確認は未完である。
- Hooks shadowは固定corpus 3件で改善1、回帰1、不変1。通常`build_context`の順位、production Hook、行動ログ、BM25等へ進む実証はない。
- X1-T1はCodex Desktop local MCPで受入済み。ChatGPT remote MCPとhost model-visible tokenは別の未計測境界である。

正確な本番受入は[production receipt](production-update-latest.json)、全体状態は[PROJECT_STATUS.md](../../PROJECT_STATUS.md)、詳細な契約は[PLAN.md](../../PLAN.md)を優先する。

## 実行順

| 優先度 | 作業 | なぜ今か | 完了または次へ進む条件 |
|---|---|---|---|
| P0 | Delivery-boundary checkpoint | dirty treeのまま新しいsliceを重ねると、何が本番受入済みか、どのtestがどの差分を守るかが曖昧になる | 意図したcode/test/evidenceを分類し、再実行すべき検証を記録する。commit/push/reinstall/releaseは利用者の明示指示がある時だけ行う |
| P1 | 実Windows accessibility baseline | 現在の未証明範囲は品質・互換性の必須境界であり、DOMやoffscreenのPASSで代替できない | Graph keyboard flow、720px、100〜200%、screen reader、High Contrastを測定し、PASS/SKIP/失敗を分ける。失敗時だけ最小修正sliceを作る |
| P2 | O1 7-day dogfood（並行観測） | 次の入力・task・organization機能は、想像ではなく日常の摩擦から選ぶ | Daily/Idea/通常ノートの摩擦と、検索・Wiki・backlink・Graph・MCPへの接続を7日分記録する |
| P3 | Graph Filters/Search | 検索・除外は日常の知識到達性に直結し、既に基礎実装と固定比較の枠組みがある | malformed query、Manage UI、Excluded filesの全surface効果を一つの固定比較sliceで閉じる |
| P4 | AI Write Policy UI | 通常ノートへの自律更新は使えるため、利用者に見えるpolicyとrollbackを先に閉じる価値がある | 既存更新経路で`auto`/`review`/`immutable`の解決・表示・rollback・Raw Source拒否を確認する |
| P5 | 残るO0 Graph parity | 使う頻度と検証負荷が高い順に、安全に小分けで進める | 下のGraph順序で各sliceを固定比較する |
| P6 | O2 safetyとDrive基盤 | 本番Vaultの物理移動やDrive連携は、rollbackとpath契約なしに始められない | 匿名一時VaultのO2-P3 apply/rollback、またはDrive Path Alias sidecar契約を先に閉じる。本番Vault applyは行わない |
| P7 | Google/ChatGPT/外部取り込み | core利用とデータ安全が確認されてから、最小scopeで一機能ずつ接続する | 下の再開条件を満たした項目だけを選ぶ |
| P8 | O3〜O7・Plugin/GraphRAG等 | 保存・検索・復旧のcore contractが安定してから初めて価値を判定できる | 実用query、編集契約、回復・同期の基礎と、その時点の利用根拠を先に固定する |

P0は2026-08-12に完了した。分類、現行sourceの58 files／519 tests、MCP smoke、X1-T1 fixture 12/12、installed binaryとprofileの異なる証拠境界は[Delivery boundary checkpoint](delivery-boundary-checkpoint-2026-08-12.md)を正本とする。

P1とP2は並行で進める。P3以降の製品コードは、P0で固定したdelivery boundaryを前提に一件ずつ始める。

## 優先順位の訂正 — Context Budget（2026-08-12）

利用者の明示的な再優先により、P1の実Windows accessibilityは捨てずにheld quality gateへ移し、X1-C2 Context Budget Evaluationを主作業にする。既定15,000文字を直ちに変更せず、固定4問・同一sourceで4k／6k／8k／15kを比較し、回答4/4、source trace 3/3、future leakage 0、書込み0、expected-source到達性を満たす最小値だけを採用候補とする。

host model-visible tokenはhostが正確なusageを公開した場合だけ記録する。X1-T1のwire削減、Markdown文字数、tokenizer推定をtokenや費用の根拠に使わない。詳細は[Context Budget Priority](context-budget-priority-2026-08-12.md)を正本とする。

## O0 Graph backlogの内部順序

1. **Filters/Search** — malformed query、Manage UI、Excluded filesの全surface効果。
2. **Workspace state** — Local Graph、fit/reset、zoom限界、workspace leaf復元。
3. **実Vault performance** — 入力、pan、zoom、watcherが日常利用を妨げない基準を定め、既存500/2000件baselineと分けて回帰化。
4. **Groups** — 作成、編集、順序、色、保存、復元、既定状態。
5. **Display/Forces** — 既定値、表示式、slider境界、Restore defaults。
6. **Animate** — 開始、途中、終了、取消、再表示、再起動。

`GP0-3b-p`はこの列に戻さない。Graph再表示cameraの受入定義と停止条件を先に明文化し、利用者が再開を選んだ場合だけ独立Trackとして扱う。

## 条件付きでのみ再開する項目

| 項目 | 再開条件 | 今はしないこと |
|---|---|---|
| Contextual Tasks / Quick Capture | 7日dogfoodでcheckbox横断確認またはquick captureが上位摩擦として実測される | 専用task DB、常駐server、Google Tasks同時実装 |
| O2-P3 Classification | 匿名一時Vaultでapply/rollbackを安全に往復できる、またはDrive Path Alias sidecar契約を決める | 本番Vaultの物理move・自動apply |
| Google Drive roundtrip | O2のpath/rollback境界を満たした後、空Vault受信、local/Drive/conflict/delete、再起動台帳を確認する | 複数端末の同時apply |
| Google Intake | G1 Tasks read-only → G2 selected-file → G3 YouTube → G4 Data Portability → G5 Calendarの順。各々最小scope/preview/source ID/重複防止を閉じる | Drive全走査、広告profile、認証情報の保存 |
| ChatGPT C1-D candidate apply | rule種別ごとに高信頼review例10件以上、precision gate、privacy条件を満たす | 人物profileノートへの自動write |
| ChatGPT remote MCP | 利用者がChatGPTからの接続を明示的に必要とし、remote transportと権限境界を別契約で承認する | Codex local MCPの結果から正常動作を推定すること |
| X1-S1 read-path / host token | profileでread-pathの必要性が出る、またはhostがmodel-visible tokenを観測できる | wire bytesからのtoken・費用削減推定 |
| Installer / updater | 意図した次のreleaseを作る時 | docs-only変更への再インストール、署名工程の先行追加 |
| NotebookLM / external research | 具体的な原典利用の要件が出る | 生成回答やURLだけからの人物情報自動昇格 |

## 明確に優先キューへ入れないもの

- Hooksをproductionへ導入すること、`last_viewed`や検索行動の永続化、SQLite、BM25、Retrieval Graph、GraphRAG、vector DB。今回のshadow結果は採用ではなく停止判断である。
- X1-T1のwire 54.7%減をhost token、費用、品質の恒常改善と読み替えること。
- GP0-3b-pの自動再試行、実Explorer起動を伴う検証、camera契約を変えずに「通るまで続ける」こと。
- O3 Structured Views、O4 Canvas/Rich Media、O5以降の大きな互換範囲、Plugin APIを、現行coreの根拠なしに前倒しすること。

## 次の一手

1. P0で、現在のworking treeを次のdelivery boundaryとして分類する。
2. P1の実Windows accessibility packetを行い、未測定項目をPASS/SKIP/失敗で確定する。
3. 同時にP2の7日dogfoodを開始する。
4. P1の結果に修正がなければ、P3 Graph Filters/Searchの要件と固定参照を作る。

この順序を変えるのは、新しい実測が「日常利用を止める問題」または「データ損失・安全性の問題」を示した時だけにする。
