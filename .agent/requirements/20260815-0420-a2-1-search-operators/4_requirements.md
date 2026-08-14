# A2-1 通常検索演算子 要件凍結

- 凍結日時: 2026-08-15 04:20 JST
- 対象: Renderer の通常検索だけ
- 固定参照: Obsidian Desktop 1.13.4
- 参照状態: 公式installerから展開した固定runtime 1.13.4と匿名7-note fixtureで19-query matrixを完走し、結果集合を実測固定済み。

## 公開契約

1. 空白で区切った検索語は implicit AND とする。
2. 語、phrase、`tag:`、`path:`、`file:` の直前の `-` は否定とする。
3. `tag:` は `#` を省略可能、大文字小文字を区別せず、完全な tag またはその子 tag に一致する。例: `tag:project` は `#project/active` に一致する。
4. `path:` は拡張子を含む Vault 相対 path の部分一致、大文字小文字を区別しない。
5. `file:` は拡張子を含む basename の部分一致、大文字小文字を区別しない。
6. `"..."` は空白を含む連続 substring を1語として扱い、大文字小文字を区別しない。
7. 演算子は候補の filter として働く。通常語の既存 name/path/content scoring は変えず、複数の通常語では各語の既存 score を加算する。
8. filter だけの query は score 0 とし、既存の tie-break（更新日時、path）で並べる。
9. 演算子名と値の間の空白は許容する。実測上、`tag: project` は `tag:project` と同義になる。
10. 未知演算子と不正 query は予約構文として解釈せず、その token を通常語として検索する。ただしObsidian実測に合わせ、値なしの `tag:` と `-` 単独は結果なしとする。閉じていない quote は通常語として扱う。
11. 空 query は従来どおり結果なしとする。

## 境界

- Renderer は新しい専用入口を呼ぶ。
- MCP が使用する既存 `searchNotes` と `src/mcp/service.ts` は変更しない。
- Graph、FileTree、`50_履歴` の既定除外、Drive、本番 Vault は変更しない。
- `line:`、`block:`、`section:`、`task:`、regex、`OR`、wildcard、parentheses は実装しない。
- dependency と検索基盤を追加しない。

## 受入

- `docs/reports/assets/a2-1-search-operators/obsidian-1.13.4-query-results.json` の query matrix を integration test で全件固定する。
- parser unit test で空 query、演算子のみ、`tag:` 値の空白、日本語、大文字小文字、`-` 単独、未知演算子、閉じていない quote を固定する。
- 単一の従来語 query は Renderer 専用入口と既存 `searchNotes` の結果全体が同一である。
- 固定 JSON はObsidian Desktop 1.13.4の隔離実測結果であり、integration testの正本とする。
