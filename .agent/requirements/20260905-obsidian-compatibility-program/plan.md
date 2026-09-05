# Obsidian Compatibility Program

## Task Contract

- objective: TSUZUNEの現行PrimaryをObsidian互換性へ戻し、同じVault入力・同じ利用者操作・保存後・再起動後の公開挙動で差を測り、差分を小さな検証可能単位で閉じる。
- deliverables: 公式機能面を基準にした互換性台帳、現行source／既存証拠との照合、優先度付き実装順、最初のP0差分のtest-first実装と独立検証。
- constraints: personal／one-device／local Windows、Markdown正本、dirty worktree保全。LIFE Weather、組込みAI拡張、Vector DB、Hooks、任意community pluginの無制限実行、cloud service追加、production update、Git deliveryは今回行わない。
- success:
  1. 各対象を `matched / different / missing / not_proven / out_of_scope` と証拠時点つきで分類する。
  2. 利用頻度・データ安全・横断影響から選んだP0差分を一件、公開挙動testのREDから最小実装でGREENにする。
  3. focused testと未提示境界検証を通し、次の一手・Held・Researchを一意に残す。
- lane: Orchestrated。
- evidence: Obsidian公式Help、現在のrepository source／tests、既存の実機比較証拠、focused test、必要に応じたin-app browser確認。
- stop: production promotion、既存データの破壊、第三者plugin codeの実行、cloud／外部送信、互換性のために安全境界を迂回する変更、対象外moduleへの波及。

## Current Decision

### P0-7 Lossless Incoming Links — 2026-09-05

P0-7の参照元リンク追従を実装・source検証済み。単一Markdownノートの名前変更・移動にWiki／Markdown／frontmatter参照が追従し、別名・見出し・コメント・BOM・改行を保持する。32件の安全性test、実画面の4操作と再起動後の全file一致、隔離先userData／sessionDataの実測、本番profile 273 files不変を確認した。独立reviewのblocking findingは解消済み。本番反映の完了は、このsource fingerprintに対応する最新production receiptとinstalled実画面検証を記録した既存Vault campaignを正本とする。repo内記録はgate前に確定し、gate後に結果を重複追記しない。P0-6のprofile差分は原因未特定の過去証拠として保持する。 [Evidence](results/p0-7-lossless-link-maintenance.md).

- Owner selected 「続けよう」 after the P0-6 repair proposal. Implement incoming Wiki / Markdown links on human single-note rename / move; preserve aliases, fragments, frontmatter comments, BOM and line endings. Ambiguous targets, protected sources/history and conflicting revisions must not be overwritten. Folder operations, outbound relative-link preview and MCP move semantics remain outside this slice.
- Success: (1) public move tests prove lossless link following and collision behavior, (2) failure / crash / concurrent-edit tests preserve data through the existing journal, (3) required source gates and isolated installed acceptance pass before canonical completion.
- State owner: this entry. CEO-01 owns source, tests, integration, production gate and final campaign sync. A bounded Terra/high read-only profile audit runs alongside implementation because P0-6 isolation failed. Independent final review checks the multi-file update boundary. Use ai-coding-operator, ponytail, tdd; diagnose for profile isolation, existing tsuzune / execution-record and playwright for final evidence.
- Sequence: test-first implementation → focused safety tests and review → profile isolation probe and UI acceptance → finalize repo artifacts → official production update → receipt and final Vault sync. Existing approved source manifest plus exact task delta identifies the promotion boundary. No Git delivery or new dependency.
- Stop: unresolved data-safety finding, profile drift, unexpected source delta or running production app. Do not force-close user apps or restore unexplained profile differences.

### P0-6 File Operations Comparison — 2026-09-05

P0-6の名前変更・移動・同名衝突の実機比較は完了。installed TSUZUNE 0.6.0と固定Obsidian 1.13.4で、path操作・衝突時の既存file保護・再起動後の保持を確認した。TSUZUNEは参照切れを警告するが本文を更新せず、Obsidianはリンクを追従する一方でBOM／改行・参照元コメントを変える。次の修正候補は参照元リンクの非破壊追従一件。実装は未着手。検査47 PASS／1 FAILで、本番profileのキャッシュ・セッション10件の差分は原因未特定。設定・installed本体は一致した。次の実機試験前にprofile／session保存先と本番app並行稼働を確認する。

