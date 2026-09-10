# 欠落タブ通知と前回配置の整理 — 2026-09-09

## 原因と変更

利用者が提示した`01_受信箱/2026-09-08-151131 - YouTube.md`の通知は、起動時に前回配置のpathが現在のVaultに見つからないために出ていた。本番MCP検索では当該pathのノートはなく、`00_入口/受信箱地図.md`には2026-09-08 19:52 JSTに派生知識作成後のtrashが成功した記録がある。派生ノート`30_知識/検索用ベクトルと回答根拠の本文を分ける.md`は現在取得でき、出典URLも残る。今回の調査で原典の復元・削除・移動は行っていない。trash内の実体は今回未取得であり、退避については既存記録の証拠である。

通知用の`.workspace-missing-banner`にはCSS定義がなかった。承認撤去前後のexact archive（`work/production-source-gD9Wgp`／`work/production-source-RtBswt`）も同じであり、直前の承認機能撤去によるCSS削除ではない。

- 既存bannerのレイアウトとwarning色を適用し、ファイル一覧を展開できるコンパクトな通知にした。狭い画面では折り返し、長いpathや多件数は範囲内で表示する。
- 「見つからないタブを前回の配置から外す」を追加。既存の世代・Vault範囲を確認する保存経路で、現在のタブ配置をlastSessionへ保存する。成功後だけ通知を消し、残るタブまたはファイル入口へfocusを戻す。
- 「閉じる」は通知だけを隠す。起動／通知を閉じる／アプリ終了だけでは欠落参照を自動破棄しない。保存失敗時は通知と再試行操作を保持する。
- ノート本文、移動／trash、名前付き保存には書き込まない。既存の明示的なタブ・表示変更によるlastSession更新は維持する。

## 検証済み範囲

| 検証 | 結果と証明する範囲 |
|---|---|
| 変更前の隔離Electron再現 | 通知が`display: block`、75pxで、欠落参照を外す操作がないことを確認 |
| `npm run typecheck` | PASS |
| App safety／Workspace service／Workspace schema | 3 files、126 tests PASS。追加2ケースは修正前に対象buttonなしでFAIL、修正後に保存成功／失敗の両方PASS。通知だけ閉じる場合の保存抑止も確認 |
| 隔離Electronで変更後を操作 | 通常幅で48pxのflex表示、800px幅で横溢れなし。明示操作後の再読込で通知なし、名前付き配置・残存ノート本文不変 |
| 限定した独立review／Ponytail review | PASS。現在のtask差分を前回の本番archiveと比較。保存失敗・世代境界・全タブ欠落時のfocusを確認 |

UIの証拠は`work/missing-tab-notice/{before,after,after-expanded,after-narrow}.png`と`before.json`／`after.json`、隔離確認scriptは`work/check-missing-tabs.mjs`。fixture設定のキー正規化と日時形式の誤りを修正して再現条件を成立させた。実Vaultと本番profileはこの確認に使わない。利用者による実画面の受入は別の境界である。

## 本番反映・終了条件

開始時の`delivery_info`はmatch、呼出元MCPはfresh。開始receiptは`2026-09-08T19:09:31.514Z`のinstalled-and-verified、exact archiveは`work/production-source-RtBswt`。既存dirty変更を保持し、このarchiveからの今回の差分だけを確認する。

関係文書を確定後、利用者がアプリを通常終了した状態で`npm run production:update`を実行する。[最新receipt](production-update-latest.json)のsource fingerprint、全gate成功、exe／app.asar hash一致、本番profile不変で本番反映を判定する。起動中の利用者アプリは強制終了しない。gate後にfingerprint対象を変更しない。

最後に本番Vaultへ本件の実施記録を一件保存し、運用標準と開発資料入口の影響箇所に導線を付け、read-back・一意検索・リンク確認を行う。MCP再buildで呼出元がstaleなら、Codex再起動後にruntime／deliveryを確認して未同期分だけ再開する。成功済みの検査やproduction gateは同期のためだけに繰り返さない。本書だけで本番反映やVault同期済みとは判定しない。
