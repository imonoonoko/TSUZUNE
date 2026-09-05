# Calendar 1.5.10 Target-Specific Conformance Matrix

## 判定境界

- 対象は Liam Cain `obsidian-calendar-plugin` の公式 stable `1.5.10` のみ。
- 公式配布 `main.js` と `manifest.json` を改変せず、固定 SHA-256 一致時だけ実行する。
- `PASS` は TSUZUNE の Windows Electron 実行環境と隔離 Vault で確認した項目。
- `N/A` は Calendar 本体ではなく Obsidian workspace、別 plugin、mobile host が所有する項目。
- 他の Obsidian plugin、Obsidian API 全般、将来版 Calendar の互換性は主張しない。

## 固定対象

| 項目 | 値 |
|---|---|
| Repository | `liamcain/obsidian-calendar-plugin` |
| Release | `1.5.10` |
| Commit | `7d2aebda7f4a280bedc6da6d25f4da611d1625ef` |
| Release ZIP SHA-256 | `e110a1c1e47247c00a931b629aeded35c2b7025f6e71bf37fd30823f6b949f1d` |
| `main.js` SHA-256 | `7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125` |
| `manifest.json` SHA-256 | `f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b` |
| Runtime dependency | `moment@2.29.1` exact pin |

## Calendar 固有の公開動作

| 公式動作・設定 | 判定 | 証拠 |
|---|---:|---|
| 固定 id/version/SHA の公式 artifact だけを load | PASS | artifact unit tests、JSDOM、Electron result |
| missing、改変、別 version、symlink artifact を拒否 | PASS | `tests/calendar-plugin-artifact.test.ts` |
| 右 sidebar に Calendar view を表示 | PASS | Electron screenshot/result |
| `show-calendar-view` command で閉じた sidebar を再表示 | PASS | Electron `showCalendarView` |
| 42日 month grid、前後月移動、Today | PASS | JSDOM/Electron `days=42` |
| 既存 Daily Note を日付 click で開く | PASS | Electron `clickOpened` |
| 未作成 Daily Note の確認表示 | PASS | Electron confirmation title/date/buttons |
| 作成 cancel 時に Markdown を変更しない | PASS | before/after digest 一致 |
| 確認後だけ Daily Note を作成 | PASS | Electron `createConfirmationAccept` |
| 確認 OFF では modal なしで作成 | PASS | Electron `createWithoutConfirmation` |
| Daily Note の format/folder/template と token 展開 | PASS | 隔離 fixture の作成内容 |
| Words per Dot の通常値 | PASS | 520語で2 dots |
| Words per Dot の最大5 dots | PASS | 50語設定で5 dots |
| Words per Dot の0無効化 | PASS | Electron `disabledWordDots=0` |
| 未完了 task の hollow dot | PASS | Electron `unfinishedTaskDots=1` |
| locale による週開始 | PASS | 初期 locale と Moment locale data を照合 |
| Monday + Japanese locale | PASS | Electron first header `月` |
| Sunday + English locale | PASS | Electron first header `Sun` |
| Show Week Number | PASS | Electron 6 week numbers |
| week number click で既存 Weekly Note を開く | PASS | 作成後の week cell click |
| `open-weekly-note` command | PASS | Electron command palette 経由 |
| Weekly Note format/folder/template | PASS | `02_デイリー/週次/2026-W35.md` |
| Weekly template の曜日/date/time token 展開 | PASS | 全曜日 token と未展開 `{{` なし |
| `reveal-active-note` command | PASS | 別月移動後に active day/月へ復帰 |
| Ctrl-hover preview | PASS | Electron tooltip 1件 |
| Ctrl-click で新規 tab | PASS | workspace tab 数増加 |
| 公式3 command の exact id | PASS | JSDOM activation と Electron command palette |
| 設定JSON永続化、renderer lifecycle再起動後の復元、設定画面への再表示 | PASS | isolated `settings.json`、再読込後runtime、UI値を照合 |
| 同一設定の親/plugin間 echo を停止 | PASS | host runtime unit test、Electron persistence |
| 公式 CSS variables の override | PASS | `--color-dot: rgb(1, 2, 3)` |
| snapshot 更新、active file、unload cleanup | PASS | frame/host unit tests |
| 想定外の Markdown 作成・削除なし | PASS | 作成3件のみ、削除0件を digest/path で照合 |

## N/A と明示する Obsidian host 機能

| 項目 | 判定理由 |
|---|---|
| Calendar view の中央・左右への drag/drop、pin | Obsidian workspace 所有。TSUZUNE は固定 right context panel を提供する。 |
| Obsidian Hotkeys 画面での shortcut 再割当 | Obsidian host 所有。3 command は TSUZUNE Command Palette から実行できる。 |
| Periodic Notes plugin との cross-plugin integration | 別 plugin 依存。Calendar 1.5.10 の standalone weekly settings を検証対象とした。 |
| mobile Obsidian host | TSUZUNE は Windows desktop 専用。 |
| 任意の community plugin / Obsidian API 全般 | 本 work item の対象外。汎用 plugin runtime は実装していない。 |

## 再現コマンド

```powershell
npm run check:calendar:artifact -- "<official-calendar-1.5.10-directory>"
npm run build
npm run check:calendar:electron -- "<official-calendar-1.5.10-directory>"
npm run check:calendar:electron -- "<official-calendar-1.5.10-directory>" "C:\Users\Humin\AppData\Local\Programs\tsuzune\resources\app.asar\out\main\index.js" "<outside-repository-output-directory>"
npx vitest run tests/calendar-plugin-*.test.ts tests/calendar-plugin-frame.test.tsx --maxWorkers=1
```

Electron の機械可読結果は `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/result.json`、画面証拠は同 directory の `electron-acceptance.png`。

## インストール済み本番の受入

- `npm run production:update` の10 checksを通し、build成果物とインストール済み `TSUZUNE.exe` / `app.asar` のSHA-256一致を確認した。
- `%APPDATA%\TSUZUNE` は更新前後とも61 filesでdigest一致。利用者profileは変更されていない。
- インストール済み `app.asar` の `out/main/index.js` を直接entryにして、上表と同じElectron受入を再実行し `PASS` を確認した。
- 最終のinstaller/build/installed hashとsource fingerprintは `docs/reports/production-update-latest.json` を正本とする。

## 既知の依存リスク

`npm audit --omit=dev` は、公式Calendar 1.5.10と同じ `moment@2.29.1` に対してHighを1件（advisory 2件）報告するため、audit自体はgreenではない。

- `GHSA-8hfj-j24r-96c4`: locale path traversal
- `GHSA-wc69-rhjr-hc9g`: locale処理のReDoS

本対象では公式artifactとの実行互換を維持するため依存を変更していない。Momentは `sandbox` iframe、`nodeIntegration: false`、strict CSP、local-only設定経路で実行し、Node filesystemやremote設定入力へ公開していないため、現行の限定経路では出荷停止ではなく既知の残余リスクとして受容する。将来remote入力、Node側Moment、汎用plugin runtimeへ範囲を広げる場合は、依存更新またはlocale allowlistを再開条件とする。

## 公式根拠

- Release: <https://github.com/liamcain/obsidian-calendar-plugin/releases/tag/1.5.10>
- README: <https://github.com/liamcain/obsidian-calendar-plugin/blob/1.5.10/README.md>
- Manifest: <https://raw.githubusercontent.com/liamcain/obsidian-calendar-plugin/1.5.10/manifest.json>