- Contract: Owner selected paired rename / move / collision observation, save and restart checks, and one next repair candidate. No product implementation, build, install or Git delivery. CEO-01 executes sequentially; the bounded task state is `work/p0-6-file-operations/plan.md`.
- Evidence: [P0-6 comparison](results/p0-6-file-operations.md). Comparison is complete with a failed profile-invariance condition; do not relabel it fully isolated PASS. Documentation-only updates after the preceding promotion change the repository-wide fingerprint while installed executable hashes stay unchanged.
- Next: Owner selection is required for the proposed repair. Before a further live fixture, establish profile/session isolation and concurrent production activity. Existing Held / Research items are unchanged.

Earlier sections below retain the historical contract and checkpoint wording. Current production identity is owned by the installed receipt; current repair state is the P0-7 entry above; P0-6 and earlier checkpoints are historical.

### Whole-tree Production Promotion — 2026-09-05

- objective / deliverables: Owner explicitly selected 「全体を既存の検証・更新手順で導入する」. Promote the audited current tree to this PC through npm run production:update and persist verified acceptance in the existing campaign.
- constraints: Preserve dirty source and user data; no feature addition, Git publication, forced application closure or active-Vault automated smoke. Existing OAuth build configuration and MCP registration are within the approved production gate.
- success: (1) Official checks and isolated packaged/installed smoke pass, (2) built/installed EXE and asar hashes match and production profile remains byte-identical, (3) source delivery and fresh MCP receipt behavior are verified and the existing Vault campaign is synchronized.
- execution: CEO-01 owns the sequential release and final verification; use ai-coding-operator, existing codex-dynamic-workflows state, tsuzune and tsuzune-execution-record. No new delegation is needed for the serial official gate.
- evidence / state: Finalize repository-owned artifacts before the gate snapshot. Thereafter docs/reports/production-update-latest.json owns the installed result; work/production-update-20260905 holds ignored gate output and per-path source manifest. Final Vault receipt owns synchronization status. Do not edit fingerprinted repository files after gate success merely to copy its result.
- stop: Failed required check, source/profile drift, running production app, or a repair that expands approved scope. Preserve failure evidence; routine authorized fixture/harness fixes can be verified and the full gate rerun.
- approval recorded at: 2026-09-05T10:26:14.411Z; whole-tree promotion is authorized. User also confirmed that TSUZUNE was closed.


### Production Promotion Scope Audit — 2026-09-05

- objective / deliverables: Owner selected inspection of the changes a production update would promote. Establish the installed artifact identity, distinguish current-source changes from an exact installed delta, and produce one reviewable scope report with a recommended next route.
- constraints / stop: Preserve all dirty source, installed binaries, running apps, production profile and MCP registration. No build, install, package, Git mutation, source repair, dependency installation or secret output. A whole-tree promotion still needs explicit scope approval unless a verified production-equivalent boundary is reconstructed.
- success: (1) Receipt versus current installed binary/asar hashes verified, (2) shipped build inputs and meaningful changes classified with evidence and unknowns, (3) approval-ready comparison of retaining production, whole-tree promotion and bounded reconstruction, with actual required gate commands.
- lane / evidence / state: Continue the existing Orchestrated lane and state.json. Report: results/production-promotion-scope-20260905.md; bounded inventories under work/production-scope-20260905. No new state system.
- execution: CEO-01 integrates with ai-coding-operator, project-closeout, ponytail, codex-dynamic-workflows and tsuzune. Two read-only packets independently inspect baseline reconstruction evidence (Luna low) and changed product scope/reachability (Terra medium). Parent owns installed hashing, gate tracing, conclusions, final verification and Vault writeback.
- outcome: Scope audit complete; report and bounded installed comparisons are recorded. Whole-tree production promotion awaits Owner decision. No production-equivalent source reconstruction is certified.
- delegation: Agents may read only their named source/report surfaces, return path/hash evidence, and never write Vault/source, run builds, change Git, install or expose bundled credentials. Baseline ambiguity is returned to parent. Parent checks final source/installed invariance before accepting the result.

### P0-5 Checkbox Authoring Contract — 2026-09-05

