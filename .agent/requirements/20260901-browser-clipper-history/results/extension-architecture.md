# Extension architecture evidence

調査日: 2026-09-01

## 結論

最小のローカル実装は、Manifest V3 の `activeTab` + `scripting` を使って明示的なクリック時だけ現在ページを読み取り、拡張の service worker から TSUZUNE の loopback HTTP capture endpoint へ送信する方式。拡張側は `http://127.0.0.1/*`（または `http://localhost/*`）だけを host permission にする。Chrome の match-pattern 仕様は localhost を全ポートに限定できる。サーバー側は loopback bind、厳密な path/method/content-size、固定された拡張 ID の `Origin` allow-list、さらにアプリ発行の pairing secret を要求し、失敗時は Markdown を作成せず明示的なエラーを返す。

これは Native Messaging より導入負担が小さく、Downloads/File System Access より「受信箱へ直接保存」を満たす。HTTP の認証設計が未実装なら採用してはいけない。

## 比較

| 方式 | 確認できる性質 | 評価 |
|---|---|---|
| Loopback HTTP | 拡張 service worker の cross-origin `fetch` は `host_permissions` が必要。`http://127.0.0.1/*` / `http://localhost/*` は有効。CORS とアプリ側認証が必要。 | 推奨。実装・更新が最小。ただし localhost は同一端末上の他プロセスからも到達し得るため、Origin だけに依存せず pairing secret を必須にする。 |
| Native Messaging | `nativeMessaging` 権限、ホスト manifest、Windows registry 登録、`allowed_origins` が必要。allowed origins に wildcard は使えず、Chrome/Edge の extension ID を登録する必要がある。 | セキュリティ境界は強いが、インストーラ/レジストリ/host process の追加で重い。将来の配布版向け。 |
| custom protocol | Chrome 公式の拡張APIとして TSUZUNE の受信を保証する資料は確認できず、URL長・OS登録・外部起動確認の設計が必要。 | MVP の直接書込み transport には採用しない。 |
| Downloads | `downloads` 権限が必要。filename は Downloads ディレクトリ相対で、絶対パスや `..` はエラー。 | Inbox の任意パスへ直接保存できず、導入後の手動移動が必要。fallback（.mdダウンロード）としてのみ有用。 |
| File System Access | picker は user gesture と secure context が必要で、ユーザーが選んだ場所への許可を得る設計。 | 初回フォルダ選択が必要で、TSUZUNE active Vault との整合を保証しにくい。fallback/明示エクスポート向け。 |

## 拡張権限・取得

`activeTab` は action/context-menu/shortcut の明示的操作時だけ現在タブの一時的 host access を付与し、遷移またはタブ終了で失効する。`scripting` と組み合わせて本文/選択範囲/YouTube の DOM メタデータを取得できる。`<all_urls>` や恒久的な全サイト権限は不要。

YouTube は URL、title、video ID、選択された transcript/本文（存在する場合）、現在時刻など、画面上で取得可能な情報に限定する。字幕全量の取得を MVP の前提にしない。

## service worker 境界

MV3 service worker は通常 30 秒の非活動で終了し、単一処理は 5 分、fetch 応答は 30 秒の制約がある。グローバル変数に pairing state を置かず `chrome.storage` へ保存する。capture は一回の bounded request とし、タイムアウト・アプリ未起動・401/403・413・409 を利用者向けエラーへ変換する。途中失敗時は部分ノートを作らない。

## extension ID

Native Messaging の `allowed_origins` や loopback `Origin` allow-list を使う場合、unpacked extension の ID を安定させるため manifest の `key` を固定する必要がある。Chrome 公式は開発時の一貫した ID のために manifest `key` を案内している。公開配布前は Chrome Web Store と Edge Add-ons の ID が異なるため、Native Messaging では両方の ID を登録する必要がある（Edge 公式）。

## 公式資料

- [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab): 明示操作時だけ一時的 host access。
- [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting): MV3 の script injection と `activeTab`/host permissions。
- [Cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests): service worker の `fetch` と host permissions、CORS、任意 URL fetch を避ける注意。
- [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns): `http://localhost/*` / `http://127.0.0.1/*` と全ポート対応。
- [Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): 30 秒 idle、30 秒 fetch 応答、5 分処理制約、状態永続化。
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging): `nativeMessaging`、host manifest、Windows registry、ID allow-list、message limits。
- [Edge Native Messaging](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging): Edge host manifest/registry と Chrome/Edge ID 登録要件。
- [Manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key): unpacked 開発時も含む extension ID 固定方法。
- [chrome.downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads): downloads 権限と Downloads 相対 filename 制約。
- [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access): picker/user gesture/secure context とユーザー許可。

## 未解決・実装前の確認

- TSUZUNE が既に loopback server を公開している場合、その bind address、CORS、既存認証方式と衝突しない endpoint を確認する。
- unpacked extension 用の固定 `key` をリポジトリへ置くか、Origin allow-list を pairing 登録時に動的に保存するかを決める。秘密鍵を配布物へ埋め込まない。
- Chrome と Edge の local host permission/CORS 実機挙動は、最終的な両ブラウザ smoke test で確認する。
- YouTube transcript の全量取得は未採用。ユーザー選択テキストまたは画面メタデータを source clip として保存する範囲が MVP。
