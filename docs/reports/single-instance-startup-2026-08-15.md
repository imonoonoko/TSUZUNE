# Single-instance Startup — 2026-08-15

## 結論

TSUZUNEを繰り返し起動しても主プロセスを一つに保ち、既存ウィンドウを表示・復元・前面化する最小対策を本番へ反映した。installed appを2回起動した実機受入でも、主プロセスは同じPIDの1件だけだった。

## 原因と実装

- 原因: Electron起動時にsingle-instance lockを取得しておらず、起動要求ごとに別の主プロセスを開始できた。
- 起動直後、`app.whenReady()`より前に`app.requestSingleInstanceLock()`を呼ぶ。
- lockを取れない後続プロセスは`app.quit()`で終了する。
- 既存プロセスは`second-instance`を受け、既存の`showMainWindow`で最小化解除、表示、focusを行う。
- 新規依存、background service、mutex file、process列挙、強制終了は追加していない。

Electron公式API: <https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata>

## TDDと検証

- RED: `npx vitest run tests/release-config.test.ts`でsingle-instance lock不在を検出。
- GREEN: 同test 5/5 PASS。
- `npm run typecheck`: PASS。
- `npm run test:production`: 63 files／628 tests PASS。
- `npm run check:mcp`: 6 read／7 write tools PASS。
- `git diff --check`: PASS。
- Ponytail review: Lean already。既存のwindow表示関数だけを再利用した。

## 本番更新

- product commit: `9b2e028200a85bd2901915c86ff49d32d1c01a7e`
- `npm run production:update`: 10/10 checks PASS。
- built／installed executable SHA-256: `e02251df8bf7775667ab56110b764bfe02b014a7be6068640a2f905358784c3e`
- built／installed `app.asar` SHA-256: `3e4d9b8c1230a0783cc2b07e86d5a632f6fd1c779a44e23bdc454950d4aaeac8`
- production profile: 59 files、digest前後一致。
- MCP registration: refreshed／PASS。

## Installed live acceptance

2026-08-15 02:53 JSTにinstalled `TSUZUNE.exe`を通常起動し、続けて同じ実行ファイルをもう一度起動した。

- 1回目の主プロセス: PID `18776`。
- 2回目の起動後: 主プロセス1件、PID `18776`のまま。
- 既存window: handle `199642`、title `TSUZUNE`。
- PID `18776`配下の3件はElectronの通常の子プロセスであり、別の主instanceではない。

判定はPASS。受入後も本番TSUZUNEは通常起動した状態を維持し、強制終了していない。

## 境界

- 保証範囲は同じWindowsユーザー・同じElectron user-data profileでの起動である。
- OS crash後の復旧、別Windowsユーザー、明示的に異なる`--user-data-dir`を使う診断起動はこの受入の対象外。
- O1 7-day dogfoodの観測優先度と、freshness／ニューロン系機能のresume条件は変更しない。
