# Orchestration

## V1 — 動画分析

- Objective: 動画のノート整理原則、具体的な運用、前提条件、TSUZUNEへ移植する際の注意を抽出する。
- Source: https://www.youtube.com/watch?v=PGPMocgdIiA
- Ownership: 読取と分析のみ。
- Do not: Vaultまたはrepositoryを変更しない。
- Expected output: 根拠付きの原則一覧と採用/非採用候補。

## T1 — 過去タスク分析

- Objective: `codex://threads/01a053d2-9e0a-7243-b1e3-89b339e9438a` の関連判断と未完了事項を抽出する。
- Ownership: タスク履歴の読取と分析のみ。
- Do not: 履歴を現行仕様として無検証で採用しない。
- Expected output: 現在へ持ち込める判断、再確認事項、却下・保留事項。

## W1 — Vault構造監査

- Objective: 本番TSUZUNEの実際のフォルダ、ノート数、入口/MOC、孤立・過密の傾向を狭く確認する。
- Ownership: `mcp__tsuzune` のread-only操作のみ。
- Do not: 作成、更新、移動、削除を行わない。`50_履歴`の内容を読まない。
- Expected output: 件数表、現行導線、整理上の摩擦、未知の境界。

## I1 — 統合

親AgentがV1/T1/W1を比較し、採用・不採用理由、目標構造、分類フロー、移行段階、停止条件を一つの案へ統合する。

## R2 — 動画方式への再設計

- Objective: 全件分類中心の初期案を、捕捉から必要文脈取得までの文脈エンジン型へ改める。
- Evidence tracks:
  - `video_fidelity_v2`: 動画必須要件と516件全件意味分類への反証。
  - `inbox_lifecycle_scout`: 現行UI/MCPのmove・rename・trash境界と、履歴なし受信箱処理の実現可能性。
  - `vault_design_critic`: 根幹思想とPonytail観点の最小化、到達性を成功指標にする提案。
- Parent adoption:
  - 全件の機械的link監査は採用。
  - 全件意味分類、全件書換え、新規Context/MyContext/Processed/Archive/Historyは不採用。
  - 受信箱ノートそのものを単一moveで正本位置へ移し、Rawの時だけ派生ノートを作る方式を採用。
- Verification: `plan.md`、`final-report.md`、`state.json` の整合と文書差分検査。
- Remaining boundary: 本番Vaultのupdate/move/createは未承認・未実施。

## D1 — 人間中心UX批判

- Objective: 分類を考えず受信箱へ投げる人間の体験を最優先に、公開挙動と失敗時UXを定義する。
- Ownership: read-only。product docs、capture UI、既存template／commandを確認する。
- Do not: code編集、Vault操作、AI常駐前提、画面を増やす前提。
- Expected: 最小user journey、acceptance、曖昧入力、停止条件。

## D2 — 現行実装経路

- Objective: capture、Inbox、MCP create/fetch/move、UI move、testsを端から端まで追い、最小変更点を示す。
- Ownership: read-only code scout。
- Do not: code編集、本番操作、設計の独断。
- Expected: public API、呼出経路、既存再利用点、対象test、候補file。

## D3 — Adversarial safety review

- Objective: 誤分類、Raw消失、重複、link破損、競合、prompt injection、機微情報の観点から設計を攻撃する。
- Ownership: read-only。
- Do not: 脅威を理由に要求を無効化する、過剰な基盤を提案する。
- Expected: blocking risk、必要guard、test cases、許容できる残余risk。

## D4 — Ponytail最小形比較

- Objective: no-code運用、read-only proposal tool、UI sliceを比較し、既存機能で成立する最小実装を選ぶ。
- Ownership: read-only architecture critique。
- Do not: 新DB、LLM内蔵、rule engine、Hook、background daemon、dependency追加。
- Expected: strongest counterargument、最小案、実装が必要になる観測差。

## D5 — TDD implementation

D1〜D4統合後、親Agentが公開挙動を一件選ぶ。testを先に失敗させ、最小実装を行う。書込み所有fileは選定後にpacketへ確定する。

## D6 — Independent verification

実装担当と分離したreviewで、visible test以外の未提示境界を確認する。親Agentがtypecheck、関連test、MCP gate、必要ならproduction updateを統合する。

## D1〜D4 integration result

