# Packet 01 — semantics and RED fixtures

- Objective: effective bundle予算、bodyless parent、4明示intent、atomic queryの失敗をpublic behaviorで固定する。
- Ownership: `tests/context.test.ts`。
- Forbidden: production code、Vault書込み、Git操作、fixture固有markerのproduction hard-code。
- Source of truth: `2_requirements.md`のBehavioral contract。
- Acceptance: 4 fixtureが旧実装で意図した理由によりREDになり、変更後は全てGREENになる。
- Unseen boundary: queryless、temporal、MOC、見出しなしnoteの既存testを維持する。
- Stop/escalation: public APIを変える必要が出た場合は実装せず契約へ戻す。