- objective / deliverables: Owner selected the next Obsidian compatibility item. Add note-local checkbox Properties creation, true/false toggling, deletion and read-only preview using the existing revision-checked save. Keep source Markdown lossless outside the selected property.
- constraints: Preserve the dirty checkout and current production runtime. No Zen UI changes, global property-type registry, null/text coercion, checkbox list items, dependency, IPC, account or Git delivery. Production promotion retains the existing whole-tree approval or verified reconstruction gate.
- success: (1) Native keyboard-accessible checkbox operations preserve boolean types after save/reload, (2) non-target bytes, comments, BOM/EOL and stale-save protection pass meaningful fixtures, (3) focused/full regression, typecheck and independent review establish the source boundary; isolated paired-app evidence bounds compatibility claims.
- lane / owner: Existing Orchestrated lane; state.json owns execution status. Initial executor CEO-01 owns product code, acceptance, integration and Vault writeback. Read-only Luna/low scouts verify official checkbox semantics and the existing runtime harness/receipt; independent review checks the final diff. Use ai-coding-operator, tdd, ponytail, codex-dynamic-workflows, tsuzune; borrow playwright for the isolated native Electron comparison and ponytail-review at completion.
- accepted syntax: Top-level unquoted true/false and YAML boolean case forms True/False/TRUE/FALSE; unchanged confirmation preserves original bytes. Quoted strings remain text. Empty/null, yes/no/on/off, complex YAML and global type assignment remain outside this form contract. Mutation writes canonical lowercase true/false.
- evidence / stop: Source hashes, test logs, isolated app fixtures/screenshots and results/p0-5-checkbox-properties.md. Stop promotion if the dirty source cannot be identified as the approved production boundary; never close the user's app. This slice does not automatically select the next feature.

- 工房主の2026-09-05判断により、Obsidian互換性を現行Primaryとする。
- 「追いつく」は機能名の存在ではなく、同じ入力・操作・永続化・再起動後の観測可能な挙動一致で判定する。
- 達成境界は「同じlocal VaultをTSUZUNEで開き、内容・metadataを失わず、日常の作成・編集・検索・再開ができる」とする。機能数やpixel parityは目的にしない。
- Obsidian固有のcloud商用service、Publish、無制限plugin runtimeは一括模倣せず、local product境界と安全性を保ったまま `out_of_scope` または個別判断へ分離する。
- P0-1 Excluded filesとP0-2〜3文字列／数値／単純list Propertiesのcurrent-source実装・検証は完了した。focused 117／全体1099 tests PASS（1 SKIP）、typecheck／独立review PASS。実行順は下記の工房主承認順を維持する。P0-5のチェックボックス型Propertiesは追加・切替・削除・preview・保存・再読込をsource実装し、全体1124 tests PASS（1 SKIP）、隔離した固定Obsidian 1.13.4との実機26検査をPASSした。真偽値の切替・再起動後の状態は一致。新規未チェック値（TSUZUNE=false／Obsidian=空欄）とコメント／BOM／改行の保存は異なり、TSUZUNEの非破壊保存を維持する。再起動後にMCPの記録同期を完了し、既存campaignと3入口をrevision付きで更新、読み戻し・一意検索・相互リンクを確認した。Ownerが2026-09-05に現source全体を既存の検証・更新手順で導入することを明示承認した。対象はExcluded files、各型Properties編集、Context利用・状態由来レシートを含む現tree。導入結果はdocs/reports/production-update-latest.jsonの本承認後のreceiptとdelivery_infoを正本にし、既存campaignへ受入証拠を保存する。新機能やGit公開は自動着手しない。本番反映と全面Properties互換は未達。

## Compatibility Surfaces

### P0-4 Paired Properties GUI Comparison — 2026-09-05

