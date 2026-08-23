# Directory Inventory Fingerprint — 2026-08-18

## 結論

`list_directory`へscope fingerprintを追加し、複数ページの取得中に対象範囲が変わった場合を次ページで検出できるようにした。先頭ページが返す`fingerprint`を後続ページの`expected_fingerprint`へ渡し、不一致なら`FILE_CHANGED`で先頭からの再取得を要求する。

採用する。履歴棚卸しで実際に起きた844件から848件への増加を無言で混在させる問題を、DB・watcher・永続cache・新規toolなしで閉じられる。fingerprintを使わない単ページ利用と既存cursorはそのまま動く。

## 契約と境界

- fingerprintはVault root、正規化した対象path、bounded depth、対象範囲内の順序付きinventoryからSHA-256で生成する。
- Markdownと添付はpath・type・size・modified time、folderはpath・typeを含める。
- folderの子要素countはhashしない。指定depthの外側だけの変更で、不必要に後続ページを拒否しないためである。
- fingerprintはsnapshot ID、本文hash、cross-Vault IDではない。返却後の変更を固定せず、後続callで再走査して差を検出する。
- `expected_fingerprint`は任意である。既存clientの単ページ取得を壊さず、厳密な複数ページ棚卸しだけがguardを選べる。

## TDDと契約検証

1. 400 foldersと1 noteを200／200／1件の3ページで取得するtestを追加し、fingerprint未実装によるREDを確認した。
2. 全ページで同じfingerprintを返すservice実装後にGREENを確認した。
3. 後続ページ取得前の対象範囲内additionが拒否されないREDを確認した。
4. addition、deletion、noteのmtime-only changeを`FILE_CHANGED`で拒否し、範囲外変更は継続するtestをGREENにした。
5. 公開input/output schemaとstdio smokeへ契約を追加し、schema未実装のRED後にGREENを確認した。

## 固定fixtureの効率測定

一時Vaultへ400 foldersと1 noteを作成し、25 samplesの中央値を測定した。一時Vaultは測定終了時に削除した。

| 項目 | 結果 |
| --- | ---: |
| ページ件数 | 200 / 200 / 1 |
| 3ページfingerprint一致 | true |
| page 1 compact JSON | 24,781 bytes |
| fingerprint field増分 | +88 bytes / page |
| guardなし後続page中央値 | 33.827 ms |
| guardあり後続page中央値 | 34.035 ms |
| guard比較差 | +0.207 ms |
| guardあり3ページ走査中央値 | 101.917 ms |

Freebuff 15-tool定義JSONは24,699から24,819 charactersへ120 characters増加した（+0.49%）。tool数はCodex／Freebuff 15、direct 17のままである。

この時間差は同じ現行実装における`expected_fingerprint`比較の有無であり、旧版に対するhash計算costではない。OS cacheやfixture規模にも依存する。bytesはhost-visible token、料金、回答品質の証明ではない。

## 採用判断

- 防ぐ失敗: 複数ページをまたいだ追加・削除・file metadata変更の無言混在。
- context cost: 88 bytes / page、tool definition +120 characters。
- runtime cost: 現行fixtureでguard比較差の中央値0.207 ms。全走査は約102 ms。
- 保守cost: service helper 1つ、既存toolの任意input 1つ、必須output 1つ。新規依存・状態・別toolはない。
- 非採用条件だった「再走査の方がschema追加より十分安い」には該当しない。再走査だけでは変更を識別できず、実際の棚卸しで再取得が発生していたためである。

## 検証結果

- `npx vitest run tests/mcp-service.test.ts --maxWorkers=1`: 52 PASS
- `npm run typecheck`: PASS
- `npm test`: 762 PASS / 1 SKIP
- `npm run check:mcp`: PASS（direct 17 tools、Codex／Freebuff 15 tools、Freebuff definition 24,819 characters）
- `git diff --check`（対象7 files）: PASS。LF→CRLF warningのみ
- Ponytail review: P0 / P1 / P2 findings 0
- `npm run production:update`: PASS。source fingerprint `9b084e412fac63035cb29ffc0dbed42de99690cfd85fa3d55a29400edf77881c`
- built／installed executable SHA-256: `6cd004a3536e2ead66b1341e3a175b93f7d3efacf5d999dc34c1560b3de7ffd9`（一致）
- built／installed `app.asar` SHA-256: `9bec1900be6f68619822a0d739a66af44a24b74670d3b55e2682a6cf21aecbcc`（一致）
- production profile: 58 files、digest一致、unchanged

## 再起動後live受入とコンテキスト効率

再起動後はbuild、test、install、production Vaultの変更を行わず、登録済みMCPだけをread-onlyで検査した。

- runtime: process started `2026-08-17T18:05:34.465Z`、build updated `2026-08-17T17:57:45.054Z`、`stale_runtime: false`。
- live schema: 必須output `fingerprint`、任意input `expected_fingerprint`を確認。
- scope: `50_履歴/AI更新`、depth 1、1,044 entries。
- pagination: 200 / 200 / 200 / 200 / 200 / 44の6 pages。全ページでfingerprint一致。
- initial 6-page traversal: 1,518 ms、structured JSON 246,758 bytes。
- fingerprint増分: structured 88 bytes / page、6 pages合計528 bytes（structured全体の0.214%）。
- Codex wrapperのtext block重複を含むlive page 1では、structured 88 bytes + text 92 bytes = 180 bytes、visible payloadの0.175%。6 pages換算1,080 bytes。
- live warm sample 5回ずつ: guarded later page中央値171 ms、unguarded 165 ms、差+6 ms。小標本・filesystem cache依存であり、旧版とのhash cost比較ではない。
- 正しい形式の偽fingerprintを後続pageへ渡すread-only testは`FILE_CHANGED`となり、「先頭ページから再取得してください」を返した。Vault内容は変更していない。

安定したinventoryではcall数は従来と同じ6回であり、call削減は主張しない。価値は、変更時に次のpage callで停止し、異なるinventoryの後続pageを無言で取り込まないことにある。bytesはhost-visible token、料金、回答品質の証明ではない。

再起動後live受入まで完了した。再起動後にbuild、test、install、production updateは再実行していない。
