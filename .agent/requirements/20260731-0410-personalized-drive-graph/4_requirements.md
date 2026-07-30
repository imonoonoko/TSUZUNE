# Requirements

## Functional requirements

### GR-01 Local graph generation

全ノートから、解決済みWikiリンクだけを有向辺として構築する。同一辺、自己リンク、未作成、曖昧、不正なリンクはグラフ辺から除外する。

### GR-02 Local graph view

選択中ノートと、入出力方向で直接つながるノートを表示する。選択中ノートが孤立していても中心ノードを表示する。

### GR-03 Graph navigation

マウスクリックおよびキーボード操作でノートを選択できる。選択後もグラフ表示を維持し、新しいノートを中心に再描画する。

### GO-01 OAuth configuration

配布版は公開値であるDesktop OAuthクライアントIDだけをビルド時に組み込み、通常はJSON選択なしで接続できる。独自のDesktop OAuth JSONは詳細設定から任意選択でき、`installed.client_id`を検証して組み込みIDより優先する。不正な設定を保存しない。

### GO-02 OAuth login

システムブラウザで認可URLを開き、PKCEを使い、`127.0.0.1`の一時loopbackサーバーでコールバックを受ける。認可のstateを照合する。

### GO-03 Minimal scopes

要求する権限は `openid`、`email`、`profile`、`https://www.googleapis.com/auth/drive.file` に限定する。

### GO-04 Token storage

リフレッシュトークンはElectron `safeStorage`で暗号化してuserDataへ保存する。UI、ログ、Vault、Git管理対象へ出力しない。

### GO-05 Disconnect

保存済みトークンとローカルアカウント状態を消去できる。Drive上のファイルは削除しない。

### DS-01 Dedicated folder

Drive上にTSUZUNE専用フォルダを1つ作成または再利用する。対象外フォルダを走査しない。

### DS-02 Sync plan

同期実行前に、アップロード、ダウンロード、変更なし、競合の件数と対象パスを返す。

### DS-03 Manual execution

同期は利用者の明示操作でのみ開始する。アプリ起動や編集だけでは通信しない。

### DS-04 Non-destructive changes

削除は同期しない。同期履歴がない片側だけのMarkdownは反対側へ新規追加する。以前同期した対応が片側で欠落した場合は削除として報告し、残存側を削除も自動復元もしない。

### DS-05 Conflicts

最後の同期以降に同一パスが両側で変更された場合、ローカル版を元パスの正本としてDriveへ反映し、取得した旧リモート版を競合コピーとしてローカルとDriveの両方へ保存する。どちらの内容も失わない。

### DS-06 Existing Vault pairing

別端末では、同じGoogleアカウントとDesktop OAuthクライアント設定を使い、TSUZUNEが作成した既存Drive Vaultを一覧から明示的に選んで空または未同期のローカルVaultへ対応付けられる。同期済みVaultを別のDrive Vaultへ無言で切り替えない。

### DS-07 Partial-failure checkpoint

同期中に後続処理が失敗しても、完了済みのファイル対応と版情報をその都度チェックポイントへ保存し、次回同期で完了済み操作を誤って競合扱いしない。

### DS-08 Markdown source

ローカルMarkdownは通常どおり他のエディタで読める。同期機能が使えなくてもノート編集を継続できる。

## Non-functional requirements

- Windows 1台・個人利用を最優先にする。
- 新しい実行時依存は、明確な価値がない限り追加しない。
- Google未設定・オフライン・認証失敗時に通常のノート操作を壊さない。
- ファイルパスはVault境界を越えない。
- 同期処理はテスト時にHTTPとブラウザ起動を差し替えられる。
- UIから見えるエラーは日本語で、再試行に必要な行動を示す。

## Acceptance criteria

1. A→B、C→Aのノートで、Aを中心にB/Cと方向が表示される。
2. グラフノードをクリックまたはEnterで選択し、表示が再中心化する。
3. 未解決リンクはグラフに出ないが、既存の関連一覧には残る。
4. 組み込みOAuthクライアントIDがある場合は「Googleでログイン」を直接表示し、ない場合だけJSON設定案内を表示する。どちらでもノート操作は正常に動く。
5. モックOAuthでPKCE、state照合、トークン保存、切断が検証できる。
6. モックDriveでアップロード、ダウンロード、変更なし、競合コピーを検証できる。
7. 同期で削除が起きない。
8. 既存Drive Vaultを一覧から選択し、未同期のローカルVaultへ対応付けられる。
9. 同期の途中失敗後も、完了済み操作のチェックポイントから安全に再開できる。
10. typecheck、全自動テスト、MCPスモーク、production buildが成功する。
11. 実Google認証はTSUZUNE用クライアントIDを組み込んだ配布ビルドによる手動確認項目として明示される。
