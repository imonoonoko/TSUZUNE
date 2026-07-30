# Discussion Log

## 2026-07-31

### User intent

- TSUZUNEを試作品ではなく、本人が日常運用できる個人用ノートへ育てる。
- 本人に関する情報を、本人が許可した情報源から増やせるようにする。
- Googleログイン、Google Drive同期、Wikiリンクのグラフ表示を実装したい。

### Clarified product boundaries

- Googleログインだけでは個人情報は増えない。本人が明示的に許可したDrive上のTSUZUNEデータを同期対象にする。
- Googleの内部広告プロファイル、非公開の検索履歴、Googleが内部利用する推定属性は通常のOAuth APIでは取得しない。
- ローカルMarkdownを原本として維持する。同期のために独自DBを必須にしない。
- 初版の同期は手動実行とし、ローカル削除・リモート削除を自動伝播しない。
- 以前同期したファイルが片側で欠落した場合は削除として報告し、残存側を勝手に削除も復元もしない。履歴のない片側ファイルだけを新規コピーする。
- 同じノートが両側で変化した場合は片方を黙って上書きせず、競合コピーを作る。
- 初版グラフは全Vaultを蜘蛛の巣状に表示せず、選択ノートと1段階のWikiリンクだけを表示する。

### Delivery decision

1. 純粋関数とUIテストからローカルグラフを実装する。
2. Google OAuth設定、認証状態、手動同期の境界を実装する。
3. OAuthクライアント設定がない環境でも、同期計画とエラー表示をテスト可能にする。
4. 実Googleアカウントへの最終接続は、利用者自身のGoogle Cloud OAuthクライアントJSONを用いて確認する。

### Standard Google login follow-up

- 通常利用で各端末にOAuth JSONを選ばせず、TSUZUNE用Desktop OAuthクライアントIDを配布ビルドへ組み込む方針を採用した。
- client IDは公開値として扱い、client secret、token、アカウント情報は組み込まない。
- 独自OAuth JSONは上級者向けの詳細設定として残し、保存済みJSONを組み込みIDより優先する。
- 実クライアントIDの発行と実Googleアカウント確認は、コードのローカル検証とは分けて未完了として扱う。
