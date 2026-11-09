# 文脈生成のリンク構文解析再利用 — 2026-11-09

MCPの `build_context` と `build_context_set` で、変更していないノートのリンク構文を再利用する。各要求でMarkdownと設定を読み、解決先・除外・時間情報・出典revisionは最新snapshotから計算する。通常検索・高度検索・rendererのリンク表示は変更しない。

## 保持と更新の契約

- 相対パスごとの最後の本文と構文抽出結果だけを保持し、本文文字列が完全一致した時だけ再利用する。同サイズ・同mtimeの編集も検出する。
- service単位で2,048パス、本文合計8,000,000 UTF-16文字、リンク出現50,000件まで保持し、超過時はLRU破棄する。単独で上限を超えるノートは保持しない。最大heap使用量の保証ではない。
- 戻り値はrangeも複製する。Vault切替とプロセス再起動で破棄する。DB・依存・daemon・永続ファイルは追加しない。
- 出力契約と書込権限は変えない。

## 正しさの検証

`tests/context-link-cache.test.ts` はserviceの公開操作を通して、同mtime・同サイズの編集、関連本文とrevision、alias変更、対象の追加・削除、相対リンク元の移動、単一起点と複数起点の共有、除外設定、Vault切替を確認する。構文戻り値の変更と件数上限での破棄も検証する。

GitHubのmain（`ce78c81a03893338fd3e184c2773d84cef83ff29`）から専用ブランチを作り、以下の5ファイルへ本番実装の最適化差分だけを適用した。

- `src/core/links.ts`
- `src/core/context.ts`
- `src/mcp/context-set.ts`
- `src/mcp/service.ts`
- `docs/mcp-integration.md`

新規ファイルは構文cache、回帰test、この報告の3件。先行する未公開のUI・検索等の変更は含めない。適用前は同じContextの2回目でもparserが33回呼ばれ、再利用を要求するtestが失敗することを確認した。公開前の必須gateは `npm run typecheck`、`npm test`、`npm run check:mcp`。結果とGitHubマージの最終状態はPRおよび同一campaignのTSUZUNE実施記録を参照する。

一般の同時要求、文字数・出現数それぞれの上限超過は専用回帰testでは検証していない。

## 実測の対象と方法

以下はこのPCの**2026-11-09の本番ソースへの統合時**の比較であり、GitHub mainへの選択的な適用版を再計測した値ではない。本番とGitHub main全体の同一性も意味しない。統合前の正確なsource archiveと統合版を同じesbuild設定でbundleし、Node v24.19.0で測った。raw samplesとharnessは作業時のローカル `work/context-link-reuse/results.json` と `measure.mjs` に保持している。このPRには含めない。

日本語Markdownは各ノート2〜9KiB、Wiki/Markdownリンク3件、高次数hubを含む。時間系State/Eventは含まない。JIT準備後、旧→新／新→旧を交互に実行し、coldは新service/cacheの6組、変更なしは同じservice/cacheの10組、編集直後は1ノートの本文とリンクを変えた8組を比較した。生成時刻を固定し、4規模のcoreと2操作のservice、計144組すべてで完全なJSON出力一致を確認した。parser instrumentation、build・fixture作成・結果検証は計測外。OSファイルcacheはflushしておらず、coldはディスクcoldや起動時間ではない。

## ファイル読取を含むservice（1,000ノート）

MCPと同じserviceのpublic methodを使い、実ファイル読取・snapshot・整形・出典revisionを含む。Codex tool host・stdio transport・モデル処理は含まない。時間は中央値。

|操作|初回 旧→新|変更なし 旧→新|1件編集直後 旧→新|
|---|---:|---:|---:|
|単一起点Context|186.2→171.3ms|195.3→75.9ms（61.2%減）|162.6→68.1ms（58.1%減）|
|2起点Context Set|867.9→814.0ms|629.1→525.0ms（16.5%減）|722.0→650.8ms（9.9%減）|

変更なしのp95は単一起点225.2→81.6ms、2起点897.9→680.5ms。別試行では初回が遅い場合もあり、初回の一貫した改善や通常Vaultでの一定の短縮率は主張しない。

## I/Oを除く単一起点Context

|ノート数|変更なし 旧→新 中央値|1件編集直後 旧→新 中央値|
|---:|---:|---:|
|500|51.6→5.9ms|51.2→5.9ms|
|1,000|212.9→19.3ms|218.6→18.2ms|
|2,000|430.2→36.9ms|405.7→39.3ms|
|2,500|279.6→297.5ms|526.1→535.2ms|

2,500件は2,048件の上限を超える全体走査で保持内容が入れ替わり続け、変更なし6.4%、編集直後1.7%遅くなった。GC後heap差約4.2MiBはservice全体と一時的なV8保持を含む単一観測で、cacheだけの厳密な常駐量やpeakではない。

## 本番との境界

元の本番統合は全体test 3,720件成功・2件skip、typecheck・MCP gate、packaged/installed隔離smoke、built/installed EXE・asar一致、通常profile不変を確認した。再起動後のactive MCPもfresh・delivery matchを確認済み。今回のGitHub同期では本番バイナリを再配布せず、GitHub mainを基準とする最適化差分だけを検証・統合する。
