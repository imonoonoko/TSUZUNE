# Context / State Lineage 引継ぎ

## Reactivation Prompt

```text
C:/Users/Humin/Documents/Codex/TSUZUNE/docs/codex-handoffs/2026-09-05-context-state-lineage.md を読み、状態由来レシートの作業を継続する。
本番TSUZUNEの既存実施記録を確認し、source・installed・liveを分けて扱う。
現在source全体の導入承認はない。候補機能も自動採用しない。
次の作業は導入範囲の確定。既存変更を保持し、起動中の本番アプリを停止しない。
```

## Context

- Repository: `C:/Users/Humin/Documents/Codex/TSUZUNE`
- Branch: `main`; 照合時HEAD: `922d46858c963bbe6bf3be8b4af4b803bc113bc9`。
- 引継ぎ元: 利用者指定のタスク「意見を求める」。会話は歴史証拠として扱い、以下を現物で再確認した。
- 今回の契約: Direct / 初期実行者 CEO-01 / 正本・文脈確認を親が一体で担当。独立委譲は不要。
- 成功条件: 前回完了点を特定、現在の実装と導入境界を照合、再開可能な手順を保存。
- 今回はコード変更、本番更新、Git操作、候補機能の追加を行わない。

## 完了済み機能

- `usage_receipt`: Context候補と収録を観測し、引用・判断採用・結果検証などサーバーで観測できない事項を区別する。
- `state_lineage`: seed revision、現在State、明示source、解決済みsupersedes、競合、review_afterに基づく再確認要否を返す。
- 一般Wiki linkから根拠や判断記録を推測しない。不明はunknown、判断記録の識別はnot_observable。
- 応答内のread-only情報。新DB、event replay、Hook、ランキング学習、自動Vault書込みは含まない。

## 正本と調査対象

- 本番Vault: `30_知識/TSUZUNE-状態由来レシート実装-実施記録-2026-09-05.md`
- 関連Vault: `30_知識/TSUZUNE-Context利用レシート実装-実施記録-2026-09-05.md`
- 実装と契約: `src/core/context.ts`, `src/mcp/service.ts`, `src/mcp/server.ts`, `tests/mcp-service.test.ts`, `scripts/check-mcp.mjs`, `docs/mcp-integration.md`。
- 導入証拠: `docs/reports/production-update-latest.json`。
- 導入機構: `scripts/update-production.mjs`, `scripts/source-fingerprint.mjs`。
- repo全体のPrimaryは別のObsidian互換性Program。これを本件の実装指示と混同しない。

## 今回の確認（2026-09-05 04:24–04:26 JST）

- 対象MCP serviceを再実行: 71 tests PASS。
- `npm run typecheck`: PASS。
- `npm run check:mcp`: PASS。検査scriptは隔離bundleを使い、登録済みbundleのhash/mtime不変を確認する。
- `delivery_info`: mismatch。
- installed `resources/app.asar`のSHA-256は最新receiptと一致: `47def066d14b06f595011e6e10b86d03289fbdfc94096a489686d25d08b85ceb`。
- receiptのverifiedAt: `2026-09-04T10:53:06.739Z`; dirty sourceからの導入。集約fingerprintのみで、path別hashやexact source snapshotを含まない。
- 現行gateのsource snapshot処理も集約fingerprintを返す。これだけで本番相当sourceを逆算できない。別保管snapshotの網羅探索は未実施。
- 引継ぎ文書作成前の`git status --porcelain=v1`は203 entries。これはHEADとの差であり、本番との差分ファイル数ではない。
- 対象6ファイルのHEAD差分にも他作業の変更が混在。6ファイル全体を「今回の機能だけ」として導入しない。
- 本番TSUZUNEは起動中。process停止・再起動は行っていない。

## 過去の検証と未確認境界

- 前回実施記録: 全997 tests PASS / 1 SKIP、typecheck、MCP契約、独立review PASS。
- 今回は全suiteを再実行していない。過去の997件を現在の全suite実行結果とは扱わない。
- 本番導入、live MCPでの新レシート出力、利用者受入、Git deliveryは未実施。
- 過去のwhole-source導入承認はその当時のscopeに限定し、今回へ転用しない。

## Next Steps

1. 利用者の意図を、本番導入の準備か次機能候補の選択かに確定する。回答までは読取準備だけ。
2. 導入準備を継続する場合、最新receiptに対応する別保管source snapshot / path manifestの有無を範囲限定で調べる。存在を確認するまでは本番相当baseを認定しない。
3. exact baseがない場合は、現source全体に含まれる機能・未受入変更をreview可能な一覧にし、全体導入か保留かを利用者判断へ戻す。HEAD差分やmtimeだけで導入差分と断定しない。
4. 導入対象が承認された後、競合作業の停止と本番アプリの利用者による終了を確認し、repo文書を確定してから公式production gateを実行する。
5. gate後はpackaged/installed hash、profile不変、MCP登録、新レシートのlive出力を検証し、既存campaign実施記録へ一度だけ反映する。

## Stop / Do Not Touch

- 全体導入の認可、exactな本番相当base、または別機能の明示選択がない状態で製品変更を広げない。
- 起動中のTSUZUNEを強制終了しない。active Vaultを自動smokeに使わない。
- 既存dirty worktreeをreset/stash/上書きしない。履歴・原典を変更しない。
- Context選外理由レシート、派生知識の鮮度証明、知識パルスは候補のまま。
- 今回は既存のsource-verified / 本番未反映判断を確認しただけのため、本番Vaultへの重複実施記録は作成していない。
