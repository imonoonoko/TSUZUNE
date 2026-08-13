# Google OAuth scope reconnect correction — 2026-08-14

## Outcome

TSUZUNEの保存済みGoogle refresh tokenはファイルとして残り、Windows同一ユーザーで復号できたが、Google token endpointは`invalid_grant`（expired or revoked）を返した。再ログインではGoogleが`email`／`profile`をcanonical userinfo URLで返し、TSUZUNEの文字列完全一致判定が正当な認可を拒否した。

`email`と`https://www.googleapis.com/auth/userinfo.email`、`profile`と`https://www.googleapis.com/auth/userinfo.profile`だけを比較時に同値化した。OAuth要求scope、Driveの`drive.file`、Calendar scope、credential保存形式は変更していない。

## Evidence

- 実認証ファイル、account metadata、Drive ledgerは存在し、production profileは更新前後で不変だった。
- secretを出力・保存せずにrefreshを診断し、HTTP 400／`invalid_grant`を確認した。
- canonical userinfo scopeを返す公開接続テストをREDにし、`Googleで必要な権限がすべて許可されませんでした`で失敗することを確認した。
- 最小修正後、同テストを含むGoogle関連3 files／20 tests、typecheck、diff checkがPASSした。
- clean commit `f6e85f4`から公式`production:update`を実行し、62 files／609 tests、MCP、package、installer、packaged／installed smoke、hash、profile不変、MCP再登録の10/10 checksがPASSした。

## Remaining acceptance

修正版installed appでGoogleへ再認証し、Drive readが成功することを実runtimeで確認する。これが終わるまでdisposable live Drive acceptanceは開始しない。本番Vaultへのclassification applyは禁止を維持する。

## References

- `src/main/google-connection.ts`
- `tests/google-connection.test.ts`
- `docs/reports/production-update-latest.json`
- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
