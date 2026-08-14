# Alternatives

## A. search結果から `50_履歴/**` を既定除外 + include_history オプション(採用)

- MCPのservice層でフィルタしてから `searchNotes` へ渡す。コア関数は無変更。
- 理由: 影響範囲が search に限定され、UI検索(renderer が同じ `searchNotes` を使用)へ波及しない。

## B. コアの `searchNotes` に除外オプションを追加

- 不採用: `renderer/App.tsx` も `searchNotes` を使うため、UI検索まで挙動が変わる。本スライスの範囲を超える。

## C. 除外を完全にせず、検索結果の並び順で履歴を下位に

- 不採用: 履歴が検索結果に残る限りノイズは解消しない。スコアリングの変更は既存順位を変えるリスクがある。

## D. UIの userIgnoreFilters を `--vault` モードでも共有して解決

- 不採用(別スライス): `vault-source.ts` は `--vault` 指定時に `userIgnoreFilters: []` を返す既知ギャップ。共有すると fetch・build_context など全体の挙動が変わり、本スライスの検証範囲を超える。既存の `isExcludedFilePath` を再利用することで、このスライスとの統合は将来可能。
