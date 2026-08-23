# Requirements

## R1. Sidebar behavior

- 初期状態は左右とも展開済みで、現在の見た目を維持すること。
- mouseとkeyboardで同じbuttonを操作できること。
- 展開状態と対象panelの関係を支援技術へ公開すること。
- 一方の切替が他方や中央paneの状態を変えないこと。
- 狭いwindowで中央paneが操作不能にならないこと。

## R2. Deletion decision contract

- 既定previewでは、片側だけ消えたtracked noteを従来どおり`preserve`にすること。
- 明示policyはpreview inputとplanに含み、apply時のpolicy差分をstaleとして拒否すること。
- `local_deleted`をremote trashへ、`remote_deleted`をlocal trashへ伝播する方向を混同しないこと。
- preview結果にtrash予定件数と復旧可能性を表示すること。

## R3. Deletion apply and recovery

- remote trashは既存file IDだけを対象にし、path一致だけでremote objectを推測しないこと。
- local trashは衝突回避済みの既存`.trash`経路を使い、完全削除しないこと。
- destructive call前にtombstoneをatomicに保存し、完了sideを各成功後に更新すること。
- network/process failure後に、完了済みsideと未完了sideを区別できること。
- pending tombstoneが期待したpreimageと一致しない場合は自動継続せず`RECOVERY_REQUIRED`にすること。
- partial failureを成功件数へ含めず、次回preview/applyが暗黙に別操作を始めないこと。

## R4. Classification preflight/apply

- 各sourceのcurrent revisionとsize、destination absence、destination parent existenceを確認すること。
- Drive pairとclean baselineが対象Vaultへ属することを確認すること。
- 各sourceに対するremote owned objectがexactly oneであること。0件または複数なら停止すること。
- raw Drive ID、token、秘密情報をrepo/TSUZUNEへ保存しないこと。packetには不可逆hashまたは確認countだけを残すこと。
- rollbackはlocal path、Drive parent/path、tracking ledger、sidecarのpreimageを持つこと。
- 1件でもapply後検証に失敗したら後続を停止し、安全に戻せる範囲を戻して実施記録へ明記すること。

## R5. Revision-verifiable history

- verifierは現在のrevision式と同じcanonical inputを使うこと。
- rootの絶対pathは履歴noteへ保存せず、root path hashで現在Vaultとの一致だけ検証すること。
- 新形式でfield欠落、型不正、本文改変、chain断絶を検出すること。
- legacyを`verified`と誤表示しないこと。
- previewは全recordを列挙できても、`applyEligible`はverified chainに限定すること。
- apply/rollback executorを追加する場合も、本番Vault外のstagingとfixture proofが揃うまで本番呼出し面へ出さないこと。

## R6. Verification and delivery

- 各sliceは対象testをred-greenで追加し、既存関連testを通すこと。
- UIはisolated test profile/fixtureで展開、左右collapse、復元を確認すること。
- Drive deletionはisolated Drive folder/Vaultでupload、片側trash、preview、apply、復旧証拠まで確認すること。本番Vaultのnoteを削除しないこと。
- 全体で`npm run typecheck`、`npm test`、`npm run check:mcp`を実行すること。MCP変更があるため省略しないこと。
- Ponytail reviewで、重複実装、新規依存、将来用frameworkがないことを確認すること。
- 製品コードが変わった最終snapshotのみ`npm run production:update`へ進めること。

## Acceptance criteria

1. sidebarの初期・左右独立collapse・restore・keyboard/accessibilityテストがPASSする。
2. deletionのdefault preserve、明示trash direction、stale rejection、remote/local adapter、tombstone recoveryテストがPASSする。
3. 5件分類packetがfreshで、apply済みまたは具体的な単一blockerを持つfail-closed状態になる。
4. 新形式historyのgood/broken/legacy判定とrestore fixtureがPASSし、既存164件が無変更である。
5. 全体gateとproduction update receiptがPASSする。または起動中アプリなど外部状態で止まった場合、その一点だけを未完として報告する。
