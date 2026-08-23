# Scope

## S1 — accessible sidebar collapse

- 左パネルと右パネルを独立して折りたたむ。
- buttonのaccessible name、`aria-expanded`、`aria-controls`を持つ。
- 折りたたみ中も切替buttonを残し、中央ノート、選択、検索条件、タブを破棄しない。
- 状態はsession内だけ。既存の小画面layoutを回帰させない。

## S2 — recoverable Drive deletion propagation

- previewの明示policyが選ばれた時だけ`local_deleted`/`remote_deleted`をtrash decisionへ変える。
- local deleteは既存`VaultService.trashEntry`、remote deleteはDrive `files.update({trashed:true})`を使う。
- apply直前にstale planを再検査し、最初の変更前に拒否できる。
- 一件のpending deletion tombstoneで、plan、path、file ID、preimage、完了sideを記録する。
- tombstoneが判断不能なら次回applyをfail closedにする。
- 本番削除applyは独立したfresh packetと明示確認があるまで実行しない。

## S3 — five-note classification gate

- 対象は次の5ノートだけ。
  - `30_知識/TSUZUNE-Google連携・同期・障害対応.md`
  - `30_知識/TSUZUNE-MCPとAI書き込み運用.md`
  - `30_知識/TSUZUNE-データ保護・バックアップ・復旧.md`
  - `30_知識/TSUZUNE-開発開始と区切りの標準ループ.md`
  - `30_知識/TSUZUNE-本番更新・インストール・Release運用.md`
- destinationは各basenameを維持した`30_知識/ソフトウェア開発/`直下。
- fresh local preflight、destination absence、対象revision、関連sidecar、Drive上の一意なowned object、clean baseline、rollback packetを凍結する。
- 既存のsingle-entry move/Drive trackingで5件を安全に直列適用できる時だけ実行し、各項目間でfresh preflightする。
- batch atomicityまたはrollback情報が不足するなら適用せず、blocked packetを更新する。

## S4 — future-verifiable AI history

- 新しいAI revision記録へ、旧revisionを再計算するための`previous_modified_at`、`previous_size_bytes`、root識別hashを保存する。
- shared verifierは新形式を`verified`/`broken`、旧形式を`legacy-unverifiable`として区別する。
- compaction previewはverified chainだけをapply eligibleにし、既存164件は対象外にする。
- restore/as-of fixtureで、残す本文から期待内容を復元できることを検証する。
- このsliceでは本番履歴を削除・移動・上書きしない。

## Non-goals

- 自動バックグラウンド削除、完全削除、任意のbulk migration engine。
- sidebar layout preferenceの永続化やcloud sync。
- legacy履歴の推測補完、164件の監査価値を落とす圧縮。
- 分類5件以外の自動整理。
- 新規runtime依存関係、app-owned knowledge database。
