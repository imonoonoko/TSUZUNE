# MCP Read-only Zero-write Acceptance — 2026-08-26

## 結論

Executable Policy Pilot 1で分離したcreation-time sidecar境界を、独立した製品sliceとして閉じた。MCPの宣言済みread-only tool 10件は、Vaultがcoldでも、`.tsuzune/graph-file-times.json`がmalformedまたはnoncanonicalでも、Vaultと隔離profileへ書き込まない。通常のUI scanとwrite経路は従来どおりcreation-time sidecarを作成・repairする。

新しいruntime、daemon、DB、cache、Hook、外部依存は追加していない。

## Task Contract

- objective: MCP read-only操作をcreation-time sidecarの状態にかかわらずliteralな無書込みにする。
- deliverables: 製品コード、失敗を固定するtest、Harnessの除外撤去、正本更新、本番受入。
- constraints: 通常scan／writeのrepairを維持する。dirty worktreeの所有外変更を保持する。`50_履歴`を編集しない。
- success:
  1. cold Vaultでread-only呼出し後も`.tsuzune`を作らない。
  2. malformed／noncanonical sidecarのbytesとmtimeを変えない。
  3. 通常scanのrepair、全test、MCP Harness、production gateを維持する。
- lane: Planned。
- stop: 新runtime、外部依存、write意味論の変更が必要なら再契約する。

## 実装境界

- `VaultService.scan`へ既定値`true`の`persistCreationTimes` optionを追加した。既定経路は既存の`updateCreationTimes`を使い、MCP read-only経路だけ`readCreationTimes`で読み取る。
- MCP serviceのread-only snapshot呼出し6経路（`search`、`list_directory`、`fetch`、`get_backlinks`、`suggest_links`、`build_context`）だけ`persistCreationTimes: false`を指定した。
- write toolが使う7 snapshot呼出しと通常UI scanは既定値を維持し、作成・repair責務を変えていない。
- MCP Harnessは`.tsuzune`除外を削除し、Vault rootと隔離profileを丸ごと検査する。宣言集合と実行集合の完全coverageも維持する。

## Fail-first evidence

1. cold search testは実装前に`.tsuzune`が作られてFAILし、read-only searchの非永続化後にPASSした。
2. malformed fetch testは実装前に入力bytesがcanonical JSONへrepairされてFAILし、read-only fetchの非永続化後にPASSした。
3. Harnessから`.tsuzune`除外を外し、`suggest_links`を最初のwriteより前へ移した状態では`read-only MCP tool suggest_links mutated scope: vault`でFAILし、read-only 6経路の統一後にPASSした。

## Verification

- targeted: `tests/mcp-service.test.ts`、`tests/vault.creation-times.test.ts`、`tests/mcp-readonly-integrity.test.ts` — 67 PASS。
- full suite: 80 files PASS／1 SKIP、838 tests PASS／1 SKIP（839 total）。
- `npm run typecheck` — PASS。
- `npm run check:mcp` — PASS。read-only 10 tool／write 8 tool、除外なしのVault／profile integrity、完全coverageを確認。
- `git diff --check` — error 0（既存のLF→CRLF warningのみ）。
- 独立review — 重大度P0〜P2の指摘なし。Ponytail reviewは`Lean already.`。

本番のstatus、checks、source fingerprint、packaged／installed hash、profile不変性、MCP再登録は、更新時点の[`production-update-latest.json`](production-update-latest.json)だけを正本とする。この文書へ可変値を複製しない。

## Residual boundary

- 個別のmalformed fixtureは`fetch`、cold fixtureは`search`を代表経路にしている。6経路は同じ明示的なsnapshot optionを共有し、Harnessが公開read-only tool 10件を除外なしで覆う。
- 同一bytes・size・mtimeへ瞬時に復元する病的な外部mutationはtree snapshot方式では観測できない。
- installed processを現在のCodex taskが既に保持している場合、そのprocessのlive同一性は再起動後の`runtime_info`で別途確認する。

## 関連証拠

- [Executable Policy Pilot 1](executable-policy-pilot-1-2026-08-26.md)
- [Workflow Verification Harness Phase 1](workflow-verification-harness-phase1-plan-2026-08-26.md)
- [Creation-time Sidecar No-op](x1-s1a-creation-time-sidecar-noop-2026-08-11.md)
