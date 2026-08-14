# Alternatives

## A. 証拠なしでparserを変更する

不採用。現在は未閉じquote／括弧／operator／regex／propertyの一部を入力途中として検索可能にし、構文として評価不能な式だけを一致0件にしている。Obsidianの境界を推測して変更すると、既存の正常な入力途中動作を壊し得る。

## B. Excluded filesのManage UIと全surface効果へ切り替える

不採用。Settings UI、Graph、Search、Contextをまたぐため、CP0-T01の「公開挙動一件」「multi-surfaceへ拡張しない」という固定scopeを超える。

## C. malformed queryの固定参照を先に取得する

採用。ただし新しいObsidian GUI captureは今回の停止条件なので、別の明示的なcapture taskとして再開する。参照結果とTSUZUNEが一致すればno-changeで閉じ、差がある場合だけparserまたはtestを最小変更する。