- Current boundary: comparison, fresh-process reopen, local evidence and final Vault writeback are complete. After the owner's restart, the campaign and three hubs were fetched, revision-checked, patched once each, and read back with exact content matches. Unique campaign lookup and the three hub backlinks are verified. `results/p0-4-pending-tsuzune-writeback.json` retains the initial block and completed synchronization evidence. This completes P0-4 only; it does not start implementation or production/MCP configuration changes.
- objective / deliverables: Run the same anonymous text/decimal/simple-list note inputs and public form operations in the extracted official Obsidian 1.13.4 runtime and the current-source TSUZUNE Electron app; record semantic types, saved bytes/comments, reload/restart outcomes, screenshots and exact versions/hashes.
- constraints / stop: Isolated fixture Vaults and user-data profiles only. Preserve dirty product source and production profiles/processes. No product fixes, dependency installation, production update, Git delivery, external data or account use. Any actual difference is evidence for a later selected fix, not permission to broaden implementation.
- success: (1) Paired real-app observations for basic text/number/list edits and precision/comment boundaries, (2) persisted files and fresh-process reopen are checked, (3) a bounded matched/different/not-proven matrix and next action are integrated into the existing campaign.
- lane / execution: Existing Orchestrated lane; CEO-01 owns runtime operations, integration and final writeback. Two read-only Luna/low scouts independently locate isolation harnesses and derive the minimum acceptance matrix; a final evidence review checks claim boundaries. Use existing Electron/Playwright paths where in-app browser cannot operate native Electron targets.
- evidence / stop: Anonymous fixture snapshots and screenshots under output/playwright; durable report in results/p0-4-properties-paired-comparison.md. Stop isolated app actions if profile identity or target path is uncertain; never close the user's production TSUZUNE.
- Skills: orchestrate-skills routes; ai-coding-operator and codex-dynamic-workflows own task/integration; playwright is the bounded Electron fallback; ponytail keeps the harness minimal; tsuzune and tsuzune-execution-record preserve the final campaign result.

### P0-3 Number and List Authoring Contract — 2026-09-05

- objective / deliverables: Add, edit, delete number and simple list properties through the editor, preserving scalar types and non-target bytes through revision-checked save and reload.
- constraints / stop: Existing dirty checkout preserved; no production update, Git delivery, new dependency, general YAML parser, global property registry or unrelated feature changes. Complex/ambiguous syntax remains source-only.
- success: (1) public UI round trips text/decimal-number/list without implicit type conversion, (2) real temporary Vault preserves non-target bytes/comments/BOM/EOL and rejects stale saves, (3) focused/full regression, typecheck and independent safety review pass.
- accepted syntax: Decimal integers/fractions (signed, lexical representation retained; no JS Number coercion), simple block and single-line flow lists of text and decimal numbers. Quoted numeric text stays text; unsupported numeric forms and nested/anchored/tagged YAML are preserved or refused. Unchanged values are byte-preserving no-ops. No claim of fresh paired Obsidian parity.
- execution: Initial owner CEO-01, production profile; existing Orchestrated lane and state.json remain state owner. Parent owns UI, disk/App acceptance, integration and final TSUZUNE writeback. Core worker owns only frontmatter.ts and dedicated typed-core tests; read-only reviewer checks final safety independently. Distinct implementation surfaces and independent data-loss checks justify delegation. Skills: ai-coding-operator, tdd, ponytail, tsuzune, codex-dynamic-workflows; final ponytail-review and execution record.
- evidence: source/isolated fixture layer; results/p0-3-properties-number-list.md. Start work item tsuzune-properties-number-list-20260905; no installed/live claim.

### P0-2 Current Slice Contract

- objective / deliverables: 文字列プロパティを編集画面から追加・編集・削除し、通常のrevision-checked保存と再読込まで固定する。core helper、editor UI、保存・実ファイルfixture、結果記録を対象とする。
- constraints: top-levelの英数字・underscore・hyphen名と安全に読める文字列のみ。非対象YAML・本文・BOM・改行・コメントを保持する。数値／真偽値／日付／null／list／mapping／anchor等はフォームから変換しない。新依存・IPC・DBなし。本番更新・Git送信なし。
- success: (1) 公開UIで追加・編集・削除できる、(2) 保存・再読込後の非対象byteとrevision保護が維持される、(3) malformed／曖昧値を拒否しfocused・全体回帰・独立境界確認を通す。
- execution: 親agentがUI・保存配線・統合・最終書戻しを所有。core safetyとApp受入testは別fileへ分離し、独立reviewはread-only。進捗の状態正本は`state.json`。
- evidence / stop: test-first、実ファイルround-trip、既存保存競合test、独立review。対象外の型拡張、production promotion、破壊的なYAML再構築は停止線とする。Obsidian実機とのfresh paired comparisonなしでは全面互換を宣言しない。

1. Core authoring: Markdown／attachments、editor、Properties、file operations、settings、workspaces。
2. Retrieval and navigation: Search、Quick switcher、links／backlinks、outline、bookmarks、tags。
3. Structural views: Graph、local graph、Canvas、Bases。
4. Daily use: Daily notes、templates、command palette、hotkeys、file recovery。
5. Extension and transport: core plugins、selected community plugins、Clipper、Sync／conflicts。

