# CP0-T02 Requirements

## R1 固定matrix

`docs/reports/assets/graph-gp0-malformed-query/query-matrix.json` を唯一のquery一覧として使用する。

## R2 同条件capture

各caseを同じfixture、同じlight theme、同じ隔離user-data、画面外windowで実行する。通常Vaultと既存Obsidian profileを変更しない。

## R3 観測項目

各productについて入力直後、Graph再表示後、アプリ再起動後の次を記録する。

- visible query
- internal/persisted query
- sorted node IDs
- inputの`aria-invalid`とclass
- filter領域またはnoticeに表示されたerror text

## R4 判定

caseごとにnode集合、query保持、error表示を比較し、`matched`、`different`、`blocked` のいずれかを根拠付きで記録する。

## R5 変更境界

差がなければproduct codeを変更しない。差があっても一つの既存parser境界と回帰testで閉じない場合は、理由を残して停止する。
