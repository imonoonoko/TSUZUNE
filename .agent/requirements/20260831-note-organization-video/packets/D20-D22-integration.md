# D20–D22 — Implementation, verification, delivery

## Root ownership

親AgentがTask Contract、test-first実装、packet統合、未提示境界、本番反映、TSUZUNE final writebackを所有する。複数agentが同じcode fileを編集しない。

## D20 implementation

- D18／D19の証拠を統合してpublic behaviorを一件ずつred-greenする。
- Markdown正本、既存frontmatter、Wiki link／backlink、既存search indexを再利用する。
- 高信頼既存category、最大3 topics、source relation、knowledge/source grouping、unclassified visibilityを最小差分で実装する。

## D21 adversarial verification

- 実装者以外が原典保護、分類漏れ、MOC二重正本、prompt injection、collision、stale source、既存検索回帰をdefect-firstで検証する。
- production TSUZUNEへ書き込まない。

## D22 delivery

- focused tests、typecheck、full tests、MCP check。
- task-owned repository artifactをproduction snapshot前に確定する。
- `npm run production:update`、packaged／installed isolated smoke、hash一致、profile不変、MCP再登録、delivery match。
- verified final boundaryをproduction TSUZUNEへ一度だけ書き戻し、fetchとunique searchで確認する。

## Stop

bulk production Vault classification write、原典変更、delete、mass move、秘密、外部AI、new DBが必要なら実行せず判断gateへ戻す。
