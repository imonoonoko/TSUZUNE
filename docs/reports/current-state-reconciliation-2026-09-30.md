# 本番証拠と現在地の整合 — 2026-09-30

確認日: 2026-09-30（JST）。文書と証拠の整合のみ。製品コード、本体、MCP登録、automation、既存の本番受領書は変更していない。

## 結論

- インストール済みTSUZUNEは0.6.0。9月24日のproduction gate完了は保存済みログ・結果・Vault実施記録で確認できる。
- その更新元`work/tsuzune-release`と受領書は、記録されたパスに現存しない。現在のEXE／`app.asar`はrepoに残る9月21日受領書と異なる。9月24日の受領書との一致、現在のcheckoutとinstalledの一致は**unknown**。
- live Codex MCPは`stale_runtime:false`、`delivery_info:unknown`。保存済みMCP runtimeに接続しており、freshnessと本番同一性は別の判断。
- A6 Bases候補一覧は9月9日の実施記録で本番反映・隔離installed受入・fresh MCP・最終同期まで完了していた。PLANのNextから外し、完了履歴へ反映した。実OS日本語IMEと本人の操作確認はこの自動受入の証明範囲に含めない。
- 日次整理はCodex側ACTIVE。OpenClaw側だけ停止したことは9月30日実施記録のGateway read-backが根拠。今回Gatewayの再照会や設定変更は行っていない。同日の手動整理は対象7件処理・保留0件という実施記録を参照した。

## 現在の観測と証拠

機械可読の観測値とexact hashは[照合JSON](current-state-reconciliation-2026-09-30.json)に保存した。これは新しいproduction receiptではない。

| 証拠 | 確認できること | 証明しないこと |
|---|---|---|
| [既存production receipt](production-update-latest.json)、verifiedAt 2026-09-21T11:33:34.449Z | 9月21日の更新時点の受入 | 9月24日以降の現在binaryとの一致 |
| 9月24日`work/tsuzune-production-update.log` | 最終`productionUpdate:verified`、受領書出力先、各gateの完了ログ | 現在のinstalled exact hash、失われた受領書の内容 |
| 9月24日`outputs/検証結果.json` | 当時のcore promotion PASS、1279 PASS／1 SKIP、profile 276 files不変という保存済み結果 | 現在profile不変、現在の本番受入の再実行 |
| 9月24日`work/promoted-mcp-verification.json` | 当時のfresh MCP、keyed trash schema、quoted ID取得、write 0の確認 | 現在のCodex接続との同一性 |
| 9月24日`review-residuals/tsuzune-release-final-sha256.json` | 再構成時のbase／final fingerprintとtask-owned pathの証拠 | 全sourceの現存、現在installedからのsource復元完了 |
| 今回のinstalled hash取得・live MCP照会 | 現在のファイルと接続の観測値 | 本体の操作受入、全体のsource／installed一致 |

9月24日証拠の共通rootは`C:/Users/Humin/Documents/Codex/2026-09-24/codex-threads-01a0cf0c-61ca-7962-9194-2`。記録されたrelease rootとreceiptの不存在、およびこのtask root内のMarkdown／JSONから現在hashを含む受領書コピーが見つからないことを確認した。別媒体や未探索の場所に存在しないとは主張しない。

Codex登録先は`work/mcp-runtime-prod-0.6.0-c1b8aac2/out/mcp/server.js`。この保存済みruntime rootにはGit checkoutとreceiptがなく、sourceとreceiptを比較する既存`delivery_info`の条件を満たさない。これがunknownとなる経路の説明であり、runtimeの機能不良という判定ではない。main checkoutのread-only source／9月21日receipt照合はmismatchだったが、これは9月24日installedとの差分を特定しない。

## 変更と検証

- [PLAN](../../PLAN.md): A6を完了へ移し、現在のNextを未選択とした。9月12日・21日の作業指示は日付付き履歴へ移した。Primaryの「日常の知識再利用」は維持。
- [Project Status](../../PROJECT_STATUS.md)と[Documentation Index](../INDEX.md): 現在観測への入口、当時の受入と現在照合の違いを明示。
- Vault: 一件の実施記録と、project・現在地地図・roadmap・運用標準・資料入口の関連箇所を同期する。原資料の開発資料台帳と過去campaignは日付付き証拠として保持する。
- `npm run check:current-decision` PASS、変更Markdown 4件のlocalリンク切れ0、`git diff --check` PASS、対象外の既存dirtyファイル27件のhash不変を確認した。最初のworkflow wrapper呼出しは必須task ID不足でpreflight拒否となったため、管理artifactを増やさず対応する既存検査を直接実行した。製品変更がないためfull regression・production update・installed smokeは今回実施しない。文書検証を本番動作や本人受入へ読み替えない。

## 再開境界

今回の資料整合は完了。今後の本番更新は、9月24日receiptとproduction-equivalent sourceを復元して監査するか、現在の作業ツリー全体をpromoteする本人の明示選択が必要。task-owned hunkや部分manifestだけを本番baseとしない。新しい製品変更・再インストール・Git公開は今回選択していない。

Vault正本: `30_知識/TSUZUNE-本番証拠と現在地整合-2026-09-30.md`。先行証拠はA6受入（9月9日）、OpenClaw読取運用（9月24日）、全面監査・修復（9月28日、9月30日停止追記）、受信箱整理・全文再確認（9月30日）の各実施記録。
