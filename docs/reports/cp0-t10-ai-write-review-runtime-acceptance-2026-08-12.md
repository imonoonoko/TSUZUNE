# CP0-T10 AI Write Review Runtime Acceptance

日付: 2026-08-12
対象: 再起動後の本番TSUZUNE MCP
結果: PASS

## 結論

再起動後の本番MCPはAI Write Review modeの公開schemaと実動作を読み込んでいる。Review対象へ送ったrevision付き更新は`pending_review: true`とproposalを返し、対象ノートの本文、revision、sizeを変更しなかった。

## 固定した一件

- 対象: `10_プロジェクト/TSUZUNE.md`
- 開始revision: `sha256:c07cc0cba1935a414cb343c1921043123ae0908d085aa4f2b7cb8a6f5b0d87b0`
- 一時設定: 対象pathだけを`aiReviewPaths`へ追加
- 提案: 適用してはならない識別markerを末尾へ加えた完全置換案
- 操作: `update_note`一回。承認、本文更新、履歴作成は行わない

## 観測結果

1. 稼働processは現行repositoryの`out/mcp/server.js`を実行していた。
2. `update_note`はproposal `4b9ff6e1-8ef2-483c-85ca-c709ec3dfe1d`を返した。
3. Vault外`ai-write-review-proposals.json`に同じID、path、operation、expected revision、提案markerが保存された。
4. 直後とcleanup後の`fetch`はいずれも開始revisionと52,871 bytesを維持し、提案markerを含まなかった。
5. 試験用`aiReviewPaths`を除去し、開始時に存在しなかったproposal fileを削除した。proposal lockも残っていない。
6. Git status fingerprintは開始時と終了時で一致し、task由来のrepository差分は0だった。

## 安全境界

- proposalは承認していない。
- 本番Vault本文、`50_履歴`、製品source、tests、installed binaryを変更していない。
- 削除したのは、この試験が作成したVault外の一時proposal file一件だけである。開始時には存在せず、復元対象はない。

## CP0への意味

CP0-T10は`pass`で、Native sampleは10/10へ到達した。ただし10件すべてで`unique_sources`と`repeated_reads`が`null`、host token／費用が`not_observable`である。したがって、10件採取完了と「Context／tokenの最大要因を特定できた」は同義ではない。集計ではこの観測限界を独立して判定する。
