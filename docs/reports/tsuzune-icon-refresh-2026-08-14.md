# TSUZUNE Icon Refresh — 2026-08-14

## 結論

TSUZUNEの旧woven-loopを、知識の接続と「鈴音」を同時に表す **Interwoven Bell** へ更新した。

- アプリアイコン: 深いWorkshop Nightの角丸タイルに、JadeとWarm Ivoryの編み込まれた鈴。
- 通知領域: 背景を透明化し、16–32pxで形を保つ専用図案。ライト／ダーク双方のために深緑の外周を持つ。
- 文字、グラデーション、影、細線network、新しい依存関係は追加しない。

## Assets

| 用途 | 編集可能な正本 | 実行時asset |
|---|---|---|
| App／header／installer | `src/renderer/assets/tsuzune-app-icon.svg` | `src/renderer/assets/tsuzune-app-icon.png` |
| Windows tray | `src/renderer/assets/tsuzune-tray-icon.svg` | `src/renderer/assets/tsuzune-tray-icon.png` |

色は `#173F3B`、`#2F8C82`、`#F5F0E6`。既存Design SystemのWorkshop Night／Thread Teal／Paper系統を保ちつつ、アイコンでの識別性に合わせて明度差を広げた。

## Runtime Wiring

- renderer headerは新しいapp PNGを読む。
- Electron trayは実行ファイルの縮小画像ではなく、小サイズ専用PNGをVite assetとして同梱する。
- electron-builderのWindows iconは新しいapp PNGを読む。
- 参照がなくなった旧 `tsuzune-woven-loop.png` は削除する。

## Verification

- appは16／24／32／48／64px、trayは16／20／24／32pxを明色・暗色背景で目視し、輪郭とclapperを確認。
- `npm run typecheck`: PASS。
- `npx vitest run tests/release-config.test.ts --maxWorkers=1`: 1 file／4 tests PASS。
- `npm run build`: PASS。main bundleへtray PNG、renderer bundleへapp PNGを同梱。
- `NODE_OPTIONS=--max-old-space-size=10240 npm run test:production`: 63 files／626 tests PASS。
- `git diff --check`: PASS。
- Ponytail review: 旧829,501-byte assetを残さず削除。新依存、設定層、画像生成runtimeは追加せず、これ以上の削減対象なし。

## Installed visual acceptance

2026-08-14、ユーザー提供のinstalled v0.5.0実機captureで次の4 surfaceを確認し、すべてPASSとした。

| Surface | 結果 | 証拠 |
|---|---|---|
| Windowsタイトルバー | PASS | [app window](assets/tsuzune-icon-refresh-2026-08-14/01-app-window.png) |
| TSUZUNEアプリ内ヘッダー | PASS | [app window](assets/tsuzune-icon-refresh-2026-08-14/01-app-window.png) |
| Windowsタスクバー | PASS | [taskbar](assets/tsuzune-icon-refresh-2026-08-14/02-taskbar.png) |
| Windows通知領域 | PASS | [notification area](assets/tsuzune-icon-refresh-2026-08-14/03-notification-area.png) |

## Boundary

公式`production:update`を2026-08-14 20:13 JSTに完了した。typecheck、63 files／626 tests、MCP 6 read＋7 write、package、installer、packaged／installed smoke、build／installed hash一致、production profile 57 files不変、MCP再登録の10/10 checksがPASS。installed v0.5.0へ新しいapp／tray assetを反映済み。

初回gateでは、dirty tree上で削除済みの旧tracked assetをsource fingerprintが読もうとして停止した。`snapshotSourceTree`を現存pathだけに限定する一行修正を入れ、削除を含む正当なdirty sourceも検証できるようにしてから全gateを最初から再実行した。最初の停止はsilent install前で、本番変更なし。

installed appのタイトルバー、アプリ内ヘッダー、タスクバー、通知領域の目視受入まで完了した。Icon Refresh sliceはsource、production gate、installed visualの全境界で完了。commit、push、Drive applyは未実施。
