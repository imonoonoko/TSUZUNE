# CP0-T09 AI Write Review mode

Date: 2026-08-12
Result: PASS
Start HEAD: `5266131f6e2c38afc39b46fe9083c9e1fef39577` (dirty working tree)

## Outcome

固定済みのReview MVP契約を、既存のMCP write、Settings、revision guard、immutable policy、AI履歴へ接続した。Review対象は既定で空であり、明示pathだけが承認制になる。`immutable > review > auto`の優先順位を維持する。

- `create_note`、`update_note`、`autonomous_update_note`は、Review対象ではVaultへ直接書かず`pending_review`とproposalを返す。
- proposalはVault外のapp userData配下にある単一JSONへ保存し、同一canonical pathの承認待ちは1件に制限する。
- JSON更新はlock fileと同一directoryの一時file→renameで保護し、壊れたJSONを空として上書きしない。
- SettingsでReview pathを保存し、現在内容と提案内容を並べて、承認または取消できる。
- 承認時はimmutable、存在、revisionを再確認する。更新競合または削除はproposalを失効させ、auto rebaseしない。
- 承認されたupdateだけ既存の`50_履歴/AI更新`へ旧本文とprovenanceを保存してから適用する。取消はVaultを変更しない。

## TDD evidence

最初のREDは、Review設定下でも`autonomous_update_note`が即時更新と履歴作成を行っていたことを検出した。その後、proposal永続化、重複拒否、3 write tool、承認、取消、revision競合失効、Settings UIを順にGREENへした。

## Verification

- `npm run typecheck`: PASS
- `npm test`: PASS, 58 files / 529 tests
- `npm run check:mcp`: PASS, 4 read tools / 3 write tools
- `npm run build`: PASS
- `npm run production:update`: PASS, 10/10 checks
- installed executable / app.asar hash: builtと一致
- production profile: 57 files、digest不変
- receipt: `docs/reports/production-update-latest.json`, verified at `2026-08-12T03:57:46.298Z`

## Scope kept out

新規dependency、DB、background service、通知、remote approval、複数承認者、proposal編集、一括操作は追加していない。host model-visible tokenと実費は観測不能であり、このtaskから削減率を主張しない。

## Residual boundary

Review inboxはSettingsを開いた時に確認するMVPであり、通知はない。proposal保存先は単一端末のapp userDataで、remote／multi-user workflowではない。次はCP0-T10として次に自然発生するeligible taskを採取し、CP0を10/10へ閉じる。
