# GP0-3b-n Attachment Default App Alternatives

## A. 既存`onOpen`と`openVaultFile`を再利用する — 採用

実在attachmentのcontext menu項目から、`WikiGraphView`にすでに必須の`onOpen(path)`を呼ぶ。App、preload、IPC、Vault resolverは既存経路をそのまま通る。

### 採用理由

- Graph double clickとAttachment Previewで実運用済みの経路である。
- rendererはVault相対pathだけを渡し、main processがabsolute pathとfile実在性を検査する。
- 新しいAPI、抽象化、依存関係が不要である。

## B. `onOpenInDefaultApp` propと専用helperを追加する — 不採用

意味は明示的になるが、attachment分岐内では既存`onOpen`と同一動作である。新prop、App配線、testsを増やすだけなので採用しない。

## C. 新しいIPC channel／external-open serviceを作る — 不採用

既存`system:openVaultFile`がtrusted sender、Vault境界、対応file、Electron errorを処理している。重複した安全境界を作らない。

## D. rendererから`file://`、PowerShell、`cmd /c start`、`child_process`で開く — 禁止

Vault validationとtrusted IPCを迂回し、引用・path・foreground appの安全性を悪化させる。

## E. 実際の既定アプリを起動してcaptureする — 不採用

関連付けや前面windowに依存し、ユーザー作業を妨げる。比較対象は製品が正しいrequestを発行するところまでとし、OSアプリ起動は意図的に未証明とする。

## F. `フォルダで表示`まで同時実装する — 不採用

別のElectron API、menu契約、Explorer挙動を持つ独立項目である。GP0は一項目ずつ固定比較する。
