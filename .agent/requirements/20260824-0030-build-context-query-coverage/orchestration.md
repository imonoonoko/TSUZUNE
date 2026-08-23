# Orchestration

## Packet 01 — semantics and RED fixtures

- Objective: 3残余課題をpublic behaviorで再現し、重複や過適合を避ける契約を固定する。
- Ownership: read-only調査と`tests/context.test.ts`。
- Do not: production code、Vault書込み、Git操作。
- Verification: 各fixtureが旧実装で期待理由によりRED。

## Packet 02 — minimal integration

- Objective: query section projectionとbudget decisionを一つの経路で修正する。
- Ownership: `src/core/context.ts`、公開説明2 file。
- Do not: 新規dependency、別module、queryless/temporal/MOC契約変更。
- Verification: Packet 01 GREEN、既存context suite PASS。

## Packet 03 — independent verification pass

- Objective: broad gates、5ケースquality、latency、production receiptを別passで確認する。
- Ownership: read-only verificationと結果artifact。
- Do not: failureを隠すtest変更、Git commit/push、production Vault中間書込み。
- Verification: Task Contractのsuccessと残余境界を数値で判定。

## Delegation exception

上位host指示が、利用者によるsubagent明示なしの委譲を禁止している。各packetを親agentの分離passとして実行し、実装と検証の証拠を混同しない。

## Integration policy

- RED fixtureに必要な最小production変更だけを採用する。
- 5ケースmarkerだけをhard-codeしない。
- 文字数上限、安全な時点投影、MOC契約を優先する。
- final boundaryでのみproduction TSUZUNEへ書き戻す。
