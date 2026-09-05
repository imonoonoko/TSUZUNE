# Calendar 1.5.10 Target-Specific Compatibility Evidence Packet

## Outcome

Liam Cain Obsidian Calendarの公式stable `1.5.10`を固定対象として、無改変の `main.js` / `manifest.json` をTSUZUNEのCalendar専用sandbox hostで実行する互換経路を実装した。公開されているdesktop動作・設定・3 commandsは、隔離Vault上の実Electron受入で全件PASSした。公式artifactが未配置または未readyのnative `DailyCalendar`でも、作成日・最終更新日の活動表示と一覧操作を提供する。

これは任意のObsidian community pluginやObsidian API全般の互換ではない。Calendar以外のpluginは引き続きmanifest検出だけで、第三者コードを実行しない。

## Task Contract

- objective: 公式Calendar 1.5.10を無改変で動かし、公開desktop挙動と設定の対象限定互換を証明して本番へ反映する。
- deliverables: fixed artifact verifier、Calendar-specific sandbox/API shim、settings/commands/UI integration、automated conformance、installed production evidence、durable compatibility boundary。
- constraints: local Windows only、Markdown source of truth、既存noteを上書きしない、generic plugin runtimeを作らない、公式artifact hash mismatchをfail closedにする。
- success:
  1. 固定した公式artifactだけが無改変で実行される。
  2. 対象とした公開desktop動作・設定が100% PASSし、対象外がN/Aとして明示される。
  3. regression、production update、installed runtime acceptanceが通る。
  4. installed TSUZUNEの実Vaultでnative activityの件数と日付別ノート一覧を利用者が確認する。
- lane: Orchestrated。
- stop: artifact identity不明、unrestricted Node実行が必須、既存Markdown安全境界を迂回、本番TSUZUNE実行中。

## Artifact Identity

| Artifact | Identity |
|---|---|
| Repository | `liamcain/obsidian-calendar-plugin` |
| Version / commit | `1.5.10` / `7d2aebda7f4a280bedc6da6d25f4da611d1625ef` |
| Release ZIP SHA-256 | `e110a1c1e47247c00a931b629aeded35c2b7025f6e71bf37fd30823f6b949f1d` |
| `main.js` SHA-256 | `7fb339e9cf9fdbe5a801fa2b8ab85b366b5b3777fbd193cbc8728bc27711d125` |
| `manifest.json` SHA-256 | `f3e9581338648512baa12d5b458490f7fd367918f7bdb6bd86171ce57be7d08b` |
| Runtime dependency | exact upstream `moment@2.29.1` |

## Changed Artifacts

- Artifact/path/hash verifier: `src/main/calendar-plugin-artifact.ts`
- Isolated protocol and host: `src/main/calendar-plugin-protocol.ts`, `src/main/calendar-plugin-host-page.ts`, `src/main/calendar-plugin-host-*.js`
- Shared settings/contracts: `src/shared/calendar-plugin-settings.ts`, `src/shared/obsidian-plugins.ts`, `src/shared/types.ts`
- Renderer integration: `src/renderer/components/CalendarPluginFrame.tsx`, `src/renderer/components/DailyCalendar.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`
- IPC/settings integration: `src/main/index.ts`, `src/main/ipc.ts`, `src/main/settings.ts`, `src/preload/index.ts`
- Automated acceptance: `scripts/check-calendar-plugin-compatibility.mjs`, `scripts/check-calendar-plugin-electron.mjs`, `scripts/check-daily-calendar-electron.mjs`, Calendar test files under `tests/`
- Conformance truth: `7_conformance_matrix.md`
- Machine evidence: `docs/reports/assets/calendar-plugin-compatibility-2026-08-29/result.json`, `electron-acceptance.png`, `daily-calendar-electron.json`, `daily-calendar-markers.png`, `daily-calendar-activity-list.png`
- Installed delivery truth: `docs/reports/production-update-latest.json`

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 94 files passed, 1 skipped; 911 tests passed, 1 skipped |
| `npm run check:mcp` | PASS |
| `npm run build` | PASS |
| Exact artifact JSDOM acceptance | PASS |
| Working-tree Electron acceptance | PASS |
| Native fallback real-coordinate Electron acceptance | PASS |
| Visual screenshot inspection | PASS |
| First `npm run production:update` | PASS — 10/10 checks |
| Installed `app.asar` Electron acceptance | PASS — official Calendar path and native fallback path |
| Markdown safety | PASS — expected 3 creates, 0 deletes |
| Production profile preservation | PASS — 58 files and digest unchanged |
| `npm audit --omit=dev` | FAIL — one High vulnerability, two advisories, exact upstream Moment dependency |

The final production hashes and source fingerprint are intentionally read from `docs/reports/production-update-latest.json` after the last repository edit and final production update, rather than copied into this packet where they could become stale.

## Security Boundary And Residual Risk

- Only the fixed Calendar id/version/main/manifest hashes are accepted; missing, altered, wrong-version and symlink artifacts fail closed.
- Bytes verified by the main process are served through the dedicated `tsuzune-calendar://` protocol to avoid reopening an attacker-swappable path.
- Plugin code runs in a sandbox iframe with `nodeIntegration: false` and strict CSP. It receives a minimal Calendar-specific bridge, not Electron or unrestricted filesystem access.
- All Markdown create/open/trash operations remain in TSUZUNE's existing validated path. Acceptance proves cancel causes no write and only three expected fixture notes are created.
- Exact upstream `moment@2.29.1` has `GHSA-8hfj-j24r-96c4` and `GHSA-wc69-rhjr-hc9g`. The current local sandbox path has no remote settings or Node filesystem route, so the finding is accepted rather than hidden or auto-fixed. Any remote input, Node-side Moment use, generic plugin runtime, or broader locale input boundary requires re-evaluation.

## Delegation And Parent Integration

- Fermat (`calendar_conformance_audit`): compared the official README contract with implementation evidence and identified unproved confirmation, word-dot, locale, weekly-note, reveal and CSS paths. Parent adopted the findings and expanded the Electron acceptance until every listed target path passed.
- Parfit (`calendar_test_scout`): found the two missing Calendar methods in the broad `app.safety` mock. Parent adopted the exact minimal mock repair; the broad suite then passed 97/97.
- Faraday (`calendar_final_review`): adversarially reviewed the Moment audit finding and isolation boundary. Parent adopted the no-P0–P2 verdict and preserved the High finding as an explicit residual risk rather than changing the upstream dependency.
- Parent unseen-boundary checks: full 912-test suite, installed `app.asar` direct-entry acceptance for official and native paths, physical marker hit testing, outside-click/Escape/date-click separation, expected-change-only Markdown digest, profile digest preservation, final production fingerprint verification.

## Final Boundary

- Automated source, packaged and installed-runtime verification is complete after the final rollout recorded in the production receipt. The native fallback shows `＋` for creation and `•` for update, and its marker opens an activity list without taking over the daily-note date click.
- On 2026-08-29 the user opened the installed TSUZUNE in the real Vault, displayed the 2026-08-29 activity list with `作成 13` / `最終更新 23` and note rows, and confirmed `見えた`. Activity visibility and list opening are therefore `利用者確認済み`; outside-click and Escape are supported by automated real-coordinate acceptance.
- Compatibility claim remains Calendar 1.5.10 target-specific. A new Calendar version or another plugin starts a new fixed-target conformance item.
- This closeout changes orchestration/evidence documents only. It does not require another production installation of the already verified binary.
