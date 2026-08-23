# Alternatives

## A. 4項目を一つの巨大な変更として実装する

不採用。UI、Drive destructive operation、Vault migration、audit verificationは失敗境界が異なる。独立したテスト可能sliceに分け、最後だけ統合検証する。

## B. 安全条件が未成立でも「全部やる」を優先して本番適用する

不採用。削除と分類はデータ損失、履歴圧縮は監査能力の低下に直結する。実装完了と本番適用可能性を分け、条件未成立なら証拠付きでfail closedとする。

## C. サイドバー状態を永続設定にする

不採用。現時点ではsession内の表示切替で要求を満たす。設定schema、migration、復元規則を追加しない。

## D. 既存履歴をmtimeの推測で圧縮する

不採用。現形式は旧本文のmtimeとsizeを保存しておらず、`previous_revision`を再計算できない。将来記録を検証可能にし、legacyはそのまま残す。

## E. Drive APIの完全削除を使う

不採用。localは既存`.trash`、remoteはDrive trashを使い、tombstoneから復旧・再判断できるようにする。
