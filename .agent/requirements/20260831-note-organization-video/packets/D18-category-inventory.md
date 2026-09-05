# D18 — Category and source inventory

## Objective

Production TSUZUNEの`30_知識`と`40_情報源`をread-onlyでexact path棚卸しし、現在のcategory、source type、欠落、主題cluster、知識↔原典関係を証拠付きで返す。

## Ownership

本番Vaultのread-only inventoryと分類設計への証拠抽出。source codeやVaultは編集しない。

## Do

- `mcp__tsuzune__list_directory`でexact pathsとfingerprintを取得する。
- metadata／本文読取は分類判定に必要な範囲だけに限定する。
- 30はcategory設定、MOC到達性、source refsを集計する。
- 40はsource type、題材cluster、派生知識backlinkを集計する。
- 現行6カテゴリの反証、新カテゴリ候補、未分類を隠さない境界を示す。

## Do not

- 本番Vaultを作成・更新・移動・削除しない。
- `knowledge.md`、`50_履歴`、`.trash`、`.tsuzune`を読まない。
- 全件分類結果を正本として書き戻さない。

## Expected output

`results/d18-category-inventory.md`相当の統合可能な証拠packet。件数、代表例、分類案、反証、unseen boundaryを含める。

## Stop

Vault fingerprintが途中で変わる、対象が200件page境界を越えて一貫性を保証できない、privacy riskを検出した場合は書込みせず親へ戻す。
