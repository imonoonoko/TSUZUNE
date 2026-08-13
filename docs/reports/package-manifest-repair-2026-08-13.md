# Package Manifest Repair — 2026-08-13

## 結論

TSUZUNE直下の`package.json`を、commit `5266131`のcanonical TSUZUNE 0.5.0 manifestへ復旧した。`package-lock.json`は既にcanonical manifestと整合していたため変更していない。型検査、全test、MCP smoke、製品buildはすべてPASSした。

修復確認後、利用者の明示了承により公式`npm run production:update`を実行し、CP1-B-02を含む現在のworking treeを本番へ反映した。Git commit／push／release公開は行っていない。

## 原因

2026-08-12 21:02 JSTの隔離Obsidian版確認で、次の診断コマンドがrepository rootをworking directoryとして実行された。

```text
node_modules/.bin/asar.cmd extract-file <pinned obsidian.asar> package.json
```

`extract-file`の出力先を分離しなかったため、TSUZUNE直下の同名ファイルを上書きした。混入manifestのSHA-256 `8ea500206e7f2c25b8de1a996e4d3af41a159aa118ee487ba7e622c3896215a4`は、固定Obsidian archive内`package.json`と完全一致した。製品runtimeの保存経路や依存更新による変更ではない。

## 修復

- authoritative source: `git show 5266131:package.json`
- 復旧後SHA-256: `e01b44384af6ed99b40025300478943aa0c99f9dea6758706733c398eeafd398`
- 復旧後の`git diff -- package.json`: 0
- `package-lock.json`: 変更なし
- 新規依存、抽象化、製品コード変更: なし

今後archiveから同名ファイルを抽出する診断は、repository外の一時directoryをworking directory／出力先にしてから実行する。

## Formal Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 58 files、529 tests |
| `npm run check:mcp` | PASS — 4 read tools、3 write tools |
| `npm run build` | PASS — main、preload、renderer、MCP |
| `git diff --check` | PASS |

## Ponytail Review

Lean already. Ship. 復旧対象をcanonical manifest一件に限定し、lockfile再生成、新規guard script、新規依存を追加しなかった。

## Production Update

- status: `installed-and-verified`
- verified at: 2026-08-13 01:06:46 JST
- source fingerprint: 1,118 files / `1fce6ed77cc4e92c23c339ff70152df12636dc2922db46361cdf03869fa9b584`
- tests: 58 files／529 tests PASS
- production checks: 10/10 PASS
- built／installed executable SHA-256: `078601894f97ac06dbc93b5432a1310ec5fc7d5048a25e74b893320ed2ea17b2`
- built／installed app.asar SHA-256: `0f48f5c5fe8442ca701da8be253f5a036bda8cdcb715e8cf649548bbe9e9cb68`
- production profile: 57 files、digest不変
- MCP: 再登録済み。Codex Desktopで新しい接続を使うには再起動が必要
- canonical receipt: `docs/reports/production-update-latest.json`
