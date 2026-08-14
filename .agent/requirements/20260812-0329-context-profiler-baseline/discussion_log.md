# X1-CP0 Context Profiler Baseline — Discussion Log

## Priority alignment — 2026-08-12

### User Intent

Context量だけでなく、Codex等のAI Agentが同じ情報を探し直すこと、tool call、時間、再試行を含めてtoken消費問題を最優先で扱う。

### Decisions

- Accepted: North Starは`Cost per Successful Task`。
- Accepted: 最初はTSUZUNE開発の実task 10件を観測する。
- Accepted: 測定契約はTSUZUNE repositoryへ置き、将来Sidecar本体が必要になった場合だけ別projectへ分離する。
- Accepted: host tokenは正確なtask紐付きusageが公開された場合だけ記録する。
- Held: X1-C2 4k/6k/8k/15k比較。Context bundle量が主要因と測定されるまで実行しない。
- Rejected: BM25、SQLite、Hooks、GraphRAG、cache、別Agent、独自要約を先に実装すること。

### Rationale

Context文字数やwire bytesの減少だけでは、追加探索、失敗、品質低下、実費増加を検出できないため。

---

## CP0-A start — 2026-08-12 03:29 JST

### User Input

> OK。開始

### Decisions

- CP0-Aとして、10件の予約枠、採取規則、card template、共通schema、数え方、privacy境界だけを作る。
- 既存の`work/`除外、X1-T1の観測不能境界、現行requirements構成を再利用する。
- CP0-Aでは製品コード、本番アプリ、本番Vault、package、installer、MCP登録を変更しない。
- 最初の10件は目的抽出sampleであり、一般的な削減率を出さない。

### Open

- 実際のCodex host transcriptで、rootとchild agentのatomic tool eventをどこまで再構成できるか。
- exact host usageがtask単位で公開されるか。
- 10件で最低3 taskに再現する単一ボトルネックが見つかるか。

---

## Sampling correction — 2026-08-12

### Rejected Draft

- lookup、Graph future work、Profiler validator、CP0判断、handoff等を具体的な10 taskとして先に並べる案。
- 同じ無駄へ最低2 task種別を要求し、PLANの最低3 task gateを黙って強化する案。

### Decision

- CP0-A完了後に自然発生する次のeligibleなTSUZUNE taskを、CP0-T01から連続順で採る。
- 各cardは実際の依頼後、substantiveな探索・読取・実装より前に`work/`へ固定する。
- task種別を揃えるための人工task、除外、順序変更を行わず、実際の構成と欠落categoryをsample limitationとして報告する。
- preflight、record作成、schema修正、集計、CP0判断、TSUZUNE同期、handoffは測定運用としてsample外に置く。
- CP0-Cの必須gateはPLANどおり同じ無駄が最低3 taskに再現することとし、複数task種別への広がりは補助根拠にする。

### Rationale

架空の作業やProfiler自身の管理作業を混ぜると、通常のTSUZUNE開発ではなく測定制度が作った無駄を測り、後続Trackの順序まで先取りするため。

---

## CP0-A verification — 2026-08-12

- `task-record.schema.json`: Ajv 2020 strict compile PASS。
- schema behavioral checks: valid baseline、成功条件不一致、観測済usageの値／source欠落、未観測usageへの数値混入、fingerprint値欠落、CP0-T31拒否の6/6 PASS。
- reserved IDs: CP0-T01〜T10の10件、unique 10件。
- `git diff --check -- PLAN.md PROJECT_STATUS.md`: PASS（改行コードwarningのみ）。
- 製品source、本番アプリ、package、installer、MCP登録、本番Vaultの測定対象本文／fixture: 変更0。
- sample外のproject tracking同期: `10_プロジェクト/TSUZUNE.md` revision `sha256:268211c10632520fdb60cd71963255cda526ab461f4a83bbe4ada2332ebd9895`、`30_知識/TSUZUNE開発ロードマップ.md` revision `sha256:a952360e047ae93caa2a254441c6c7d3e0eaf19fd0c9adcce3510ae11a6c93e5`、`00_入口/今やること.md` revision `sha256:41cb1411577009e4e8d0edb3ef20d69d6954934348b05dce02418f592c8acb62`。

