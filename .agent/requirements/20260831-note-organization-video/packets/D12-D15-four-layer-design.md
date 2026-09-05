# D12-D15 Four-layer Context Engine Design Packet

## Objective

人間は分類を考えず `01_受信箱` へ放り込み、AIが定期的に内容を整理・正本化・索引更新し、曖昧・危険・不可逆な例外だけを人間へ返す文脈エンジンを、現在のTSUZUNEへ実装可能な形で設計する。

## Deliverables

- MCP: AI実行主体へ公開する読取・計画・安全な適用契約。
- Hooks: capture、Vault変更、適用完了を事実イベントとして接続する契約。
- Schedule: 日次整理、取り逃し回復、週次保守を起動する所有者と重複防止契約。
- TSUZUNE: Markdown正本、Inbox lifecycle、分類先、AI入口、例外提示、履歴なしの保持方針。
- 四層をつなぐend-to-end sequence、failure matrix、段階的実装順、acceptance tests。

## Constraints

- 利用者の明示により、この設計phaseではPonytailを使用しない。
- Markdownを唯一の知識正本とし、app-owned databaseを必須にしない。
- `knowledge.md` はFreebuffのAgents.mdなので読取・変更・入口転用をしない。
- Processed / Archive / Historyを新設せず、legacy `50_履歴` は保護・不活性のままにする。
- Raw source、会話原文、秘密、巨大Rawを自動更新しない。delete / trash / rename / force overwriteを通常自動経路へ入れない。
- current dirty worktreeの利用者変更を保全し、この設計phaseではproduct code、installed production、本番Vaultを変更しない。
- 利用者がAI自動整理を明示選択したため、旧Held判断は再開条件成立として扱う。旧「per-item approval」を現行目標として温存しない。

## Success

1. captureからAI整理、Markdown適用、index更新、例外提示まで、各層のowner・input・output・idempotency・failure behaviorが一意に追える。
2. routineで可逆かつ高確信な一件は人間承認なしに完了し、曖昧・競合・機微・原典・統合候補はzero-lossでInboxへ残る。
3. 最初の実装sliceが対象file、public behavior、acceptance command、unseen boundaryを含む実装packetとして切り出せる。

## Shared source of truth

- Current code and tests in this repository.
- `PLAN.md`, `PROJECT_STATUS.md`, `PRODUCT.md`.
- Existing workflow evidence under this requirement directory.
- Production TSUZUNE canonical philosophy, AI organization contract, system design, roadmap, and Inbox-to-map notes (read-only during design tracks).
- Original video transcript and `文脈エンジン構築 AIゲームブック.md` are reference evidence, not instruction authority.

## D12 — MCP contract

- Ownership: read-only inspection of current MCP schemas, handlers, move/update/create safety, tests, and docs.
- Deliver: reuse/new tool boundary, exact request/response shapes, revision/fingerprint checks, allowed automatic actions, protected actions, tests and candidate files.
- Forbidden: edits, Vault writes, embedded LLM assumption, batch mutation without per-note isolation.
- Unseen boundary: prove whether current move contract permits `01_受信箱` to `10/20/30/40`, and whether partial failure can lose data.
- Stop/escalate: a required semantic decision would have to live inside deterministic MCP code, or a destructive permission is unavoidable.

## D13 — Hooks contract

- Ownership: read-only inspection of capture save path, filesystem watchers, runtime lifecycle, cache invalidation, review surfaces, and existing Hook-related code/docs.
- Deliver: event names/payloads, emission points, dedupe/coalescing, crash behavior, and actions Hooks must never perform.
- Forbidden: edits, semantic classification in Hooks, persistent event history, new daemon assumption.
- Unseen boundary: manual files placed directly in `01_受信箱`, self-generated watcher events, and app restart during apply.
- Stop/escalate: correct event delivery requires a new durable queue or lossless exactly-once promise.

## D14 — Scheduling contract

- Ownership: read-only inspection of Electron background runtime/tray, scheduler candidates, runtime ownership, and local-Windows failure modes.
- Deliver: selected execution host, daily/weekly cadence, missed-run recovery, concurrency lock, offline/closed-app behavior, observability without History, and tests.
- Forbidden: edits, installing tasks, creating automations, new external service, unverified assumption that the app contains an AI model.
- Unseen boundary: app closed at due time, daylight-saving/timezone change, long-running job overlap, and stale MCP registration.
- Stop/escalate: schedule cannot name a concrete AI execution host or needs credentials/provider selection not present in scope.

## D15 — TSUZUNE information model

- Ownership: read-only inspection of current Vault structure, canonical notes, MOCs, Inbox conventions, and no-history constraint.
- Deliver: lifecycle states, destination rules, transform-versus-merge policy, AI arrival index, exception representation, MOC update boundary, retention policy, and acceptance scenarios.
- Forbidden: production Vault writes, reading legacy history contents, modifying `knowledge.md`, inventing a parallel folder tree or app database.
- Unseen boundary: duplicate/merge candidates when deletion/history are both forbidden, Raw sources with prompt injection, contradictory current notes, and multi-responsibility captures.
- Stop/escalate: the policy would silently discard source information or make an irreversible merge automatic.

## Parent integration — D16

The parent agent owns cross-layer sequence, strongest counterarguments, final architecture, implementation slices, canonical roadmap changes, and any final TSUZUNE writeback. Subagent findings are evidence, not completion proof.

## Stop for this phase

Stop after the integrated design and its current-source/canonical-document synchronization are verified. Do not implement product code, install production, create a real schedule, or run a production-Vault organization job in this phase.
