# Scope

## In scope

### Local graph

- 選択中ノートを中心にした1-hop Wikiリンクグラフ
- 解決済みリンクの方向表示
- バックリンクを含む隣接ノート表示
- 孤立ノートの単独表示
- ノード選択によるノート移動と再中心化
- キーボードで操作できるノード
- 既存の編集・プレビュー・自動保存との共存

### Google connection

- Google OAuthクライアントJSONの選択と検証
- システムブラウザ、PKCE、loopbackによるログイン
- `openid email profile` と `drive.file` のみ要求
- 認証状態とアカウント表示
- OS保護領域を利用したリフレッシュトークン保存
- 明示的な切断

### Drive sync

- Google Drive内のTSUZUNE専用フォルダ
- Markdownファイルの手動アップロードとダウンロード
- 同期前の計画表示
- ローカルのみ、リモートのみ、片側変更の同期
- 両側変更時の競合コピー
- 削除の自動伝播なし
- 同期メタデータは再構築可能な補助情報として扱う

### Documentation

- Google Cloud側の設定方法
- 権限範囲と取得できない情報
- 同期規則と競合時の挙動
- 実アカウントでの手動確認手順

## Out of scope

- Google内部の広告プロファイル取得
- Googleの非公開検索履歴取得
- Gmail、Calendar、Photos、Chrome履歴の取得
- Drive全体の無差別スキャン
- 自動バックグラウンド同期
- リモート削除またはローカル削除の伝播
- 複数ユーザー、共有編集、チーム権限
- 全Vault力学グラフ、pan、zoom、drag
- グラフDB、SQLite必須化
- AIによる無承認の個人情報抽出・原本書換え
