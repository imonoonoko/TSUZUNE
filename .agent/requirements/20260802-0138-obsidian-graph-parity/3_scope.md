# Obsidian Graph Parity Scope

## MVP: GP1
- Center force、Repel force、Link force、Link distance
- 力学レイアウト
- ラベル付きslider
- 初期設定への復元
- `settings.json`保存と再起動復元
- 既存hover、focus、click、pan、zoom、表示上限の回帰防止

## Nice To Have: GP2〜GP4
- Canvas描画
- Arrows、Text fade threshold、Node size、Link thickness
- Tags、Attachments、Existing files only、Orphans、Excluded files
- Obsidian Search構文によるFilters／Groups
- right-clickとLocal Graph depth slider

## Future
- 作成日時順time-lapse
- 2,000ノート以上の段階描画
- 必要性を測定した場合のWebGL

## Out Of Scope For GP1
- GraphRAG、ベクトル検索、グラフDB
- Google取込、同期、MCP変更
- plugin API
- 無制限な全Vault描画

## Constraints
- Markdownと添付が正本。
- Windows個人利用。
- 現在の未コミット差分を壊さない。
- 一度に1つの検証可能な縦切りだけを実装する。