---

## CP0-O1 host usage correction — 2026-08-12

- Initial `not_observable` judgment was incorrect. The Codex rollout JSONL contains cumulative `token_count` events with input, cached input, output, reasoning, and model context window.
- Recomputed usage at each frozen task boundary. `scripts/measure-codex-rollout-usage.mjs` reported `task_count: 10` and `all_records_match: true`; all ten records pass the strict JSON Schema after correction.
- Aggregate public result: 456 token events; input 42,806,336; cached input 41,566,464 (97.10%); output 185,616; reasoning 54,727. Task-level values remain in ignored `work/` records. Actual cost remains unobservable.
- CP0-C selected the long-task stable-prefix replay hypothesis for the first comparison. CP1-A uses a short durable handoff and targeted TSUZUNE retrieval in a fresh task; it does not add BM25, Hooks, SQLite, cache, or a product profiler.
- Production TSUZUNE project note synchronized at revision `sha256:41afbef0f921e36d2925698e3420b1d40cf9a40987c7f474281ae3501e2b28f8`.

---

## CP1-A matched comparison — 2026-08-12

- The shared record schema now accepts both reserved CP0 IDs and `CP1-A-xx`; the rollout measurement script accepts `--task <id>` so a single record can be reproduced from a multi-task rollout without copying raw transcript data.
- CP1-A-02 ran the fixed read-only gate in the long current task: typecheck PASS, 58 files / 529 tests PASS at 6 GiB, Git status unchanged, input 1,692,645 over 12 token events.
- CP1-A-03 ran the same commands in a fresh task: typecheck PASS, production tests FAIL with one worker OOM after 57 files / 510 tests, Git status unchanged, input 313,686 over 10 token events.
- The fresh sample used 81.47% less raw input and 77.76% less input per token event, but it did not satisfy the quality gate. Its incomplete elapsed time is not a speed improvement and the raw token difference is not an adoptable reduction.
- Decision: preserve the failed sample, do not adopt fresh-task boundaries yet, and stabilize the comparison gate with one bounded read-only experiment before rerunning a matched pair. No product, test, package, installed app, production Vault, Git, or remote state was changed.
- Production TSUZUNE project note synchronized at revision `sha256:021da10100c005ab9e2f630f0c535421cc142d934469f32fdd2d8e17092334e7` with revision guard and history preservation.

---

## CP1-A single-worker matched comparison — 2026-08-12

- Kept the failed 2-worker CP1-A-03 sample, left the official `test:production` command unchanged, and ran the same diagnostic `NODE_OPTIONS=--max-old-space-size=6144 npx vitest run --maxWorkers=1` once in each condition.
- CP1-A-04 long task and CP1-A-05 fresh task both passed 58 files / 529 tests, retry 0, unchanged Git status, and two tool calls.
- Rollout records reproduce exactly. Input was 289,020 versus 33,004 (-88.58%); cached input was 286,976 versus 31,488 (-89.03%); output was 274 versus 274; elapsed was 57,748 ms versus 43,872 ms.
- The fresh task initially wrote an invalid `task_type: fresh-task`; normalized card and record to the existing `continuation` enum without changing measurements, then passed strict schema validation.
- Decision: conditionally adopt short durable handoff plus targeted TSUZUNE retrieval for long-task boundaries only. Monitor the next three natural switches; do not generalize the 88.58% ratio or claim cost savings.
- Production TSUZUNE project note synchronized at revision `sha256:370a5431f9185fe7fc86b19421913a723864a9d5bc69e0d44310d8afdf6ffbb4` with revision guard and history preservation.

---

## CP1-B monitoring sample 1/3 — 2026-08-12

