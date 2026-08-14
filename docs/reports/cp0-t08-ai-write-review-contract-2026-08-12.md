# CP0-T08 AI Write Review Contract

日付: 2026-08-12（JST）
結果: `pass`
task type: `requirements_definition`
製品コード変更: 0
production update: 未実行

## 結論

TSUZUNE appを承認者にするserver-enforced Review modeを、実装可能なMVP契約へ固定した。

- Reviewは明示pathだけのopt-in。既定0件で日常の自律更新を妨げない。
- policy優先順位は`immutable > review > auto`。
- Review対象へのMCP 3 write toolはVaultへ直接書かずproposal化する。
- proposalはVault外のapp userData単一JSONへ保存し、再起動後も保持する。
- 同一pathのpendingは1件。上書きせず、新しいproposalを拒否する。
- appで承認／取消し、承認時にrevision／非存在とimmutableを再確認する。競合は自動rebaseせず失効する。
- DB、常駐service、汎用queue、複数承認者、remote approvalは作らない。

## 根拠

既存MCP serviceにはcanonical path、revision guard、immutable、historyがある。既存Settings／IPC／renderer modalも再利用できる。足りないのはappと別processのMCPが共有するproposal状態だけであり、settings隣接JSONで最小に閉じられる。

Codex hostの`prompt`は補助的な確認で、TSUZUNE server-side Reviewの代替にはしない。Drive preview／applyは考え方だけ参照し、Drive専用serviceやpending stateを一般化しない。

## Durable package

`.agent/requirements/20260812-1231-ai-write-review-contract/`

- `1_purpose.md`
- `2_alternatives.md`
- `3_scope.md`
- `4_requirements.md`
- `5_ui_prompt.md`
- `6_implementation_brief.md`
- `discussion_log.md`

## Verification

- package 7 files存在
- 固定語彙、scope、acceptance、実装briefの相互整合を確認
- `git diff --check`: PASS
- Ponytail review: `Lean already. Ship.`

## 次

CP0-T08を8/10の`pass`として保持する。次の自然なeligible依頼をCP0-T09としてadmitする。Review実装は別taskでcardを固定し、RED→GREENで一つのvertical sliceとして行う。
