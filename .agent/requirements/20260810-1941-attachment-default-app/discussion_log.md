# GP0-3b-n Attachment Default App Discussion Log

## 2026-08-10 19:41 JST — 設計開始

- ユーザーは、現行作業の次に何をするかを考え、実装前に設計するよう依頼した。
- 本番TSUZUNE、`PLAN.md`、`PROJECT_STATUS.md`、Graph parity資料、現行sourceとtestsを照合した。
- Current Transition Queueの次項目は、添付nodeの`デフォルトアプリで開く`をObsidian 1.13.4と固定比較するGP0-3b-nで一致した。
- 本turnは設計だけを行う。製品source、固定参照、capture、本番binaryは変更しない。

## 確認した現行経路

- `WikiGraphView`は実在attachmentをdouble clickすると既存`onOpen(path)`を呼ぶ。
- `App.openGraphNode`はattachmentを既存`window.tsuzune.openVaultFile(path)`へ渡し、失敗を共通messageへ出す。
- main processはtrusted rendererだけを受け、`VaultService.resolveFileForOpen`でVault相対path、対応種類、実在file、symlink境界を検査してからElectron `shell.openPath`を呼ぶ。
- Attachment Previewにも同じ経路があり、実装済みtestsで利用されている。

## 決定

1. 次sliceはGP0-3b-nを維持する。
2. 製品差分は、実在attachmentのcontext menuへ1項目を追加して既存`onOpen(path)`を再利用する案を第一候補とする。
3. 新しいIPC、preload API、renderer prop、外部起動service、依存関係は作らない。
4. 先に固定Obsidian 1.13.4の動作を安全に記録し、観測が想定と違えば製品実装前に設計を更新する。
5. 比較中は外部アプリを実際に起動しない。Obsidianではrendererの`window.open`、TSUZUNEではmain import前の`electron.shell.openPath`をfail-closedで差し替え、要求だけを記録する。
6. このsliceでは`フォルダで表示`、Explorer表示、OS関連付けの正しさ、実アプリ起動成功を扱わない。

## 解決した問い

- **新しい起動経路は必要か:** 不要。既存経路がGraph double clickとAttachment Previewで利用済み。
- **context menu専用propは必要か:** 不要。attachment分岐内で既存`onOpen`を呼べる。
- **実OSアプリを起動して比較するか:** しない。安全性と決定性のためrequest境界でinterceptする。
- **cancel scenarioは必要か:** 不要。アプリ内確認dialogはなく、OS chooserのcancelは製品へ結果を返さない。
- **missing／unsupportedを参照captureするか:** しない。既存backend regressionを再利用し、今回の新規失敗回帰はAppのexternal-open failureだけに限定する。

## Open Questions

- 固定Obsidian captureで、静的確認済みのindex 7、`リンクされたビューを開く`の直後、`フォルダで表示`の直前、有効状態、選択後のmenu close、`window.open`引数が動的にも一致するか。
- TSUZUNE captureで、既存safe routeを通った後の`electron.shell.openPath`がexact fixture absolute pathを1回だけ受けるか。
- 失敗時のrenderer messageを今回のApp回帰testへ足す必要があるか、既存error testで十分か。実装開始時に既存coverageを再確認して最小を選ぶ。

## 2026-08-10 — 初回固定captureの停止と設計修正

- 固定hash、hook設置、実外部起動遮断、menu操作、同一process内のGraph再表示、hook復元、Vault不変は成立した。
- 初回captureは成功扱いにしなかった。唯一の不一致は、Obsidianが`window.open`へfilesystem absolute pathではなく`file:///.../attachments/diagram.svg`を渡したことである。
- expectedはNode標準`pathToFileURL`相当のexact file URLへ修正し、TSUZUNEの`shell.openPath` absolute pathとは同じfixture file identityとして比較する。
- 固定Obsidianの別processは、renderer hook設置前の起動区間を遮断できないため再実行しない。再起動時のrequest非再生は未観測・未確立として残し、共通parityはactionと同一process内のGraph再表示までに限定する。
- 初回failed packetは完了証拠に使わず、修正後の安全なcaptureを1回だけ行ってから製品実装へ進む。

## 2026-08-10 — 実装・固定比較の完了

- 修正版の固定Obsidian captureは29/29 assertionsを満たした。`window.open`はsanitized file URLと`_external`を1回受け、同一process内のGraph再表示後も1回のままである。
- TSUZUNEは実在attachment menuへexact labelを1件追加し、既存`onOpen`、`openVaultFile`、trusted IPC、Vault validation、`electron.shell.openPath`を再利用した。新IPC、preload API、service、dependencyは追加していない。
- TSUZUNE captureは23/23 assertionsを満たした。`shell.openPath`はsanitized absolute pathを1回受け、Graph再表示後も1回、別process再起動後は0回である。
- comparison builderはmanifestだけに依存せず、固定Obsidian raw observationのquery、camera、node ID集合、edge signature、Graph tab／leafをaction前、直後、同一process再表示後で直接比較する。
- 全508 tests、typecheck、MCP検査を通過した。commit／push／本番更新は最終delivery gateで確定する。
- 判定は`matched-core-behavior`。実OS既定appの選択・起動、chooser／cancel、Obsidian別process再起動、物理入力、実OS accessibility、pixel identityは未証明のまま残す。

## Initial Design Stop Condition

要件、UI差分、安全なcapture契約、受入条件、非目標を本packageへ固定し、`PLAN.md`と`PROJECT_STATUS.md`から参照できた時点で設計turnを終了する。実装は次の明示指示まで開始しない。
