# CP1-B-03 Production Readiness Audit

実施日: 2026-08-13
対象: `agent/tsuzune-mcp-integration` / `5266131f6e2c38afc39b46fe9083c9e1fef39577`

## 結論

**BLOCKED — 現在のworking treeを本番更新へ渡さない。**

製品ソースのTypeScript型検査は通るが、root `package.json`がTSUZUNE 0.5.0の配布manifestではなく、Obsidian 1.13.4の開発用manifestへ置き換わっている。正式入口の`npm run build`は存在せず、全テストもこの欠損を検出して2件失敗した。監査中にmanifestを修復せず、別taskで所有者と意図を確認してから最小修復する。

## 固定した現物

- 開始時Git status: 461 paths（modified 34 / untracked 427）。上位は`src` 154、`docs` 127、`tests` 115、`.agent` 43、`scripts` 14。
- current `package.json`: `name=obsidian-dev`、`version=1.13.4`、scriptsなし、SHA-256 `8ea500206e7f2c25b8de1a996e4d3af41a159aa118ee487ba7e622c3896215a4`。
- `HEAD:package.json`: `name=tsuzune`、`version=0.5.0`。`build`、`test`、`check:mcp`、`production:update`、NSIS build契約を保持する。
- current `package-lock.json`: rootは`tsuzune` 0.5.0で、current `package.json`と不一致。
- `package.json`は170行削除・11行追加のtracked差分。最終更新時刻はCP1-B-02の製品変更より前だが、書き換えたprocess／taskはこの監査では確定していない。
- installed TSUZUNE 0.5.0のEXE SHA-256 `6508ac942e79a09a029367a61baaa6e89ecea485b1aa68ac72f94fa6c2571a19`と`app.asar` SHA-256 `67b172c59f17f8fd01e1a3095dc3a1c43fb5f7174db82300b8a0ef45e33c890d`はlatest receiptと一致した。これはinstalled本番の同一性だけを示し、current sourceの出荷可能性は示さない。

## 検証結果

| 検証 | 結果 | 意味 |
|---|---|---|
| `git diff --check` | PASS | whitespace errorなし |
| direct TypeScript `--noEmit`（node / web） | PASS | TS sourceの型は成立 |
| direct Vitest、1 worker、6 GiB | **FAIL** | 58 files中57 pass / 1 fail、529 tests中527 pass / 2 fail |
| `release-config.test.ts` | **2 FAIL** | `build.appId`と`scripts.production:update`がundefined |
| `npm run build` | **BLOCKED** | `Missing script: "build"` |
| package／production update | 未実行 | audit stop conditionに従い、build入口不成立の時点で停止 |

失敗はCP1-B-02のMarkdown note folder revealの公開挙動を直接否定するものではない。しかし、本番更新はpackage／release契約を含む一体のgateなので、製品コードだけが通っても進められない。

## 最小の次task

1. `package.json`差分の所有者と意図を確認する。Obsidian比較artifactをrepo rootへ残す意図がないことを証拠で確定する。
2. authoritativeな`HEAD:package.json`と現在必要なTSUZUNE変更を比較し、manifestだけを最小修復する。`package-lock.json`は意味のない再生成をしない。
3. `npm run typecheck`、`npm test`、`npm run check:mcp`、`npm run build`を正式入口から再実行する。
4. 全gateが通った後にだけ、利用者の別指示で`npm run production:update`を行う。

## 境界

- package/config/source、installed app、Git historyは変更していない。
- production update、package、commit、push、reset、restoreは行っていない。
- CP1-B-03は監視sample 3/3として`blocked`。fresh-task境界そのものがmanifestを壊したとは断定しないが、短いhandoffだけでは開始時のsource/config integrityを保証できないことを示した。
- rollout実測: input 2,303,178、cached input 2,212,352（96.06%）、output 10,793、reasoning 1,931、26 token events、elapsed 427,040 ms、retry 1。実費とsource単位の再読は未観測。
