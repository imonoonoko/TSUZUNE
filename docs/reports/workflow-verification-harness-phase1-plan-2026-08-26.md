# Workflow Verification Harness Phase 1 Plan

日付: 2026-08-26（JST）
状態: complete / source-and-fixture verified
対象: TSUZUNE repository development workflow

## 30秒でいうと

Harness（ハーネス）は、対象を決めた入力で動かし、決めた基準で結果を検査する外枠です。

TSUZUNEには既にCodex host、AGENTS、Skills、MCP安全契約、test、production gateがあります。Phase 1ではこれらを置き換えません。選択した既存checkを一回の入口から順番に実行し、「何が通ったか」「何は未確認か」「実行中にsourceが変わっていないか」を短いJSON Receiptへまとめる **Workflow Verification Harness** だけを追加します。

```text
Task Contract
  │  task id / selected checks
  ▼
preflight snapshot
  │  repository root / HEAD / dirty hash / source fingerprint / delivery status
  ▼
existing checks (sequential, fail closed)
  │  check:current-decision / typecheck / test / check:mcp
  ▼
postflight snapshot
  │  source changed? first failure? unrun layers?
  ▼
JSON Receipt + process exit code
```

HarnessのPASSは、選択したrepository gateが通った証拠です。製品の正しさ、packaged／installed／live動作、利用者価値、token削減、料金削減を自動的には証明しません。

## Task Contract

- objective: TSUZUNE開発の開始・検証・終了境界を、既存checkの再利用だけで再現可能にする。
- deliverables: Phase 1 CLI、最小test、npm入口、機械可読Receipt契約。
- constraints: 個人1台Windows、既存dirty変更を保護、標準ライブラリと既存依存だけを使用、production Vault／installed app／TSUZUNE本文へ書き込まない。
- success:
  1. 選択したcheckのPASS／FAILと最初の失敗理由を一つのReceiptから再現できる。
  2. 実行前後のsource fingerprintが一致し、Harness自身によるsource変更が0である。
  3. PASS時もpackaged／installed／liveと未観測usageを `not_proven` として残す。
- lane: Planned。実装は1 script、1 test、1 package entryの単一slice。
- evidence: fixture test、targeted test、typecheck、実際のread-only natural task 1件。証明層はsource／fixtureまで。
- stop: success 3件を満たしたら停止。新runtime、DB、Hook、cache、製品UI、MCP surfaceへ拡張しない。

## 現行部品

新しい検証機能を再実装せず、次をそのまま呼びます。

| 既存部品 | 所有する責務 |
|---|---|
| `scripts/check-current-decision-docs.mjs` | PLANのCurrent Decision所有と文書投影 |
| `scripts/check-mcp-suite.mjs` | MCP contract、transport、delivery、stale guard |
| `scripts/source-fingerprint.mjs` | source file count／digestとdelivery status |
| `scripts/update-production.mjs` | package、install、hash、profile、MCP登録を含む本番gate |
| `scripts/measure-codex-rollout-usage.mjs` | 明示されたrollout／taskの観測済みusage再計算 |

`production:update`はPhase 1 Harnessから呼びません。これは明示された本番反映専用gateとして独立させます。usage測定scriptも自動実行せず、比較可能な自然taskと正確なrollout境界がある場合だけ別証拠として添付します。

## 代替案

| 案 | 利点 | 反証・risk | 判断 |
|---|---|---|---|
| 何もしない | 追加code 0、二重管理なし | 複数checkの実行境界、失敗、未確認を毎回手作業で束ねる | baselineとして保持 |
| 薄いCLI + Receipt | 既存checkを再利用、可逆、非破壊、失敗箇所が明示的 | Harness PASSを製品成功と誤読するrisk | **Phase 1で採用** |
| 独立Harness runtime | 自動監視や永続状態を持てる | Codex／AGENTS／Skill／MCPと責務重複。stale stateと運用面が増える | 不採用 |

## Phase 1 MVP

### 実行入口

実装済み:

```powershell
npm run check:workflow -- --task <task-id> --checks current-decision,typecheck,test,mcp
```

- `--task` は空でない識別子を必須にする。
- `--checks` は固定allowlistから1件以上を明示選択する。
- 任意command文字列やshell scriptは受け付けない。
- checkは指定順に逐次実行し、最初のFAILで停止する。
- Receiptは標準出力へJSONで返す。永続出力は実装せず、`--out`を含む未対応引数はpreflightで拒否する。

### Check allowlist

| ID | 実行対象 |
|---|---|
| `current-decision` | `npm run check:current-decision` |
| `typecheck` | `npm run typecheck` |
| `test` | `npm test` |
| `mcp` | `npm run check:mcp` |