- D1 UX: 既存自由入力は保存先が選択状態依存。受信箱固定actionが分類割込みを除く最小差分。
- D2 code path: create/read/move/readbackと安全guardは既存実装で成立。新しい分類API、batch、review UIは未実装だがfirst sliceには不要。
- D3 adversarial: 受信箱本文は非信頼データ。曖昧なら残し、承認前zero-write、適用時fingerprint、collision/protected path/rollback/readbackを必須とする。これらは既存move経路が担う。
- D4 minimum: no-code案はcapture先を保証できず、proposal tool案は既存AI判断の重複。Command Palette action一件を採用。
- Parent decision: `src/renderer/App.tsx` と公開挙動testだけをD5の所有範囲とし、新MCP tool、UI画面、DB、daemon、rule engine、Hook、依存追加を拒否した。

## D5〜D6 result

- D5 implementation: `src/renderer/App.tsx` に既存command実行経路を再利用した `inbox-note` actionを追加し、`tests/app.safety.test.tsx` に公開挙動testを追加。RED 1件を確認後、GREEN 98/98。
- D6 independent review: 固定保存先、collision-safe naming、既存directory作成、create/readback/editor表示、新しいstate・shortcut・MCP・依存・履歴生成がないことを確認しPASS。
- Parent verification: `npm run typecheck`、全test、`npm run check:mcp`、選択差分の`git diff --check`をPASS。
- Delivery boundary: sourceは実装済み。本番deliveryは作業前からmismatchで、working treeに本件外の変更が多数あるため `production:update` は実行していない。本番Vaultも変更していない。

## D7 — Original philosophy guardian

- Objective: `人間優先 / 知識循環 / 構造探索 / 探索は大胆に、書込みは慎重に` を設計人格として保持し、Inbox機能の次sliceを反証する。
- Sources: canonical philosophy、`PRODUCT.md`、`PLAN.md`、今回のworkflow artifacts。
- Ownership: read-only product critique。
- Do: 現スライスが原思想を満たす点・逸脱する点、次に作るべきでないもの、必要なら最小の次slice、停止条件を返す。
- Do not: 便利機能の数を目的にする、全Vault ingestion、自動分類、Graph外観、link数、専用DB、Hookを前提にする。本番TSUZUNEへ書かない。
- Verification: 主張を正本原則または現行sourceへ紐づける。

## D8 — Production delivery boundary

- Objective: task-owned差分だけをinstalled productionへ安全に反映できるか、current dirty treeとproduction gateの実経路から判定する。
- Ownership: read-only repository and delivery inspection。
- Do: source/receipt status、本件外変更、isolation可能性、最小可逆案、明示承認が必要な操作を示す。
- Do not: build/install/update、process停止、stash/reset/checkout、file編集、production Vault操作。
- Verification: exact paths、commands、observed statusを示す。

## D9 — Capture friction scout

- Objective: 現在のUIとtestから、Command Palette actionの次に実在する人間の摩擦があるかを確認する。
- Ownership: read-only UX/code/test inspection。
- Do: first captureまでの操作、発見可能性、keyboard/focus/error、既存UI再利用を比較し、実装不要も有効結論にする。
- Do not: 新画面、shortcut、tray、background capture、AI自動整理を要求として発明しない。
- Verification: concrete call path and existing tests。

## D10 — Parent integration

親AgentがD7〜D9を統合し、原思想を優先して `stop / source-only next slice / approval-required production delivery` のいずれかを選ぶ。実装を選んだ時だけTDD workerと独立verifierを追加する。

## D7〜D10 result

- D7 original philosophy guardian: 現実装は原思想に一致。capture摩擦が実利用で独立2件以上観測されるまで追加コードを止める。全Vault分類、自動リンク、自動昇格、Processed／Archive／History、organizer MCP／DB／queue／daemon／Hookを拒否。
- D8 delivery boundary: `production:update`はtask-owned deltaだけを選択せず、current tracked/untracked source全体をfingerprint・build・package・installする。current deliveryはmismatchであり、production mutationは明示承認が必要。
- D9 capture friction: Command Paletteの既存keyboard／focus経路と固定Inbox actionで3段階captureが成立。追加shortcut・専用画面の観測根拠なし。
- D10 parent decision: 追加source featureは不採用。旧History前提の`PLAN.md`記述だけをno-history契約へ修正。本番installとVault mutationは行わず、利用者判断へ戻す。

## D11 — Task-owned isolation check

