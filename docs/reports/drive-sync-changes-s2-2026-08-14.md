# Drive Sync Changes API S2 (2026-08-14)

## 結果

Google Drive同期のremote確認を、毎回の全件列挙からChanges APIによる差分列挙へ変更した。

- 初回は変更開始トークンを取得してから全件metadata snapshotを作り、競合する時間帯の変更は次回にも取り込めるようにした。
- 同期台帳へ`changeToken`とremote metadata cacheを保存する。
- 2回目以降はChanges APIをページングし、追加・更新・削除されたfile IDだけをcacheへ反映する。
- 差分が0件のpreviewでも新しいトークンとcacheを保存する。
- Google Driveが保存済みトークンをHTTP 410で拒否した場合だけ、安全に新しいトークン＋全件metadata scanへ戻る。
- account全体のchange feedに別Vaultのファイルが含まれても、対象Vaultの`tsuzuneVaultId`と一致するmetadataだけを解析・採用する。

Googleの公式仕様では変更トークンは期限切れしないため、通常運用で定期full scanする設計にはしていない。410 fallbackは破損・拒否された保存トークンからの復旧境界である。

## 固定した公開挙動

1. 初回full snapshot後の変更なしpreviewは、remote全件列挙を再実行せずChanges APIを使う。
2. remote note 1件のversion変更はその1件だけを更新し、本文downloadもその1件に限る。
3. remote削除はremote metadata cacheから除き、同期baselineから誤って復活させない。
4. 他Vaultの変更は対象cacheへ混入せず、不正な他Vault pathも対象Vaultの同期を失敗させない。
5. 保存トークンがDriveに拒否された場合はfull snapshotへfallbackする。

## 検証

- focused Drive sync: 3 files / 43 tests PASS
- full suite: 62 files / 617 tests PASS
- typecheck PASS
- `git diff --check` PASS
- Ponytail review: Lean already
- production update: 10/10 checks PASS
- installed v0.5.0 hashes match built artifacts
- production profile: 57 files、before/after digest一致

Production receipt: `docs/reports/production-update-latest.json`

## 実機受入

- installed appで連続2回の「同期内容を確認」を実施し、ユーザー目視で1回目約7秒、2回目約1秒だった。
- 1回目は既存台帳へremote snapshot／change tokenを追加するbootstrap、2回目はChanges API差分経路として受入PASS。
- S1時点ですでに変更なしpreviewはユーザー実測約1〜2秒のため、S2は画面時間だけでなくremote列挙件数を抑える将来の大規模Vault／スマホ前提の改善である。
- 所要時間は精密benchmarkではなく、日常操作の目視受入値である。

## 残る境界

- 添付ファイル、削除伝播、3-way merge、バックグラウンド自動同期、モバイルclientは未実装。
- Changes APIは差分metadata取得であり、変更されたMarkdown本文のdownloadは引き続き必要。
- commit・pushは未実施。
