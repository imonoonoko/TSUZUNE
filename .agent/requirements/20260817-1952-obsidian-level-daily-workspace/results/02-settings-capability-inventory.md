# Result 02 — Settings capability inventory

現行AppSettingsと既存IPCの範囲で再編できる設定は三群である。

1. ファイルとリンク: Vault一覧・検索・リンク・Graphから除外するpath／正規表現。
2. テンプレート: template directory、内蔵template表示、Explorer reveal。
3. AIとレビュー: review対象path、pending proposalの比較・取消・承認。

永続shape、Google OAuth情報、Vault data、AI review履歴は変更しない。Google、更新、Vault切替は即時app操作なので設定項目へ偽装せずActivity Railから既存dialog／handlerへ到達させる。

外観、font、UI density、hotkey変更、attachment保存方針、editor設定、privacy表示、設定export/resetは未実装であり、新しいpersistenceと適用経路を個別に契約化するまでこのsliceへ含めない。

