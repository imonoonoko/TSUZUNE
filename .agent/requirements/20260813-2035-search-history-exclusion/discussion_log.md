# Discussion Log

## 2026-08-13 設計

- ボールトの改善案ノート(30_知識/TSUZUNE-MCP改善案-2026-08-13)の優先度1として設計。
- 実測: `"X1-T1 本番反映"` の MCP search で9件中8件が 50_履歴/AI更新 だった。
- 設計書: 30_知識/TSUZUNE-MCP-検索履歴除外-設計-2026-08-13。

## 2026-08-13 設計レビュー

- 6点を修正: include_history の意味の違い明記 / スライス境界明示 / 定数化 / AC追加(40_情報源・tag:・パリティ・fetch/get_backlinks) / 実装後ドキュメント更新 / スキャン前提のコード確認。
- 教訓ノート: 30_知識/TSUZUNE-AI設計レビューの教訓-2026-08-13。

## 2026-08-13 実装・検証

- service.ts / server.ts を変更、テスト5件を追加。
- typecheck PASS、mcp-service.test.ts 36 tests PASS、全体 61 files / 585 tests PASS。
- 本番反映(ビルド・再インストール・commit・push)は利用者の明示指示があるまで行わない。