- Objective: Inbox capture差分がGit基準へ独立適用できるか、またはcurrent dirty変更への依存があるかをread-onlyで判定する。
- Sources: `git show HEAD:*`、working treeの`src/renderer/App.tsx`、`tests/app.safety.test.tsx`、関連helper／component／docs。
- Ownership: read-only diff and dependency closure。
- Do: HEADに必要なpublic action/helper/test seamがあるか、最小dependency closure、clean patchの成立可否、検証commandを示す。
- Do not: branch/worktree/commit/stash/reset/checkout、file編集、build/install、Vault操作。
- Verification: exact symbols and paths。独立不能も有効結論。

## D11 result

- Git基準には既に`ensureDirectory`、`availableNoteName`、`createAndOpenNote`、`createNoteInDirectory`、Command Palette型／dispatch、create IPCがある。
- runtime dependency closureは`src/renderer/App.tsx`のcommand定義／dispatch 2ハンクと、`tests/app.safety.test.tsx`のcommand label／公開挙動test 2ハンクだけ。
- file全体には別作業差分が混在するため、file単位のcopyやrestoreは不可。clean境界では4ハンクだけを抽出する。
- 追加反証: 直近receiptはdirty source全体をinstallしているが、path/hash manifestまたはexact source snapshotを保存していない。Git HEAD＋4ハンクをinstallすると、既に本番へ入った未commit機能を巻き戻す可能性がある。
- 改訂判断: 4ハンク分離は機能の独立検証にだけ使える。productionへ進むには、current source全体の昇格を利用者が明示承認するか、receipt相当sourceの広範な再構成・監査を別scopeで行う必要がある。branch/worktree/installは未実施。

## D12-D16 — AI文脈エンジン四層設計

利用者は、動画とゲームブックから抽出した方式をTSUZUNEへ実装する対象として、MCP、Hooks、スケジュール、TSUZUNEの四層を明示選択した。これにより、旧HeldのAI自動整理・Hook・定期実行は再開条件成立とする。今回の設計phaseでは利用者の明示に従いPonytailを使用しない。

- D12: current MCPの再利用境界と安全な自動適用契約。
- D13: capture／Vault変更／適用完了を結ぶfact-only Hook契約。
- D14: AI実行hostを含む日次・週次schedule契約。
- D15: 履歴なしのInbox lifecycle、Markdown正本、AI入口、例外提示。
- D16: 親Agentが四層を一つのend-to-end設計、failure matrix、実装sliceへ統合する。

Formal packet: `packets/D12-D15-four-layer-design.md`

Design phase boundary: product code、本番install、実schedule、本番Vaultの整理実行は行わない。正本判断が変わるため、検証済み最終境界でrepository計画と本番TSUZUNEの関連ノートだけを各1回同期する。

## D12-D17 result

- D12 MCP: v1は既存toolだけで成立。意味判断APIとbatch mutationは追加しない。通常noteから通常領域へのmoveが既に可能であることをsource/testで確認し、Vaultの古い説明を訂正した。
- D13 Hooks: 現行watcherは`ignoreInitial: true`でrenderer通知のみ。Slice Dでtyped internal fact sinkを追加し、watcher、capture readback、MCP move readbackへ接続する。HookはAIを起動しない。
- D14 schedule: Codex heartbeatを外部AI／schedule ownerに選択。daily 04:00 JST、Sunday bounded read-only audit、一run最大10件。sleep、closed app、overlapはwrite enable前の実host gateへ残した。
- D15 TSUZUNE: Inboxはfieldなしを通常状態とし、成功履歴を持たない。safe moveはdestination pathが現在状態、例外だけ固定reason codeを元noteへ持つ。
- D16 adversarial: initial `REVISE`。runtime再確認、Hook接続点、Raw境界、contentRevision、fetch前除外、non-atomic inventory、weekly scope、schedule host gateの8点を統合設計へ反映後PASS。
- D17 philosophy guard: PASS。current-only leaseは一時排他で履歴ではない。clear／uncertain Raw fixtureと固定reason codeを追加した。
- Parent integration: `context-engine-v4.md`を統合正本とし、product実装より先にSlice A manual shadowを選択した。
- TSUZUNE persistence: `30_知識/TSUZUNE-AI文脈エンジン統合設計-2026-08-31.md`を一件作成し、7本の既存正本からbacklinkを確認。実施記録、履歴、Inbox mutationは作成していない。
