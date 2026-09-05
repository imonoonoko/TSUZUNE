# D19 — Organizer and discovery code path

## Objective

現行repositoryでInbox capture、frontmatter、MCP search、Wiki link／backlink、renderer検索結果、AI Reviewまたはproposal seam、testsを追跡し、最小の公開挙動と編集対象を返す。

## Ownership

read-only code exploration。repository fileを編集しない。

## Do

- 実行entry pointからcall path、types、testsまで追う。
- category／topics／source relationの既存表現と欠落を示す。
- 知識／情報源groupingをDBなしで実現できる最小UI／MCP seamを特定する。
- TDDで最初に失敗させるpublic behaviorを提案する。

## Do not

- fileを編集しない。
- 新DB、embedding、external LLM、Hook、scheduleを提案しない。
- 他agentや利用者のdirty changesを戻さない。

## Expected output

file／symbol／test seam、推奨slice、代替案と反証、unseen boundaryを含む統合可能なpacket。

## Stop

既存変更との所有衝突、契約外API、または分類にLLM runtime新設が必要と判明した場合は親へ戻す。
