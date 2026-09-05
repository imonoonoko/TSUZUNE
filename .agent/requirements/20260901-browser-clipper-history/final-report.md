# Browser Clipper / Source Provenance Evidence Packet

## Outcome

- Chrome / EdgeのManifest V3拡張から、通常WebページとYouTubeを実行中のTSUZUNEへ送り、`01_受信箱`へ衝突安全なMarkdownとして新規作成するsource実装を完了した。
- 一般的な変更履歴、run log、新しい`50_履歴`への記録は復活させない。各クリップ自体をURL、取得時刻、取得IDを持つ原典スナップショットとして保存し、同一URLの再取得も別ノートにする。
- YouTubeはページ上で取得できた説明、選択範囲、表示中の文字起こしを保存する。完全な字幕や動画本文の自動取得は保証しない。

## Changed artifacts

- app: `src/main/browser-clip.ts`, `src/main/browser-clip-bridge.ts`, `src/main/index.ts`
- extension: `browser-extension/manifest.json`, `browser-extension/capture.js`, `browser-extension/popup.html`, `browser-extension/popup.js`
- verification: `tests/browser-clip*.test.ts`, `scripts/check-browser-clipper.mjs`
- packaging and docs: `package.json`, `README.md`, `docs/browser-clipper.md`, `docs/INDEX.md`, `PLAN.md`, `PROJECT_STATUS.md`
- architecture: `.agent/requirements/20260831-note-organization-video/context-engine-v4.md`

## Safety boundary

- bridgeは`127.0.0.1:27193`だけで待受け、固定extension origin、Host、Bearer tokenを検証する。
- 6桁pairing codeは5分、誤入力5回で失効する。app側tokenはElectron `safeStorage`を使う。
- extensionから指定できる保存先はなく、作成先は`01_受信箱`固定。update、delete、move、rename、overwriteを公開しない。
- Web由来本文は動的なコードフェンス内の不信データとして保存する。入力サイズ、同時処理数、同一requestIdを制限する。
- extension権限は`activeTab`, `scripting`, `storage`と固定loopback hostだけである。

## Verification before production gate

- focused Vitest: 3 files / 12 tests passed
- browser extension self-check: passed
- TypeScript typecheck: passed
- full test suite: 94 files passed, 1 skipped; 880 tests passed, 1 skipped
- MCP check: passed
- renderer / main / MCP build: passed
- current-decision check: passed
- workflow gate (`current-decision,typecheck,test,mcp`): passed; source unchanged
- `git diff --check`: errorsなし（既存の改行警告のみ）

## Independent review integration

| Role | Scope | Parent decision |
|---|---|---|
| history-model reviewer | 汎用履歴と原典snapshotの境界 | 汎用履歴は廃止維持、clip自体を原典snapshotとして採用 |
| integration scout | 現行Vault作成経路とbridge責務 | 既存create-only Vault経路を再利用し、Drive bridgeは流用しない |
| architecture reviewer | MV3 transportと権限 | 最小権限のloopback + one-time pairingを採用 |
| security reviewer | origin、token、path、untrusted content | 固定origin / Host / Bearer、Inbox固定、上限と非実行化を採用 |
| extension worker | capture extractionとself-check | metadata、sanitized clone、YouTube URL variants、UUIDを統合 |
| app integration worker | lifecycle、tray、safeStorage、packaging | 専用bridgeとして統合し、bridge失敗時も本体起動を維持 |
| adversarial reviewer | concurrency、pairing、extraction | in-flight join、5回失効、payload境界、injected return等を修正・test化 |

Subagentは本番Vaultを書き換えていない。最終統合、未提示境界の検証、本番gate、TSUZUNE書戻しはrootが所有する。

## Installed delivery and remaining boundary

installed状態の唯一の正本は、source fingerprintを含む除外済み
`docs/reports/production-update-latest.json`である。このファイルの`status`が
`installed-and-verified`で、現在source fingerprintと一致する場合だけ本番反映済みと判定する。
gate後にこのfingerprinted reportを編集して状態を二重記録しない。

自動検証の完了後も、利用者のChrome / Edge profileでunpacked extensionを読み込み、
pairingし、通常ページとYouTubeを実際に保存する操作は利用者確認境界として残る。
Chrome Web Store公開、Native Messaging、全文transcript取得、cloud同期は範囲外である。
