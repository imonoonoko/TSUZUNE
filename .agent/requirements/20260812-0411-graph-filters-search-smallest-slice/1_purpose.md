# Graph Filters/Search smallest slice

更新日: 2026-08-12（JST）
状態: `blocked-before-implementation`

## 目的

Graphの`Search files`で、入力途中として許容する式と、不正として一致0件にする式の境界を、Obsidian Desktop 1.13.4との同一fixture比較で一項目だけ確定する。

このsliceは、CP0-T01として自然発生した実タスクでもある。実装量を増やすことではなく、固定参照との差を証拠で確定し、差がある場合だけ最小修正することを成功条件とする。

## 今回の結論

TSUZUNE側の実装と12件の回帰testは確認できたが、malformed queryを同じ入力集合で観測したObsidian 1.13.4の固定参照証拠がrepository内にない。新しいObsidian GUI captureはCP0-T01の事前停止条件に該当するため、製品変更なしで停止する。