package、installer、production update、release、Git deliveryはallowlistへ入れません。

### Receipt最小契約

```json
{
  "schema_version": 1,
  "task_id": "example",
  "status": "pass | fail | not_proven",
  "proof_layer": "source-and-fixture",
  "source_before": {
    "fileCount": 0,
    "digest": "sha256",
    "excludedPaths": ["docs/reports/production-update-latest.json"]
  },
  "source_after": {
    "fileCount": 0,
    "digest": "sha256",
    "excludedPaths": ["docs/reports/production-update-latest.json"]
  },
  "source_unchanged": true,
  "delivery_before": "match | mismatch | unknown",
  "delivery_after": "match | mismatch | unknown",
  "checks": [],
  "first_failure": null,
  "not_proven": ["packaged", "installed", "live", "user-acceptance", "token", "billing"]
}
```

timestampとelapsedは観測値として保持できますが、決定論的比較の対象から除外します。stdout／stderr全文は保存せず、command、exit code、elapsed、短い失敗要約だけを残します。

## Fail-closed境界

- repository root不一致、未知check、空task id、source snapshot失敗は実行前FAIL。
- commandの起動失敗、終了code不明、Receipt生成失敗はFAIL。
- source fingerprintが実行前後で変化した場合、checkが全PASSでもFAIL。
- delivery statusの`mismatch`はdirty sourceでは正常に起こり得るため、それ単独でFAILにしない。前後で変化した場合だけFAIL。
- 後続checkは最初のFAIL後に実行せず、`not_run`として残す。
- HarnessはTSUZUNE、production receipt、installed app、Codex config、Git indexを更新しない。
- HarnessのPASSをpackaged／installed／live／利用者確認へ昇格しない。

## 実装結果

変更artifact:

- add: `scripts/check-workflow-harness.mjs`
- add: `tests/workflow-harness.test.ts`
- modify: `package.json`へ `check:workflow` 1 entry

検証:

1. public CLI fixtureを先に追加し、runner不在のREDを確認した。
2. PASS、最初のFAILと後続`not_run`、unknown／`--out`拒否、source mutationの4 fixtureがPASSした。
3. `current-decision,typecheck,test`の受付はexit 0、source before／after同一、`not_proven`維持でPASSした。
4. 初回dogfoodとして`current-decision,mcp`を実行し、exit 0、source fileCount 1125、digest `44ed77cb5dc28430dfe7c6ccc1f1056fa9f30f06ca8f41837e7496f38e7dab16`前後一致、delivery `mismatch`前後不変、合計15569msでPASSした。
5. 独立reviewでP0／P1なし、新依存、任意command実行、profile framework、永続state、生成物残留がないことを確認した。

既存dirty worktreeは保持した。既存dirty fileと重なる`package.json`は、`check:workflow`行だけを除いたbyte列が作業前baseline SHA-256 `0088a16579a77437131714fc31a6e92b8d2417830db5c72b6949028633e4c045`と一致した。製品code、本番Vault、installed runtime、production receiptは変更していない。

## Phase 1で作らないもの

- Harness app、daemon、service、background watcher
- 独自DB、cache、index、Context Sidecar
- Codex tool callや会話本文の常時収集
- 自動token／料金推定
- model選択、Task Contract判断、TSUZUNE route判断の自動化
- TSUZUNEへの自動実施記録
- production update、release、Git commit／push
- 全taskへの一律実行

## Phase 2への昇格条件

次のすべてが成立した場合だけ再設計します。

1. 独立した自然task 2件以上で同じ証拠欠落または手作業摩擦が再発する。
2. 既存checkとPhase 1 Receiptでは原因を特定できない。
3. task successとquality gateを比較できる。
4. 一つのfailure modeだけを対象にfixture、rollback、不採用条件を事前登録できる。

その時も、最初の候補は既存`measure-codex-rollout-usage.mjs`の明示添付やReceipt項目追加です。daemon、DB、Hook、semantic retrievalへ直接進みません。

## 初心者向けの使い分け

- Harness: 決めたcheckを同じやり方で走らせ、結果を揃える。
- Test: 一つの機能や契約が壊れていないかを調べる。
- MCP: TSUZUNEのlive dataを読み書きする能力と安全境界。
- Skill／AGENTS: AIがどう作業するかの手順と規則。
- Receipt: 何を実行し、どこまで確認できたかを後から読める証拠。

つまり、Harnessは全部を代行する司令塔ではなく、既存の検査を迷子にしないための薄い実行台です。
