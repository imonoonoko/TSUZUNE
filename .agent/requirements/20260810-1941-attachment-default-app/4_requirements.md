# GP0-3b-n Attachment Default App Requirements

## 1. Overview

固定Obsidian 1.13.4のattachment context menuから`デフォルトアプリで開く`を観測し、TSUZUNEへ同じ中核操作を最小差分で追加する。外部アプリは実際に起動せず、両製品がOS外部open境界へ渡すrequestを安全に記録する。

本書がGP0-3b-nの正本である。初回設計checkpointは実装、capture、本番更新を行わず停止し、その後の明示指示で固定参照captureを開始した。

実行結果は`matched-core-behavior`である。両製品は同じ`attachments/diagram.svg`への外部open requestを1回だけ発行し、menu close、Graph／Vault保持、同一process内のGraph再表示での非再生を満たした。API表現、再起動の観測範囲、未証明の実OS動作は[comparison](../../../docs/reports/assets/graph-gp0-attachment-default-app/comparison.json)を正本とする。

## 2. Fixed Comparison Input

- 固定Obsidian: 1.13.4。installer SHA-256は`8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0`、asar SHA-256は`51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`とし、不一致時は停止する。
- fixture: `fixtures/obsidian-graph-parity-vault`。
- target: `attachments/diagram.svg`。`00_Home.md`から解決される実在attachment。
- view: Global Graph、attachments表示、空query、1265x768、DPR 1、light、隔離Vault／userData。
- TSUZUNE側も同じ相対pathと同等Graph fixtureを使う。

## 3. Functional Requirements

### R1. Reference First

- 製品変更前に固定Obsidianでmenu文言、順序、有効状態、request、menu closeを記録する。
- 固定asarと既存menu evidenceでは、11項目中index 7の`デフォルトアプリで開く`が`リンクされたビューを開く`の直後、`フォルダで表示`の直前にあり、有効である。動的captureが違えば、実装せず本書を更新する。
- 既知の順序は、title、`新規タブに開く`、`新規ウィンドウで開く`、`ファイルを移動…`、`ブックマーク…`、`パスをコピー`、`リンクされたビューを開く`、`デフォルトアプリで開く`、`フォルダで表示`、`ファイルエクスプローラでファイルを表示`、`ファイルを削除`である。

### R2. Menu Availability

- TSUZUNEでは、実在するfile-backed attachment nodeにだけ`デフォルトアプリで開く`を表示する。
- `リンクされたビューを開く`の後、`ファイルを削除`の前へ置く。
- tag、folder、未解決nodeには表示しない。
- note nodeへの表示は本sliceのparity claimへ含めない。

### R3. Existing Safe Open Route

- 選択時は既存`WikiGraphView.onOpen(path)`をexact relative pathで1回呼び、menuを閉じる。
- Appの既存attachment分岐から`window.tsuzune.openVaultFile(path)`を使う。
- main processのtrusted sender確認、`VaultService.resolveFileForOpen`、Electron `shell.openPath`を維持する。
- rendererへabsolute path、Electron shell、Node child processを公開しない。

### R4. Failure Behavior

- missing、unsupported、directory、Vault外path、symlink traversalは外部open APIへ到達させない。
- `shell.openPath`が非空errorを返した場合は既存error resultと共通messageを使う。
- 失敗時もGraph tab、query、camera、node／edge集合、Vault内容を変えない。

### R5. Safe Capture

- Obsidianはrendererの`window.open`をaction直前に差し替え、`url`、`target`、call countだけを記録する。期待値は、固定fixtureの実ファイルを表す`file:///<OBSIDIAN_VAULT_ROOT>/attachments/diagram.svg`とtarget `_external`である。
- TSUZUNEはcandidate processのmain import前に`electron.shell.openPath`を差し替え、IPCとVault validationは実経路を通す。
- API固有表現は一致条件にしない。Obsidianのfile URLとTSUZUNEのabsolute filesystem pathが、各隔離Vault内の同じ相対file identityを指すことを比較する。
- hookの設置identityと復元identityをassertし、`finally`で必ず復元する。
- hook設置が確認できない場合はactionを実行せずblockedで停止する。
- raw evidenceではfixture rootをtoken化し、ユーザーabsolute path、clipboard、Vault本文を保存しない。

