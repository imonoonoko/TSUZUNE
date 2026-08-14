# Drive Sync Metadata-first S1 (2026-08-14)

## 結果

Google Drive同期の本文取得を、全件取得からremote versionベースの必要時取得へ変更した。

- 同期台帳へ`remoteVersion`を保存する。
- file IDとversionが台帳に一致するremote noteは、保存済みremote hashを再利用する。
- previewで取得済みのremote本文は、apply直前のmetadata再検証でversionが一致する限り再利用する。
- 既存台帳には`remoteVersion`がないため、更新後の初回確認だけ従来どおり本文を取得して台帳を移行する。
- Google Drive側のpath、file ID、versionまたはローカルhashが変わった場合、従来どおりstale planを拒否する。

## 固定した公開挙動

1. 同期済みで変更のないremote noteは本文download 0件。
2. remote note 1件のversionだけが変わった場合、本文downloadは1件。
3. remote-only／remote-changed noteをpreviewで取得した後、applyは同じ本文を再downloadしない。

## 検証

- focused Drive sync: 3 files / 38 tests PASS
- full suite: 62 files / 612 tests PASS
- typecheck PASS
- `git diff --check` PASS
- Ponytail review: Lean already
- production update: 10/10 checks PASS
- installed v0.5.0 hashes match built artifacts
- production profile: 57 files、before/after digest一致

Production receipt: `docs/reports/production-update-latest.json`

## Installed app実機受入

- 旧台帳warm-up後、変更なしの2回目の「同期内容を確認」はユーザー実測で約1〜2秒で完了した。
- S1の実機受入をPASSとし、次の性能sliceをS2 Drive Changes APIへ進める。
- この値はユーザー目視の所要時間であり、精密benchmarkではない。

## 残る境界

- Google Drive Changes APIのpage tokenは未実装。S2で扱う。
- 添付ファイル、削除伝播、3-way merge、モバイルshellは未実装。
- 実Vaultの旧台帳warm-upと、直後の変更ゼロ確認（約1〜2秒）は完了済み。
- commit・pushは未実施。
