# AI Write Review Mode Scope

## MVP

- SettingsでReview対象のnote／folder pathを1行1件で指定する。既定は空。
- policy優先順位は`immutable > review > auto`。
- Review対象への`create_note`、`update_note`、`autonomous_update_note`は直接書かずproposalを作る。
- proposalはpath、operation、提案本文、元revisionまたは新規作成、reason、source refs、作成時刻を持つ。
- 同一pathに未処理proposalがあれば、新しいproposalを拒否して既存proposalを保持する。
- Settings内で現在本文と提案本文の差、理由、出典を表示し、承認または取消できる。
- 承認直前にpath、revision／非存在、immutable policyを再確認する。競合時は失効し、Vaultを書かない。
- proposalはapp userDataの単一JSON storeに保持し、app／MCP再起動後も残る。

## Nice To Have

- pending件数の常時badge。
- proposal一覧の絞込み。
- 差分内検索。

## Future

- proposal本文の手動編集。
- 一括承認／一括取消。
- 期限、通知、remote approval、複数利用者。
- per-note GUIでのpolicy設定と継承表示。

## Out Of Scope

- AI判断、LLM内蔵、agent framework。
- DB、background service、汎用queue。
- 自動rebase、merge UI、rollback UI。
- MCP以外の人間による通常編集の承認化。
- Raw Source／履歴の書込み許可。

## Constraints

- 一人用・一端末・ローカルWindows。
- 新規dependencyなし。
- proposal本文はVaultへ保存しない。
- 既存の即時更新、immutable、history、revision guardを弱めない。
