# UI design prompt

TSUZUNEの既存ファイルツリーを保ち、常用のフォルダ操作を同じ場所で完結させる。新しいフォルダ管理画面は作らない。

## Required interactions

- ツリー上部の「フォルダ」は、現在選択中のフォルダ直下でinline name editorを開く。
- フォルダcontext menuは「新しいノート」「新しいサブフォルダ」「名前変更」「移動」「ゴミ箱へ」を持つ。
- 名前変更は既存inline rename、移動は既存Move dialog、drag-and-dropも同じpreflight/apply経路を使う。
- source自身と子孫は移動先として選択不能にする。
- cleanな単一ノート移動は追加確認を出さず、既存の自動採番を維持する。
- フォルダ移動は衝突時に自動採番せず、衝突pathを示して止める。
- `50_履歴`と配下では「名前変更」「移動」「ゴミ箱へ」を無効化し、理由をtooltipで示す。別pathから`50_履歴`内への移動も拒否する。
- `40_情報源`は人間UIで通常どおり再分類できる。

## Folder move confirmation

フォルダ移動、リンク影響あり、Drive追跡対象ありの時だけ確認dialogを表示する。

- `資料` → `30_知識/資料`
- ノート、添付、サブフォルダの件数
- 影響を受けるWikiリンク件数と最大3例
- Drive追跡対象件数と「同じDriveファイルとして移動」
- primary: `移動する`
- secondary: `キャンセル`

衝突、保護違反、stale時はprimaryを表示しない。

## Error and recovery behavior

- stale: 「フォルダ内容が変わりました。確認し直してください。」
- rollback成功: 「移動できなかったため、元の場所へ戻しました。」
- `RECOVERY_REQUIRED`: 通常toastにせず、ファイルツリー上部へ固定bannerを出す。対象の旧path、新path、TSUZUNEが新しい移動を停止していることを表示する。自動で片方を削除・上書きしない。
- 部分成功を成功toastで隠さない。

## Deferred UI

- 大規模分類dashboard、フォルダ色、アイコン、rule builder、smart folder。
- 一括選択・一括移動。
- Move dialog検索。
- trash復元UI。
