# Stale runtime write guard implementation — 2026-08-18

## 結論

既存`runtime_info`のmtime／package version判定を共通helperへ抽出し、MCPの公開mutation 8ツールだけを呼出し直前にfail-closed化した。tool schema、依存関係、cache、DB、Hook、通常UI／IPCの書込み経路は変更していない。

対象は`create_directory`、`create_note`、`update_note`、`autonomous_update_note`、`patch_note`、`move_entry`、`apply_drive_sync`、direct-only `add_link`である。stale時は`STALE_RUNTIME_WRITE_BLOCKED`、build freshnessを確認できない時は`RUNTIME_FRESHNESS_UNAVAILABLE`を返す。package.jsonが存在しない場合は従来どおりembedded versionを正本としてmtimeだけで判定する。

## TDD evidence

実sourceを一時bundleへbuildし、匿名の一時Vault／settings／review store／fake Drive bridgeだけを使う公開stdio MCP fixtureへ、test-only guard注入をせずに切り替えた。

- RED: stale化後の`create_directory`が拒否されず、`create_directory was not rejected`で失敗。
- GREEN: stale mutation 8/8拒否、fresh mutation 8/8許可。
- stale中もread／preflight 8/8継続。
- stale read／write後にVault、settings、review store、bridge stateが不変。
- stale中のDrive apply／move bridge callは0/0。
- mtimeはprocess startより前／同値でfresh、+1msでstale。
- package mismatchはstale、package欠落は`package_version: null`かつmtime判定を維持。
- bundle stat不能時もreadは継続し、代表mutationは`RUNTIME_FRESHNESS_UNAVAILABLE`で拒否。

fixtureは[`scripts/evaluate-stale-runtime-write-guard.mjs`](../../scripts/evaluate-stale-runtime-write-guard.mjs)を正本とし、`npm run check:mcp`へ接続した。

## Source gates

- `npm run typecheck`: PASS。
- `npm test`: 75 files PASS／1 SKIP、765 tests PASS／1 SKIP。
- `npm run check:mcp`: PASS。Codex／Freebuff共通15 tools、direct 17 tools、read 9／write 8、Freebuff definition 24,819 characters。
- guard fixture: 独立した2回の実source runと公式`check:mcp`内runがすべてPASS。
- `ponytail-review`: `Lean already. Ship.`。共通helper 1個と各handler先頭のguard以外の抽象化を追加していない。

## 本番境界

インストール済み本番と検証sourceの正確な同一性は、[`production-update-latest.json`](production-update-latest.json)だけを正本とする。文書内へ可変hashを複製しない。

## 残る境界

- freshness確認直後からmutation開始までの極小TOCTOUは残る。各公開mutationの直前に毎回再確認し、cacheしないことで範囲を限定する。lockや常駐監視は別要件が生じるまで追加しない。
- `RUNTIME_FRESHNESS_UNAVAILABLE`の公開transport試験は`create_note`を代表にしている。8 handlerすべてが同じhelperを最初にawaitすることはsource監査で確認した。
- Codex Desktopの現在プロセスはMCP bundle更新後に旧runtimeとなる。再登録後の新規接続で`runtime_info.stale_runtime: false`を確認するまで、旧接続を本番write受入の証拠にしない。
