# Search History Exclusion Requirements

## 1. Overview

MCP `search` の結果から `50_履歴/**`(監査履歴)を既定で除外し、`include_history` オプションで明示的に含められるようにする。目的は、AI更新履歴(監査ノート)が検索結果を埋めて目的の知識ノートが発見できない問題の解消。実測では `"X1-T1 本番反映"` の検索で9件中8件が履歴ノートだった。

## 2. User Stories

- AIエージェントとして、通常ノート・知識ノートを検索したとき、AI更新履歴の監査ノートに埋もれずに目的のノートを見つけたい。
- AIエージェントとして、履歴を含めた検索が必要なときは明示的に `include_history: true` で従来挙動を復元したい。
- 監査用途では、`fetch` や `get_backlinks` による履歴へのアクセスを維持したい(検索除外はsearchに限定)。

## 3. Acceptance Criteria

### History exclusion

- Given 50_履歴にのみ一致するクエリ、when `search` を既定で呼ぶ、then resultsは空になる。
- Given 同上、when `include_history=true` で呼ぶ、then 履歴ノートを含むresultsを返す。
- Given `include_history` を省略、then 既定 false として履歴を除外する(オプション省略時の挙動が安定)。

### Normal notes and sources unaffected

- Given 通常ノートに一致するクエリ、when `search` を既定で呼ぶ、then 従来と同じ通常ノート結果を返し、履歴は含まない。
- Given 履歴と通常の両方に一致するクエリ、when 既定で呼ぶ、then 通常ノートのみ。when `include_history=true`、then 両方を含む。
- Given 40_情報源の証拠ノートにのみ一致するクエリ、when `search` を既定で呼ぶ、then 証拠ノートは除外されず結果に残る(除外は50_履歴のみ)。
- Given `tag:` クエリ、when `search` を既定で呼ぶ、then 履歴のタグはマッチせず、通常ノートのみ返す。

### Existing behavior preserved

- Given `limit` 指定、when `search` を呼ぶ、then limitは従来通り適用される(履歴除外後の集合に対して)。
- Given `include_history=true`、when 従来の履歴込み挙動と比較する、then パリティ(同一結果)を返す。
- Given `fetch`(50_履歴のpath指定)、when 実行する、then 今回の除外の影響を受けず従来通り取得できる。
- Given `get_backlinks`(履歴からのbacklink)、when 実行する、then 今回の除外の影響を受けず従来通り返す。

## 4. Nonfunctional Requirements

- 除外は配列フィルタのみで、検索パフォーマンスを悪化させない(むしろ対象が減る)。
- ツールschemaの追加は optional のみで、既存クライアントを破壊しない。
- オプション名 `include_history` は `build_context` と同名だが意味が異なる(search: 50_履歴フォルダ / build_context: temporal状態)。説明文で区別を明記する。
- 除外フォルダは `DEFAULT_SEARCH_EXCLUDED_PATHS` 定数で単一ソース化し、将来のUI除外設定共有スライスと二重管理しない。
- 本スライスはsearchのみ。「AI revisionをGraph・Contextから除外」は別スライスとして保留。
