# AI Write Review Contract Discussion Log

## Intake and decision - 2026-08-12 12:31

### User Input
> CP0-T07の結果を受けて続行。

### Codex Proposal Or Question
TSUZUNE appを承認者とするserver-enforced Review modeを、製品実装前に要件化する。

### Decisions
- Accepted: Reviewは明示的に指定したpathだけへ適用し、既定の自律更新を妨げない。
- Accepted: `immutable > review > auto`の優先順位にする。
- Accepted: proposalはVaultではなくapp userData配下の単一JSON storeへ保存し、再起動後も保持する。
- Accepted: 同じpathに未処理proposalがある間は新しいproposalで上書きしない。
- Accepted: 承認時にrevisionとimmutable policyを再確認し、競合時は自動rebaseせず失効させる。
- Rejected: Codex hostの`prompt`をTSUZUNEのReview保証として扱う。
- Rejected: 新規DB、常駐service、汎用workflow engine、複数承認者、remote approval。
- Open: なし。MVP実装に必要な既定値は本packageで固定する。

### Rationale
一人用ローカル製品であること、承認操作は例外であること、既存のrevision guard・immutable policy・historyを再利用できることを優先した。

---
