# 画像コピー＆ペースト — 2026-10-02

## 利用方法と変更範囲

ノートの編集／Live Preview本文で画像をCtrl+Vする。ClipboardEventの画像Fileを受け取り、preloadのpasteImageから人間用trusted IPCへ渡す。mainのElectron nativeImageでPNG／JPEGを検証・PNGへ変換し、ノートと同じフォルダへPasted image日時＋UUID.pngとして保存する。成功後に既存の画像表示で読めるWiki画像リンクを挿入する。HTML本文・画像URLだけのテキストは取得せず、通常pasteを維持する。

既存ファイルを上書きせず、1画像20MBまで。空・非画像・変換後20MB超過を拒否する。現行のノートパス・Vault scopeを検査し、読取後・書込前・公開前に世代とsymlinkを確認する。ノート本文の保存は既存自動保存を使う。失敗時は本文へリンクを挿入しない。保存中の追加入力には挿入位置を追随させ、選択中の本文が変更された場合は置換せず停止する。ノートを切り替えた場合は別のeditorへ挿入しない。画像ファイル保存後の切替／挿入停止では保存した添付を残す。Undoでリンクを取り消しても画像ファイルは削除しない。

MCP catalog・書込権限・承認設定は変更しない。新依存、DB、clipboard常時監視は追加しない。nativeImageのPNG／JPEG・PNG保存契約は[公式資料](https://www.electronjs.org/docs/latest/api/native-image)を確認した。

## 検証と証拠

- focused検査61件PASS（新規画像paste、既存editor、Vault、IPC）。Source／Live Preview、Undo、遅延保存時の位置、選択本文変更、editor交換、read-only／IME、サイズ制限、trusted sender、scope変更、無効画像、本文BOM／CRLF／コメントの保存側保全を確認。
- 隔離実Electronは5項目PASS。実renderer→preload→main→Vault保存と自動保存、PNG表示、Live Previewでの別ファイル保存、非画像で本文・添付不変、通常テキストpaste保存。親checkoutのwork/image-paste/source-smoke.json。
- 変更確定後のnpm testは1,757 PASS／1 SKIP。typecheck、check:mcp、current-decision workflow、差分検査はPASS。本番gateの結果は最新receiptとwork/image-paste/final-delivery-evidence.jsonに残す。初回実アプリ検査はcanonical Vault path比較の不足を検出して修正。初回全体testは修正中の新旧source混在で1件失敗し、変更確定後に再実行する。終了コードだけで受入しない。
- OS clipboardには触れず、PNG Fileを含む合成ClipboardEventを使う。実際のOS clipboard／Ctrl+V、利用者の画像コピー元による違いは未確認。利用者確認と自動検査を分ける。

## 配布境界

基準は2026-10-01T11:43:43.947Zのverified receiptとexact source archive。1,721 files、digest d99b47175482b8052b58b9f9b20c7365a731ffd6b229bd2de9dd0ea696521d90の一致を確認してから今回差分を追加した。候補はwork/image-paste/source-isolated。元checkoutの並行変更は保持し昇格しない。所有差分を同期し、競合する同一pathは3-way mergeの追加／削除行一致を検査する。監査はwork/image-paste/source-sync-final.json。

文書確定後にproduction:updateで隔離packaged／installed smoke、exe／app.asar、通常profile不変、MCP登録を確認する。本番アプリを強制終了しない。本番Vaultを試験に使わない。導入後の画像貼り付け経路の隔離installed検査はwork/image-paste/installed-smoke.json、導入結果は最新receiptを参照。repositoryのfingerprint対象文書をgate後に書き換えず、最終結果はexcluded receiptとVaultに残す。Git公開は対象外。