- CP1-B-01 used an isolated anonymous fixture and fresh Obsidian 1.13.4 profile. It fixed the Files and links chevron route, dedicated `除外ファイル` page, empty-state label, clickable plus control `除外を追加...`, and the live Graph effect of `userIgnoreFilters`.
- The original extractor only enumerated `button` elements and incorrectly described the clickable `div` plus control as absent. The report and derived asset were corrected from the captured HTML.
- Frozen condition B2 required persistence. Restart/profile persistence, add flow, populated row, and remove flow were not established, so the strict outcome is `fail` with reusable partial evidence, not pass.
- Rollout measurement reproduced exactly: input 2,156,261; cached input 2,062,848; output 27,301; reasoning 5,086; 31 token events; elapsed 656,499 ms; retry 5.
- Monitoring is 1/3 with a quality/re-exploration warning. Do not implement TSUZUNE Manage UI from the partial reference; first close only the missing add/remove/restart-persistence contract in one bounded isolated task.
- Production TSUZUNE project note synchronized with revision guard at `sha256:97c24ba09afb47a4132331f8bcd75eebe77222023b42d29576522822301bf5d9`.

### CP1-B-01 correlated reference completion

- The bounded follow-up is not monitoring sample 2/3 and does not replace CP1-B-01. It stopped `blocked` after four honest retries.
- The fixed archive package reported 1.13.4 while the isolated window title reported 1.13.6. The safe settings API/accessibility route did not expose an actionable add control, so no guessed-coordinate click was sent.
- No add, populated-row, remove, or persistence evidence was claimed. All isolated processes exited, temporary Vault/profile were removed, and product/production Vault changes were zero.
- The separate rollout final cumulative usage was input 3,674,978; cached input 3,472,896; output 16,415; reasoning 2,999 over 46 events. The frozen card timestamp is a date placeholder and is not used as a token boundary.
- Decision: stop immediate GUI-reference retries and keep Excluded files parity held. Resume CP1-B only on the next natural long task.
- Production TSUZUNE project note synchronized with revision guard at `sha256:27a3b719c7c6386b3cc18cb73b55c27c03e6842aebfdff23b2ee7d2ac0864240`.

---

## CP1-B monitoring sample 2/3 — 2026-08-13

- CP1-B-02 selected one independently actionable Graph parity gap from existing fixed evidence: real Markdown notes exposed `フォルダで表示` in Obsidian, while TSUZUNE restricted the already-safe reveal route to attachments in the renderer.
- Reused the existing Vault-relative validation and `shell.showItemInFolder` boundary. No new IPC, dependency, abstraction, real Explorer launch, GP0-3b-p retry, or Excluded files retry was added.
- Verification passed: 3 targeted files / 109 tests, TypeScript build, diff check, and Ponytail review.
- Rollout measurement reproduced exactly: input 2,879,456; cached input 2,810,624; output 5,581; reasoning 1,513; 37 token events; elapsed 304,072 ms; retry 2.
- Monitoring is now 2/3: sample 1 failed its quality condition, sample 2 passed quality but again showed high long-task input. Keep fresh boundaries conditionally adopted and observe one more natural task before finalizing the policy.
- Production TSUZUNE project note synchronized with revision guard at `sha256:1663208bc53266355aa0d7e56fb73ba0f016bfbb158340e168dde374845bf471`.

---

## CP1-B monitoring sample 3/3 — 2026-08-13

- CP1-B-03 audited the current dirty working tree before any production update. Start state was 461 paths: 34 modified and 427 untracked.
- Root `package.json` was an Obsidian 1.13.4 development manifest with no scripts, while `HEAD:package.json` and `package-lock.json` identify TSUZUNE 0.5.0. The exact writer was not established, so the audit did not restore or overwrite it.
- Direct TypeScript checks passed. The full direct Vitest run produced 57/58 files and 527/529 tests passing; both failures correctly detected missing release configuration. Canonical `npm run build` stopped with `Missing script: "build"`.
- Installed EXE and `app.asar` hashes still match the latest receipt. This protects the existing installed app verdict but does not make the dirty source releasable.
- Rollout measurement reproduced exactly: input 2,303,178; cached input 2,212,352; output 10,793; reasoning 1,931; 26 token events; elapsed 427,040 ms; retry 1.
- Monitoring is now 3/3: FAIL, PASS, BLOCKED. Final policy is conditional use only: a fresh boundary can reduce inherited context for a clean, bounded long task, but every continuation must preflight source/config identity and stop on handoff or entrypoint ambiguity. It is not a universal token or quality guarantee.
- Production TSUZUNE project note synchronized with revision guard at `sha256:80cda56c8500f9fec8f01453be46668375a37a006fdd5a173e3b64ba32cdbcf6`.
