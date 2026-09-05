# TSUZUNE Sync Core v2 Scope

## MVP

- provider非依存の同期判定core。
- 既存Google Drive adapterの再利用。
- stable logical file IDとpath変更の分離。
- Markdownと対応添付の双方向同期。
- 明示tombstoneによる削除伝播と再起動復旧。
- 両側変更時の無損失競合保全。
- 利用者が閲覧・復元できるノートと添付の版履歴。
- file watcher、network復帰、起動時による自動同期。重複実行は直列化する。
- 同期状態、最終成功、競合、停止理由を利用者へ表示する。

## Nice To Have

- Markdownの安全な三方merge候補。
- folder／file種別ごとの選択同期。
- bandwidthとbatteryを考慮した実行policy。

## Future

- remote E2EE。
- 専用TSUZUNE remote adapter。
- mobile clientとmobile background sync。
- 複数人collaboration。

## Out Of Scope

- 最初のsliceでの専用server、account、subscription、push notification。
- 新DBをMarkdownの読取に必須化すること。
- production Vaultへの自動apply。
- 既存Drive objectの一括migration。
- 競合内容の推測による自動破棄。

## Constraints

- Markdownと添付ファイルが正本。
- 現行manual Drive同期は移行完了まで利用可能に保つ。
- 既存Google OAuth tokenはOS暗号化store以外へ複製しない。
- foundation sliceでは外部依存を追加しない。
- source実装、packaged、installed、live multi-device受入を別の証拠境界として扱う。

