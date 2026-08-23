# Drive同期 実測・高速化レポート（2026-08-16）

## 結論

Google Drive同期の安全境界を維持したまま、次の2点を採用した。

1. Changes差分合成を `fileId -> path` のMap索引へ変更し、1,140ファイル・1,000変更のローカル差分走査を p50 19.139 ms から 7.905 ms へ短縮した（58.70%）。
2. 既存ノート更新を最大4件の限定並列にし、実Driveの10件更新を apply p50 8,778.630 ms から 6,852.691 ms へ短縮した（21.94%）。

最終実Drive試験は errors 0 で、同期機能・競合保全・削除非伝播・再起動収束・本番Vault非接触・測定rootのtrash完了をすべて通過した。

## 測定条件

- OS: Windows
- installed TSUZUNE: 0.5.0
- repository commit: `5a9443d93840bb970ae34ea76a618bef1f1fce6c`（dirty worktreeを正規gateで昇格）
- ローカル差分走査: synthetic 1,140 Markdown、removed change 1,000件、warm-up 3回、計測15回
- 実Drive: 隔離した一時Vault 2個と一時profile 2個を使用。本番Vaultは開かない
- 実Drive性能区間: 既存Markdown 10件を更新、5ラウンド
- percentile: サンプルを昇順にし `floor(n * percentile)` の要素を採用

## 実測結果

### Changes差分合成

| 指標 | 旧 O(changes x remote) | Map O(changes + remote) | 改善率 |
|---|---:|---:|---:|
| p50 | 19.139 ms | 7.905 ms | 58.70% |
| p95 / max | 23.561 ms | 10.958 ms | 53.49% |
| min | 14.130 ms | 6.533 ms | 53.77% |

最終コマンド:

```powershell
$env:TSUZUNE_DRIVE_BENCHMARK='1'
npx vitest run tests/drive-sync-service.test.ts -t "measures incremental change merging" --maxWorkers=1 --reporter=verbose
```

### 実Google Drive・既存10件更新

| 区間 | 旧2並列 p50 | 最終4並列 p50 | 改善率 | 旧 p95 | 最終 p95 | p95改善率 |
|---|---:|---:|---:|---:|---:|---:|
| preview | 3,202.222 ms | 2,660.655 ms | 16.91% | 4,366.013 ms | 3,366.088 ms | 22.90% |
| apply | 8,778.630 ms | 6,852.691 ms | 21.94% | 10,095.394 ms | 7,221.950 ms | 28.46% |

最終apply samples: `7221.950, 6988.691, 5724.872, 6615.176, 6852.691 ms`

最終preview samples: `3366.088, 2717.722, 2660.655, 2457.904, 2482.515 ms`

直前の安全版2並列 p50 10,598.256 ms と比べると、4並列は35.34%短縮した。ただし採否の主比較は、修正前の実Drive基準値 8,778.630 ms とした。

## 採用した変更

- incremental Changesの各変更ごとに全remote fileを走査せず、`Map<fileId, path>`を一度構築して差分を合成する。
- 現在位置から連続する既存remote更新だけを最大4件ずつ `Promise.allSettled` で処理する。成功分は1件ずつ台帳へcheckpointし、同一batchに失敗があれば成功分を保全した後で停止する。
- previewとapplyの既存remote操作前にfull metadata refreshを行い、Changesの反映遅延だけに依存しない。
- Drive `version` 単独では同期fingerprintを変えない。更新直前にfile ID、Vault ID、pathを再確認し、版だけ変わった場合は `md5Checksum` 一致を高速経路にする。MD5が欠落または不一致なら本文を取得し、既存SHA-256と照合する。内容が変わっていれば従来どおり拒否する。
- 実Drive cleanupはElectron app directoryを起動対象にし、`--no-error-dialogs`、非表示起動、stderr捕捉を使用する。cleanup失敗を握り潰さず、測定rootのtrash成功後にだけ `result: pass` を出す。

Drive APIの `version` はユーザーに見えないサーバー変更でも増加し得る。一方、`md5Checksum` はバイナリ内容のMD5であるため、版番号そのものではなく内容一致を確認する設計にした。参照: [Google Drive API File resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files?hl=en)

## 安全受入

最終実Drive run:

- `result: pass`
- empty Vault receive: PASS
- local upload: PASS
- remote download: PASS
- conflict copy preservation: PASS
- local deletion non-propagation: PASS
- remote deletion non-propagation: PASS
- restart ledger convergence: PASS
- false stale-plan rejection: なし（`stalePlanRejected: false`）
- production Vault untouched: PASS
- performance errors: 0
- measurement Drive root trash: PASS（cleanup終了コード0の後だけ結果を出力）
- 前面Electron error dialog: 再発なし

## 却下・保留

- MD5/SHA内容ガードを入れる前の4並列はDrive版不一致で失敗したため、その時点では却下した。内容ガード後に同条件を再試験し、errors 0と全安全受入を確認して採用した。
- 4を超える並列数は未採用。今回の要求を満たす証拠がなく、rate limitとtail latencyのリスクを増やすため試していない。
- 実Drive applyの「修正前比35%以上」という候補目標は未達（21.94%）。ローカル差分走査は目標を超えた。実Driveは安全性・errors 0・p50/p95の改善を確認して4並列を採用した。

## 本番昇格証拠

`npm run production:update` 最終結果:

- typecheck: PASS
- tests: 695 PASS / 1 SKIP（696 total）
- MCP contract/smoke: PASS
- package/installer contract: PASS
- packaged smoke / installed smoke: PASS
- installed executable hash: 一致
- installed `app.asar` hash: 一致
- Codex MCP registration: PASS
- production profile: 57 files、digest前後一致、unchanged
- verified at: `2026-08-16T12:39:28.465Z`
- installed executable SHA-256: `07682523e0e3e964dd88195ef096fe7845a692d7581e25440225463ef5721f16`
- installed app.asar SHA-256: `28aace6f9bb405fc952c3427299c94545fba981904dcd7bd46fb73869f7be8aa`

本番昇格後の追加変更は、この実測レポートへの最終値反映だけで、installed product codeと受入ハーネスは変更していない。

## 残余リスク

- 実Driveは5回測定のため、apply p95はネットワーク揺らぎの影響を受ける。最終runの最大値は7,221.950 msだった。
- full metadata refreshは正しさ優先で残しており、大規模VaultではAPI待ち時間になる。限定対象refreshへ変えるには、別の安全受入が必要。
- MD5欠落時はSHA-256確認のため本文GETが1回増える。外部変更を拒否するための意図したフォールバックである。
- cleanup helperはinstalled bundleとproduction refresh tokenを読み、測定rootのtrashだけを行う。資格情報は出力・保存していないが、将来汎用化する場合はcleanup専用資格情報の分離を検討する。
