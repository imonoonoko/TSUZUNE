# Packet 03 result — repository boundary

## PASS

- `npx vitest run tests/context.test.ts --maxWorkers=1`: 47/47。
- `npm run typecheck`: PASS。
- `npm test`: 77 files PASS、1 SKIP。818 tests PASS、1 SKIP。
- `npm run check:mcp`: contract、smoke、Freebuff、delivery evaluator、stale-runtime guardが全てPASS。
- progressive-context fixture at 3000 chars: fixture SHA-256 `8ca7b80b8569b2c002edce1ccd25452c56b6744d99d9fdb217fc6ff034156a6e`、expected multi-source到達、descriptor一致6件。
- dynamic workflow verifier: PASS。
- `git diff --check`: errorなし。既存working treeのLF/CRLF warningのみ。
- Ponytail review: `Lean already. Ship.`。新規dependency・抽象化・別経路なし。

## Diagnosed regression

最初のprogressive-context検証ではatomic query `MCP`が無関係な3 seed節を埋め、関連MOCを予算外へ押し出した。public回帰testを追加し、単一intentのaggregate fallbackを1 distinct sectionへ限定して解消した。

## Pending production boundary

なし。artifact freeze後のproduction同期結果は、fingerprint計算から除外される `docs/reports/production-update-latest.json` を正本とする。

## Production update

- status: `installed-and-verified`。
- verified at: `2026-08-23T15:50:16.783Z`。
- source fingerprint: `7900e385b194968dd57e4735da2719cd506f4deef78c5e6a9dc0337924c21753`、1109 files。
- installer SHA-256: `a77bb36158795d5f111c24b67700f826669ed133bfc3b533443e34b81b09c403`。
- built/installed executable SHA-256一致: `b7fcc00136ee40e2e4fafe98d57bf8f1072576efbace8f0e2ca92750f1205e42`。
- built/installed app.asar SHA-256一致: `29c8d8b41e2bf4f8574633a4d2b95cab9613658576f7024729774e91fe83c284`。
- production profile: 58 files、digest一致、unchanged。
- typecheck、tests、MCP、package、installer、packaged smoke、silent install、installed smoke/hash、MCP registerが全てPASS。

## Post-restart live acceptance

- runtime: server/package `0.5.0`、profile `direct`、`stale_runtime: false`。
- quality 3000: markers 16/16、tasks 5/5、seed truncation 0/5。
- quality 5000: markers 16/16、tasks 5/5、seed truncation 0/5。
- quality 8000: markers 16/16、tasks 5/5、seed truncation 0/5。
- baseline comparison: 3000は14/16・3/5から満点、5000は12/16・3/5・seed truncation 1/5から満点、8000は16/16・5/5を維持。
- sequential latency at 3000 chars, warmup 1 + 15 samples: p50 482 ms、p95 593 ms、min 460 ms、max 593 ms。
- previous baseline p50 559 ms、p95 595 msに対し、p50は77 ms低下、p95は2 ms低下。少なくとも回帰なし。速度改善の因果は主張しない。

初回再起動直後のdelivery statusは`mismatch`だったが、production更新後にこのworkflow artifactへreceiptを書き戻したことでsource fingerprintが変化したためであり、runtimeはfreshだった。artifact確定後にproduction updateを再実行して同期する。

## TSUZUNE persistence

- record: `30_知識/TSUZUNE-build_context実効予算・親見出し・全意図保持改革-実施記録-2026-08-24.md`。
- size: 14,362 bytes。
- exact file search: 1件。
- read-back: PASS。
- backlink: 直前実施記録から1件。
- 直前実施記録はrevision guard付きautonomous updateで一度だけ更新し、旧版を履歴保存した。
