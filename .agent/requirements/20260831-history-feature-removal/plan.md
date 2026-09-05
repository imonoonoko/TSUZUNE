# TSUZUNE 履歴機能廃止計画

## Task Contract

- objective: 利用者が不要と判断したTSUZUNEの履歴機能を廃止し、通常ノートの検索・編集・文脈利用から履歴という製品責務をなくす。
- deliverables:
  - AI更新・部分更新・リンク操作などからの新規履歴生成を停止するsource変更
  - `include_history`、`history_path`、履歴保護・圧縮・History Store v2など履歴専用の公開契約と不要コードの整理
  - 通常ノートのrevision競合防止、原典保護、失敗時データ保全を維持する公開挙動テスト
  - 既存`50_履歴`の物理削除について、正確な対象・影響・復元性を示す別の破壊的実行gate
  - source検証、本番更新、installed/live受入、TSUZUNE正本への最終記録
- constraints:
  - 既存のdirty worktreeと利用者の変更を保全し、task-owned差分だけを扱う。
  - 既存`50_履歴`データは、明示的な削除承認を得るまで変更・移動・削除しない。
  - 人間が作成した通常ノート、実施記録、原典、project資料を「履歴」という語だけで一括削除しない。
  - Markdown正本、revision照合、原典保護、競合時の無変更、active Vaultを自動smokeで開かない境界を維持する。
  - 新規DB、archive、daemon、Hook、cache、依存package、代替履歴機構を追加しない。
- success:
  1. 通常の更新・patch・リンク操作で履歴ファイルが新規生成されず、MCP公開契約から履歴opt-in／history pathが消える。
  2. 通常検索・backlink・context・安全なnote mutationが履歴なしで動き、revision競合と原典保護がテストで維持される。
  3. required source gates、production update、installed/live acceptance、正本同期が完了する。既存履歴の削除は別gateとして明示される。
- lane: Orchestrated
- evidence: targeted RED/GREEN tests、typecheck、full tests、`check:mcp`、production receipt、installed hashes/profile保全、fresh runtime、TSUZUNE read-back。
- stop: 既存履歴データの削除、時間文脈そのものの廃止、原典保護の緩和など、不可逆または意味範囲を広げる操作には進まず、影響を示して利用者判断へ上げる。

## Adopted interpretation

「履歴機能そのものを廃止」は、まず製品が履歴を新規生成・公開・参照する責務をなくすこととして実装する。既存`50_履歴`の物理削除は同じ目的の次段だが、不可逆性があるため正確なpreviewと明示承認を分離する。通常の実施記録や時間メタデータ付き知識ノートは自動履歴ではないため、名前だけで削除対象にしない。

## State machine

`discovered -> contracted -> executing -> verifying -> persisted -> complete`

現在: `complete`（source・本番反映・fresh MCP・TSUZUNE正本read-backを検証済み）

## Work breakdown

1. 履歴の生成、参照、公開契約、時間文脈、保護境界を実行経路別に分類する。
2. 公開挙動の失敗テストを先に追加し、履歴生成停止と契約削除を縦に実装する。
3. History Store v2、圧縮・計測script、履歴専用test/docの不要物を最小範囲で削除する。
4. targeted、typecheck、full、MCP contract/smokeを実行する。
5. production updateとinstalled/live受入を行う。
6. final evidenceを正本へ一度だけ書き戻し、既存データ削除gateを提示する。

## Verified boundary

- 履歴生成経路、公開`include_history`、`history_path`、移動監査入力を撤去した。
- History Store v2と履歴専用の圧縮・計測コードは、未配線のため代替機構を作らず削除した。
- 内部のknowledge-time／`as_of` selectorは、自動履歴とは別責務なので維持した。
- `typecheck`、全テスト867件、MCP contract/smoke、本番パッケージ・installed smoke・hash・profile不変を確認した。
- 本番更新後のfresh MCPを別プロセスで起動し、`stale_runtime:false`、`delivery_info:match`、履歴入力／出力なしのschemaを確認した。その経路で実施記録と6つの正本導線を各一回だけ更新し、一意検索・read-back・6 backlinksを確認した。

## Explicit exclusions

- 既存`50_履歴`の無承認削除・移動・一括書換え
- Git履歴のrewrite
- 通常の実施記録、出典、時間メタデータ付き知識ノートの一括廃止
- 代替archive、database、圧縮store、復元serviceの追加
- active Vaultを使った自動smoke
