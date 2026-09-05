# Result 01 — Header action trace

現行headerの4操作は、既存handlerをそのまま再利用してActivity Railへ移せる。

- 更新: `handleUpdateAction`。phaseごとの確認・download・install分岐とinstall前`flushSave`を維持する。
- 設定: `openSettingsDialog`。draft初期化、AI review proposal取得、focus復帰を維持する。
- Google / 同期: `openGoogleDialog`。接続状態取得後に既存dialogを開く入口だけを移す。
- Vault切替: `chooseVault`。保存失敗保護、generation切替、現Vault維持を含むためIPCを直接呼ばない。

上部のブランド説明と等重量button列は削除可能。現在Vault名はVault切替buttonのaccessible nameとtooltipで保持し、native title barのTSUZUNE identityと重複するin-app brand barは残さない。modal中の`inert`境界はworkspaceへ維持し、dialog openerへのfocus復帰を回帰testで固定する。