Cloud hosting and unrestricted third-party execution are comparison rows, not automatic implementation commitments.

## Work Order

1. Official surfaces and version/freshness boundariesを固定する。
2. Core authoring／navigationとstructural viewsを独立にsource・test・existing evidenceへ照合する。
3. `matched / different / missing / not_proven / out_of_scope` 台帳を統合し、P0候補を利用価値・データ安全・実装規模・横断効果で順位付けする。
4. 最上位一件のpublic-behavior testをREDにし、最小実装、focused GREEN、未提示境界検証を行う。
5. repository plan/statusとproduction TSUZUNEを最終検証済み境界で一度だけ同期する。

## Priority Rules

- P0: 日常の編集・発見を壊す、または同じVaultでデータ／見え方が不整合になる差。
- P1: 主要構造探索surfaceの不足・不一致。
- P2: core pluginの個別機能、選択済みcommunity plugin互換。
- Held: cloud、Publish、generic plugin runtime、観測需要のない高度機能。
- Research: 公式仕様だけで挙動を確定できず、隔離fixtureで実機比較が必要な項目。

## Owner-Approved Priority Order — 2026-09-05

1. **データを壊さない互換性:** Markdown／YAML／Properties、attachments／files／links、rename／move／collision、external edits／conflict／recovery境界。文字列／数値／単純list Propertiesはsource検証済み。P0-5のチェックボックス型Propertiesは追加・切替・削除・preview・保存・再読込をsource実装し、全体1124 tests PASS（1 SKIP）、隔離した固定Obsidian 1.13.4との実機26検査をPASSした。真偽値の切替・再起動後の状態は一致。新規未チェック値（TSUZUNE=false／Obsidian=空欄）とコメント／BOM／改行の保存は異なり、TSUZUNEの非破壊保存を維持する。再起動後にMCPの記録同期を完了し、既存campaignと3入口をrevision付きで更新、読み戻し・一意検索・相互リンクを確認した。Ownerが2026-09-05に現source全体を既存の検証・更新手順で導入することを明示承認した。対象はExcluded files、各型Properties編集、Context利用・状態由来レシートを含む現tree。導入結果はdocs/reports/production-update-latest.jsonの本承認後のreceiptとdelivery_infoを正本にし、既存campaignへ受入証拠を保存する。新機能やGit公開は自動着手しない。
2. **毎日の操作互換性:** Editor、Search、Quick Switcher、Backlinks、named Workspaces／restart restore、Daily Notes、Templates、Hotkeys。
3. **構造表現の互換性:** Canvas、Properties安定後のBases、残るGraph／Local Graph差分。
4. **選択した拡張だけの互換性:** 工房主が実利用pluginと目的を選択した後、その対象だけを扱う。generic／unrestricted community plugin runtimeは作らない。

HeldはObsidian Sync／Publishの模倣、cloud／account、無制限plugin runtime、互換性だけを理由にした新DB／daemon／Hookとする。台帳各行のP0／P1／P2は差分内の局所緊急度であり、この4段階の実行順を上書きしない。

## Initial Evidence Baseline

- Official file formats: https://obsidian.md/help/file-formats
- Official core plugins: https://obsidian.md/help/plugins
- Official Graph: https://obsidian.md/help/plugins/graph
- Official Bases syntax: https://obsidian.md/help/bases/syntax
- Official community plugins: https://obsidian.md/help/community-plugins
- Official Sync and conflicts: https://obsidian.md/help/sync and https://obsidian.md/help/sync/troubleshoot

## Decision Pressure Test

- strongest counterevidence: Obsidianの全surface・全plugin・cloud serviceを一括で追うと、TSUZUNEのlocal安全境界を壊し、検証不能な「互換」を増やす。
- do nothing: 現在の独自価値は維持できるが、日常操作の小さな差が乗換えcostとして残り続ける。
- smallest reversible alternative: 公開挙動台帳を正本にし、P0を一件ずつtest-firstで閉じる。差分が意図的なら `different` と理由を固定する。
- selected direction: 網羅台帳は広く持ち、実装は一度に一件。互換claimは証拠のある行だけに限定する。
