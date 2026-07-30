# Implementation Brief

## Order

1. `src/core/graph.ts`のテストを先に追加する。
2. `WikiGraphView`の表示・操作テストを追加する。
3. Appへgraphモードを統合する。
4. OAuth設定・PKCE・state検証・token storeを純粋ロジック中心にテストする。
5. Drive RESTクライアントを小さな境界として追加する。
6. 同期計画を純粋関数で作り、アップロード・ダウンロード・競合をテストする。
7. Main IPC、preload、shared types、Google設定UIを接続する。
8. READMEとPLANを実装結果に合わせて更新する。

## Primary files

- `src/core/graph.ts`
- `src/renderer/components/WikiGraphView.tsx`
- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `src/main/google-auth.ts`
- `src/main/secure-token-store.ts`
- `src/main/google-oauth-flow.ts`
- `src/main/google-connection.ts`
- `src/main/google-drive.ts`
- `src/core/drive-sync.ts`
- `src/main/drive-sync-service.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `tests/graph.test.ts`
- `tests/wiki-graph-view.test.tsx`
- `tests/google-auth.test.ts`
- `tests/drive-sync.test.ts`

## Constraints

- Wikiリンク解析は既存関数を再利用する。
- OAuth/DriveはNode標準の`fetch`とElectron APIを優先し、大型Google SDKを追加しない。
- Googleのclient secretを秘密として依存しない。Desktop OAuthクライアントは公開クライアントとして扱う。
- access tokenは必要時に更新し、長期保存はrefresh tokenだけに限定する。
- 同期メタデータは秘密情報を含めず、削除しても再構築できる形にする。
- Drive削除APIは実装しない。
- MCPへGoogle操作を公開しない。

## Stop conditions

- Drive同期がVault外へ書き込む可能性がある。
- 競合時に一方を失う。
- `drive.file`より広い権限が必要になる。
- Google認証失敗が通常のローカル編集を壊す。
- 新機能のためにSQLite、グラフDB、常駐サービスが必須になる。
