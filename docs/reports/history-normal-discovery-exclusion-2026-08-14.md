# 50_履歴 Normal Discovery Exclusion — 2026-08-14

## 結論

通常のGraph、バックリンク、Renderer検索から`50_履歴`を既定除外し、本番へ反映した。File treeと直接openは維持し、MCP `include_history: true`、Temporal Memory、Drive同期、監査履歴のMarkdownは変更していない。

## 実装

- Rendererが既存の`createExcludedFileMatcher`を使い、`50_履歴`を除いた同一note集合をGraph、通常バックリンク、Renderer検索、linked-view backlinkへ渡す。
- File tree、選択中ノート、Wiki link解決、直接read経路は全note集合を維持する。
- 新規依存、設定、DB、cache、index、BM25、Hooks、学習順位は追加していない。

## TDD

- RED: `50_履歴/AI更新/A-history.md`が通常バックリンクへ表示されることを確認。
- GREEN: 同じ履歴ノートがFile treeから直接開ける一方、バックリンク、ローカルGraph、通常検索には出ない公開動作を固定。

## 検証

- `npm run typecheck`: PASS
- `npx vitest run tests/app.safety.test.tsx --maxWorkers=1`: 59/59 PASS
- `npm test`: 63 files／627 tests PASS
- `npm run check:mcp`: 6 read／7 write tools PASS
- `git diff --check`: PASS
- Ponytail review: `Lean already. Ship.`

## 本番更新

- product commit: `6f3f84fc637cf6cc5cd12b230f67039759cadddc`
- `npm run production:update`: 10/10 checks PASS
- built／installed executable SHA-256: `80bb1fdf7d1ab8e035d4d2487ba8a996c576af40269872b9b7e76554a3e12980`
- built／installed `app.asar` SHA-256: `3e02907d82c0160923c93c2192f82200c942e1c38b05380ed8d5ad5cb245a9c7`
- production profile: 57 files、digest前後一致
- MCP registration: refreshed／PASS

## 残る境界

- `50_履歴`の圧縮、削除、ローテーションは行っていない。
- Drive同期対象は変更していない。
- 実Vaultでの体感差と副作用はO1 dogfoodで観測する。
- freshnessから行動キューへの導線とニューロン系順位付けは別のresume条件までheld。
