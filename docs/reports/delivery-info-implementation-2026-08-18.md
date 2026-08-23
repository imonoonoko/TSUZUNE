# Delivery info implementation — 2026-08-18

## 結論

`delivery_info`を、working sourceとlatest production receiptの一致状態だけを返すread-only MCP toolとして実装した。公開応答は次の一キーに固定し、runtime freshness、更新推奨、path、hash、理由、installed executable／`app.asar`の毎回hashを混ぜない。

```json
{"status":"match|mismatch|unknown"}
```

- `match`: 有効な現source fingerprintと有効なreceipt fingerprintが一致。
- `mismatch`: 両方が有効で、file countまたはdigestが不一致。
- `unknown`: receiptの欠落・不正・読取不能、source読取不能、またはrepository未確定。

Codex／Freebuffのcommon toolとして明示呼出し時だけ計算する。Hook、cache、DB、常駐監視、自動writeは追加していない。

## TDD evidence

実`src/mcp/server.ts`を一時Git repositoryの`out/mcp/server.js`へbundleし、公開stdio MCPだけを呼ぶfixtureを[`scripts/evaluate-delivery-info.mjs`](../../scripts/evaluate-delivery-info.mjs)へ固定した。

- RED: `delivery_info tool was not registered.`で失敗。
- GREEN: match／mismatch／missing／invalid receipt／repository未確定を期待statusへ分類。
- caller cwdをfixture repository外へ置いてもmodule locationからrepositoryを解決。
- 応答はstatus一キーだけで、UTF-8 bytesはmatch 18、mismatch 21、unknown 20。
- path／token／secret検出0、同一入力の2回応答差0。
- 各tool call前後のfixture filesystem snapshot不変。

## 共有fingerprint契約

production updateとDelivery infoは[`scripts/source-fingerprint.mjs`](../../scripts/source-fingerprint.mjs)の一実装を共有する。

- `git ls-files --cached --others --exclude-standard -z`の現存ファイルを対象にする。
- [`production-update-latest.json`](production-update-latest.json)自身だけを除外する。
- repository相対pathを英語localeでsortし、`path + NUL + file SHA-256 + NUL`を順にSHA-256へ投入する。
- server側はcaller cwdを使わず、bundleのmodule locationからrepository rootを決める。
- receiptのfile count、digest、除外契約がすべて有効な場合だけmatch／mismatchを返す。

## Context efficiency

追加tool定義のserialized JSONは646 bytesで、1,024 bytes未満のfixture gateをPASSした。Freebuffの全tool definitionは24,819 charactersから25,454 charactersへ635 characters増えた。公開応答は18〜21 bytesで、結果をserver instructions、`runtime_info`、自動contextへ埋め込まない。

この増分は、receiptを検索・取得し、source fingerprintを別経路で再計算して比較する複数tool往復より小さく、明示的な一回の状態確認を再利用できるためcommon登録を維持する。wire bytesをmodel-visible tokenや費用の証拠には読み替えない。

## Source gates

- `npm run typecheck`: PASS。
- `npm test`: 75 files PASS／1 SKIP、765 tests PASS／1 SKIP。
- `npm run check:mcp`: PASS。Codex／Freebuff common 16 tools、direct 18 tools、read 10／write 8、Delivery fixture PASS、stale-runtime fixture PASS。
- `git diff --check`: PASS（既存のLF→CRLF警告のみ）。

## 本番境界

正確なinstalled executable／`app.asar` hash、source fingerprint、production profile不変、MCP再登録の現状は[`production-update-latest.json`](production-update-latest.json)だけを正本とする。この文書へ可変hashを複製しない。

`delivery_info`は観測時点のsourceとreceiptの一致だけを示し、production updateの認可、runtime freshness、installed binary一致を証明しない。sourceがscan中に変われば読取失敗は`unknown`へ倒れるが、複数ファイルを跨ぐ極小TOCTOUは残るためproduction gateのbyte-stability検査を置き換えない。

bundle更新後の既存MCP processはstaleになる。再登録後の新規接続で`runtime_info.stale_runtime: false`と`delivery_info.status: match`を確認するまで、旧接続をlive runtime受入の証拠にしない。