### R6. Lifecycle Preservation

- action直後に外部open requestは1回だけである。
- Graphを閉じて再表示してもrequestを再発行しない。
- 固定Obsidian参照では別processを起動しない。renderer hook設置前の起動区間を遮断できないため、再起動時のrequest非再生は未観測・未確立として残す。
- TSUZUNE側はmain import前に`electron.shell.openPath`を差し替えられるため、別process再起動時の非再生を製品固有の追加証拠として記録してよい。ただし共通parity判定には使わない。
- action前後と同一process内のGraph再表示について、query、camera、node ID集合、edge signature、Graph tab／leaf、Vault content digestを比較する。
- force simulationによるnode座標やpixel同一性は不変条件にしない。

### R7. Honest Result

- `matched-core-behavior`は、両製品で同じfixture file identityへのrequest 1回、menu close、Graph／Vault不変、同一process内のGraph再表示時の非再生が成立した場合だけ使う。
- API seamの違い、menu全体の残差、OS既定appの選択・起動未証明、合成入力、物理accessibility未証明をcomparisonへ残す。
- Obsidianの別process再起動時の非再生は未観測・未確立とcomparisonへ明記する。

## 4. Acceptance Criteria

### Reference Gate

- 固定installer／asar／fixture hashが既知値と一致する。
- Obsidian menuの全項目、disabled状態、対象項目の相対順序を記録する。
- `window.open` hookが設置・復元され、call 1件、target `_external`、sanitized file URL `file:///<OBSIDIAN_VAULT_ROOT>/attachments/diagram.svg`を確認する。
- 選択後にmenuが閉じる。
- 別process Obsidianは起動しない。

### Product Gate

- 実在attachmentだけにexact labelが表示される。
- actionで既存`onOpen`がrelative pathを1回受け、menuが閉じる。
- App経路で既存`openVaultFile`が1回呼ばれる。
- 既存backend testsでunsupported／directoryの外部open guardを維持し、Appのexternal-open failure回帰でerror resultとUI messageを確認する。
- no new IPC／preload API／dependencyである。

### State And Evidence Gate

- action前後と同一process内のGraph再表示でquery、camera、node／edge、workspace Graph tab、Vault content digestが契約どおりである。
- requestはaction直後だけ1回で、Graph再表示により増えない。TSUZUNEの別process再起動は追加証拠、Obsidianの別process再起動は未観測とする。
- raw observation、comparison JSON、HTML reportのlocal参照がすべて存在する。
- reportは実外部アプリ起動を証明したと表現しない。

### Verification Gate

- focused renderer／App／既存backend testsがPASSする。
- `npm run typecheck`、`npm test`、`npm run check:mcp`、`git diff --check`がPASSする。
- capture後に隔離Electron processが0、hookが復元済みである。
- `@ponytail-review`で新API、重複helper、過剰scenarioがないことを確認する。

## 5. Evidence Shape

最小scenarioは`success-intercepted` 1本とする。各製品のmenu前後画像は最大2枚、lifecycleはstructured JSONを主にする。

記録項目:

- product／fixed version／fixture identity
- ordered menu items、disabled、bounds、action label、menuClosed
- hookInstalled、hookRestored、API seam、sanitized calls、callCount、actionError
- immediate／reopenedのquery、camera、node IDs、edge signature、Graph tab／leaf。TSUZUNEだけrestartedを追加可
- Vault content digest、process cleanup、evidence boundary

## 6. Stop And Rollback

- 固定参照が想定と違う場合は製品を変更せず設計へ戻る。
- hookを検証できない場合はclickせず停止する。
- actual external appが起動した場合はcaptureを停止し、その成果をacceptance evidenceに使わない。
- exact request、menu close、Graph／Vault不変、検証、comparisonが揃った時点で停止し、次のmenu項目へ進まない。
- 製品差分はmenu項目1件であるため、rollbackはその項目と対応test／evidenceを機能単位で戻す。データ移行はない。

## 7. Non-goals

- OS関連付けや実アプリ起動成功の検証。
- folder reveal／Explorer／remaining menu parity。
- note、tag、folder、unresolved nodeの外部open拡張。
- full keyboard／screen reader／High Contrast／DPI acceptance。
- retry、confirm dialog、app mapping、telemetry、network、database。
