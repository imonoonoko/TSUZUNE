# CP0-T01 Graph Filters/Search evidence

日付: 2026-08-12（JST）
結果: `blocked`
製品コード変更: 0
本番Vaultの測定対象本文書込: 0
本番TSUZUNE tracking sync: 1（履歴付きproject note更新）
production update: 未実行

## 対象

Graph `Search files`のmalformed／in-progress query境界を、最初の公開差一件として選んだ。Excluded files Manage UIはSettings、Graph、Search、Contextをまたぐため、このtaskのscopeから除外した。

## 確認結果

- `docs/obsidian-graph-parity-reference.md`は、malformed queryを含む同一fixtureでObsidian 1.13.4と比較していないためSearch全体を`matched`としていない。
- `src/core/graph-query.ts`は未閉じquote、括弧、regex、property、末尾`OR`を入力途中として扱う一方、評価不能な式をcatchして一致0件にする。
- `tests/graph-query.test.ts`は入力途中の5例と、compile不能regex／式なし左括弧のfail-closedを固定している。
- repository内の既存Graph Search比較は通常queryの入力、Graph再表示、アプリ再起動後の保持を対象とし、malformed query matrixを含まない。

## Verification

```text
npm test -- --run tests/graph-query.test.ts
Test Files  1 passed (1)
Tests       12 passed (12)
```

npmは`--run`を将来非対応のCLI configとして警告したが、Vitestは対象fileを実行し12/12 PASSした。再試行は行っていない。

## Stop reason

Obsidian 1.13.4の新しい隔離GUI captureなしには、現在の寛容境界が一致か差分か判定できない。CP0-T01のcardはfresh Obsidian GUI captureを停止条件にしているため、挙動を推測して変更せず停止した。

停止判定後、通常ノートや原典ではなくproject tracking noteだけへ、`blocked`状態と次のCP0-T02をrevision guard付きで同期した。

## Restart gate

[要件package](../../.agent/requirements/20260812-0411-graph-filters-search-smallest-slice/4_requirements.md)のquery matrixを固定し、別taskとしてObsidian 1.13.4の隔離captureを明示認可する。その観測後だけ、no-changeで閉じるか、一項目の最小修正へ進む。
