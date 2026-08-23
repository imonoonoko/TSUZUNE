# Stale runtime write guard fixture evaluation — 2026-08-18

## 結論

Stale runtime write guardは **採用** とする。ただし、このcheckpointは独立fixtureで候補契約を評価しただけであり、製品MCPへのguard実装、tool schema変更、Codex Hook、installed runtime更新は行っていない。

採用する契約は次のとおり。

- 現行`runtime_info`と同じbuild mtime／package version判定を一つの共通helperから使う。
- staleまたはfreshness判定不能なら、公開MCP mutationをservice／Drive bridge呼出しより前に拒否する。
- readとpreflightは継続する。
- 判定は各mutation開始直前に行い、長時間processで後からbuildが変わった場合も検出する。process開始時の一回だけをcacheしない。
- guard対象は6系統ではなく、`create_directory`とdirect-onlyの`add_link`を含む8ツールとする。

現行製品にはこのguardがない。採用と実装済みを混同しない。

## 現行runtimeとmutation surface

現行[`runtimeInfo()`](../../src/mcp/server.ts)は、bundleのmtimeがprocess開始時刻より新しい、またはbundleへ埋め込んだversionと隣接`package.json`のversionが異なる時に`stale_runtime: true`を返す。現在はread-only診断値であり、各mutation handlerは直接serviceまたはDrive bridgeを呼ぶ。

fixtureと実装gateで対象にする公開mutationは次の8件。

| profile | tool | 最初に到達しうる副作用 |
|---|---|---|
| common | `create_directory` | Vault folder作成 |
| common | `create_note` | noteまたはreview proposal作成 |
| common | `update_note` | noteまたはreview proposal更新 |
| common | `autonomous_update_note` | AI履歴作成後のnote更新 |
| common | `patch_note` | AI履歴作成後のnote更新 |
| common | `move_entry` | app bridge経由のmove／履歴 |
| common | `apply_drive_sync` | app bridge経由のlocal／Drive mutation |
| direct-only | `add_link` | source noteとAI監査履歴の更新 |

`create_directory`は`destructiveHint: false`でもfilesystem mutationである。分類はannotationではなく実経路で決める。`preview_drive_sync`と`preflight_move_entry`はread/preflightとしてguard対象外にする。

## 独立fixture

[`evaluate-stale-runtime-write-guard.mjs`](../../scripts/evaluate-stale-runtime-write-guard.mjs)は、現working sourceを一時bundleへbuildし、候補guardだけをtest-onlyで注入する。匿名の一時Vault、一時settings、一時package、loopback fake Drive bridgeを使い、終了時に一時rootを削除する。repositoryの`out/mcp/server.js`、production Vault、production profile、installed appは読取も変更もしていない。

候補guardは、Vault mutation 6 methodとDrive mutation 2 methodの直前に、現行`runtimeInfo()`の判定を置いた。これは候補の挙動を評価するための注入であり、本番実装方式の正本ではない。本番実装時はstale計算を共通helperへ分離し、8 handlerへ同じ薄いwrapperを適用する。

各runは次を同一processで行う。

1. freshでread／preflightをwarm upする。
2. bundle mtimeをprocess開始後へ進め、`stale_runtime: true`を確認する。
3. staleのままread／preflight 8経路を通す。
4. 8 mutationを全件呼び、共通errorで開始前拒否されることを確認する。
5. stale read前、read後、mutation後のVault entry集合、size、mtime、file SHA-256を比較する。
6. mtime境界、同一processでの反復、package mismatch／missing、bundle読取不能を確認する。
7. freshへ戻し、local 6件とfake bridge 2件の全mutationがguardを通過できることを確認する。

## 結果

最終契約で2回連続実行し、status／件数／真偽値は一致した。時間値だけを同値条件から除外した。

| 観測 | run 1 | run 2 | 判定 |
|---|---:|---:|---|
| stale検出 | PASS | PASS | PASS |
| stale中のread／preflight | 8/8 | 8/8 | PASS |
| stale中のmutation開始前拒否 | 8/8 | 8/8 | PASS |
| stale read後のVault snapshot | unchanged | unchanged | PASS |
| stale mutation後のVault snapshot | unchanged | unchanged | PASS |
| stale中のDrive apply／move bridge call | 0／0 | 0／0 | PASS |
| fresh中のmutation到達 | 8/8 | 8/8 | PASS |
| tool schema増分 | 0 bytes | 0 bytes | PASS |
| `runtime_info` 20 warm calls中央値 | 0.697 ms | 0.631 ms | 参考値 |
| `runtime_info` 20 warm calls最大 | 1.054 ms | 1.090 ms | 参考値 |

latencyは同一PC・一時Vaultの小標本であり、本番性能保証ではない。候補guardは新しいtool、schema、常時payloadを追加しないため、通常のhost context増分は0である。fresh mutationごとにlocal stat／package read相当は増えるが、fixtureの`runtime_info` proxy観測では1.1 ms未満だった。

### 時刻と判定不能の境界

| 条件 | 実測 |
|---|---|
| build mtime `<` process start | fresh |
| build mtime `==` process start | fresh |
| build mtime `+1 ms` | stale |
| 同じprocessでold buildを反復確認 | fresh |
| embedded／package version不一致 | stale |
| package missing | `package_version: null`、mtimeがoldならfresh |
| running bundleを一時的に読取不能 | read継続、writeは`RUNTIME_FRESHNESS_UNAVAILABLE`で拒否、Vault不変 |

package missingをembedded version authoritativeとして扱うのは現行`runtimeInfo()`の既存契約であり、今回変更しない。bundle stat失敗は同じbooleanへ丸めず、mutation側だけ明示的な判定不能errorとしてfail-closedにする。

`+1 ms`をstaleとするため、OS clockをbuild後・process開始前に後退させた場合は保守的なfalse staleになりうる。現在のWindows filesystemで`<`／`==`境界と同一process反復による通常false staleは再現しなかった。実OS clock変更は行っていない。

## 本番実装契約

実装する場合は、次の最小形に限定する。

1. build mtime／package versionを読む既存式を一つの`runtimeFreshness` helperへ抽出する。
2. `runtime_info`とmutation guardが同じhelperを呼ぶ。
3. `assertFreshRuntime`は`stale`を`STALE_RUNTIME_WRITE_BLOCKED`、stat等の判定不能を`RUNTIME_FRESHNESS_UNAVAILABLE`で拒否する。
4. 8 handlerすべてで、Vault service／review proposal／AI履歴／Drive bridgeより前に毎回実行する。
5. read、`preview_drive_sync`、`preflight_move_entry`には適用しない。
6. 新規tool、DB、cache、Hook、background serviceは追加しない。

MCPのserver入口で閉じる安全境界であり、TSUZUNE本体の通常UI／IPC mutationを止める機能ではない。Codex Lifecycle Hookとも別責務である。

## 次のgate

次の明示作業は **採用済みguardの製品実装** とする。実装時はfixtureからtest-only注入を外して実sourceを検査し、少なくとも次を満たしてから本番更新へ進む。

- stale read／preflight 8/8継続。
- stale mutation 8/8開始前拒否、Vault／history／review store／bridge call不変。
- fresh mutation 8/8回帰なし。
- mtime `<`／`==`／`+1 ms`、package mismatch、bundle判定不能の固定。
- `npm run typecheck`、対象test、`npm run check:mcp`。
- その後にだけ`npm run production:update`と再起動後live受入。

Delivery info、Hooks、P0-4/R4はこの実装へ同梱しない。
