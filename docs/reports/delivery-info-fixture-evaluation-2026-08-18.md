# Delivery info fixture evaluation — 2026-08-18

## 結論

Delivery infoは **採用** とする。ただし、このcheckpointはread-only評価だけであり、製品code、MCP schema、tool catalog、Hook、installed runtimeは変更していない。

採用する公開事実は次の一つだけである。

```json
{"status":"match|mismatch|unknown"}
```

- `match`: 有効なworking source fingerprintと有効なlatest receipt fingerprintが一致する。
- `mismatch`: 両方が有効で、file countまたはdigestが異なる。
- `unknown`: receiptの欠落・不正・読取不能、sourceの読取不能、repositoryを確定できない場合。

これは「production updateが必要」という意味判断を返さない。

## 仮説と反証条件

仮説は、既存production receiptのsource fingerprintを再利用すれば、runtime freshnessとdelivery stateを混同せず、短いread-only応答で区別できる、というものだった。

次のいずれかなら不採用とする契約だった。

- 3 fixture群を`match`／`mismatch`／`unknown`へ決定的に分類できない。
- 応答が2 KiB以上、filesystem writeがある、またはpath／secretを返す。
- 呼出元のcwdがrepository外というだけで常に`unknown`となり、通常運用で使えない。
- 既存artifactを読むだけで同じ判断を十分小さく再現でき、新しい事実面に価値がない。

## 再利用した正本契約

latest receiptは[`production-update-latest.json`](production-update-latest.json)の`sourceFingerprint`を正本とする。生成側は[`scripts/update-production.mjs`](../../scripts/update-production.mjs)の既存処理を参照した。

- 対象: `git ls-files --cached --others --exclude-standard -z`が返すGit管理済み・未追跡・非ignoreの現存ファイル。
- 除外: receipt自身の`docs/reports/production-update-latest.json`だけ。
- fingerprint: 対象pathを英語localeでsortし、repo相対pathへ正規化して、各`path + NUL + file SHA-256 + NUL`を順にSHA-256へ投入したdigestとfile count。

この生成処理は現在`update-production.mjs`の内部関数であり、read-onlyの公開helperや専用commandはない。採用実装時は同じ処理を複製せず、production updateとDelivery infoが共有する一つの実装へ寄せる。

## Fixture結果

missingとinvalidは、同じ「receipt missing／invalid」fixture群の2変種として評価した。全ケースを同一process内で2回実行し、同一応答を確認した。

| fixture群 | 入力 | 期待 | 実測 | UTF-8 bytes |
|---|---|---:|---:|---:|
| source／receipt match | 現working source fingerprintを有効receiptとして複製 | `match` | `match` | 18 |
| source drift | 現working sourceとcanonical latest receipt | `mismatch` | `mismatch` | 21 |
| receipt missing | receiptなし | `unknown` | `unknown` | 20 |
| receipt invalid | file count／digest／除外契約が不正 | `unknown` | `unknown` | 20 |

追加確認:

- output keyは`status`一つ、値は3 enumだけ。
- path pattern検出0、secret pattern検出0。
- 2回実行の応答差0。
- 評価前後のsource fingerprint一致、`git status --porcelain=v1 -z` digest一致、recursive filesystem watcher event 0。
- fixture実行時、canonical receiptの1,043 filesに対して証拠文書追加前のworking sourceは1,044 filesで、digestも不一致だった。評価後の文書変更を含む現在値も別途read-onlyで再確認し、`mismatch`のままである。ここから更新要否は判断しない。
- canonical receipt読取と現source再計算を含む単回測定は234.2 ms。これは一回のローカル観測値であり、性能保証ではない。

## Repository境界

Codex登録は[`scripts/register-codex-mcp.ps1`](../../scripts/register-codex-mcp.ps1)がrepository rootから`out/mcp/server.js`を固定して行い、[`scripts/build-mcp.mjs`](../../scripts/build-mcp.mjs)はESMとしてbundleする。したがって採用実装はcaller cwdではなくserver module locationからTSUZUNE repositoryを解決できる。callerが別repositoryまたはrepository外にいても、それだけを理由に`unknown`へ落とす必要はない。

module locationから正しいrepositoryとreceiptを確定できない場合だけ`unknown`とする。local pathそのものは応答へ含めない。

## 採用境界と次の作業

採用対象は、`runtime_info`と分離したread-onlyのDelivery snapshotである。初回実装へinstalled executable／`app.asar`の毎回hash、更新推奨、Hook、自動writeを入れない。新しいcommon tool定義が常時contextへ加える増分は実装fixtureで測り、既存receipt読取の反復削減を上回る場合はcommon登録を止める。

ロードマップ上の次の一件は、Delivery infoの実装ではなく **Stale runtime write guardの独立fixture評価** とする。Delivery infoの実装は、この評価結果を保持したまま別の明示境界で行う。
