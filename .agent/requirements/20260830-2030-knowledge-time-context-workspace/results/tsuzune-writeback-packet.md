# TSUZUNE final writeback packet

## Restart gate

- Required runtime state: `stale_runtime:false` from a newly started Codex MCP client.
- Current stale process started at `2026-08-30T10:53:10.147Z`, before build update `2026-08-30T12:09:32.274Z`.
- Do not bypass `STALE_RUNTIME_WRITE_BLOCKED` and do not terminate a connected MCP process from this task.
- `delivery_info:mismatch` after closeout artifacts is expected and does not require reinstalling unchanged product code. The verified production receipt remains `docs/reports/production-update-latest.json`.

## Atomic note to create first

Path: `30_知識/TSUZUNE-知識の時間Context Workspace実装・本番受入-2026-08-30.md`

```markdown
---
type: execution-record
status: complete
updated: 2026-08-30
observed_at: 2026-08-30T21:09:32+09:00
scope: product:tsuzune
feature: knowledge-time-context-workspace
---

# TSUZUNE 知識の時間 Context Workspace 実装・本番受入

## 結論

利用者が選択したB案「専用ワークスペース」を、中央ペインの読取専用 **知識の時間** として実装し、本番TSUZUNE v0.6.0へ反映した。選択ノート・目的・時点・時間軸・履歴範囲から、既存のContext Compiler／Temporal Memoryが選んだ根拠、選定理由、時間状態、警告、省略情報を一画面で確認できる。

これは「答えを生成するAI画面」ではなく、Markdown正本から「なぜ今この文脈が選ばれたか」を人間が検証するためのContext Workspaceである。

## 利用者から見える変更

- Activity Railの時計アイコン、またはコマンドパレットの「知識の時間を開く」から中央ワークスペースを開く。
- 起点ノート、目的、基準日時、knowledge-time／valid-time、履歴を含めるかを指定する。
- 結果には時間の流れ、警告、採用根拠、選定理由、抜粋、更新日時、省略ノートを表示する。
- 「原典を開く」は既存の安全なノートopen経路を使う。
- 右サイドバーは維持し、Escapeで閉じ、開始位置へフォーカスを戻す。
- loading／error／emptyを区別し、古い非同期応答は現在画面へ混入させない。

## 実装境界

- Renderer専用workspace、trusted IPC、preload API、既存`buildContextBundle`とTemporal Memoryを再利用した。
- scanは`persistCreationTimes:false`で実行し、閲覧によるcreation-time sidecar更新を行わない。
- Vault相対のMarkdown pathだけを受け付け、入力長・日時・時間軸を検証する。
- future／省略対象の本文はRendererへ渡さず、excerptは採用済みpathの内部source markerだけから抽出する。
- note本文にあるmarker文字列はcompiler側でescapeし、重複／曖昧なsource framingはfail-closedにした。
- 新しいDB、vector DB、常駐Hook、全Vault ingestion、内蔵AI／chat、generic Obsidian plugin runtime、ノート書換えは追加していない。

## 検証済み証拠

- focused context／IPC tests: 58 PASS。
- full suite: 922 PASS／1 SKIP（96 files PASS／1 SKIP）。
- `npm run typecheck`、`npm run build`、`npm run check:mcp` PASS。
- code／security／UX再レビューでP0〜P2残件なし。
- 隔離fixture Vault／隔離profileのvisual acceptanceで1440、1024、720pxを確認し、横overflowなし、右サイドバー維持、720pxで最後の根拠まで到達可能。
- `npm run production:update`: 10/10 PASS。
- installer SHA-256: `e8f5178e175670d3ee0b0c1574af752054aec72a6dba5dc96cd841cd0078e833`。
- built／installed executable SHA-256一致: `dcde25fafced680c26162260908d0f8f1b2119d34e46c864f8c0eaf781d3199b`。
- built／installed `app.asar` SHA-256一致: `5e3c612d9cea4f3f00a0de90001a5176aed9aa8bc96293c01e525fa9b58c687e`。
- production profileは61 files、digest `93d086d35bcb2b9679f764a30d4490984d0d72c44f6d7883468e40c32da8e129`で前後不変。
- production receipt: repository `docs/reports/production-update-latest.json`、verifiedAt `2026-08-30T12:09:32.592Z`。

## 状態と未確認境界

- Source: **実装済み**。
- Installed production: **本番反映済み**。
- Isolated packaged／installed smoke: **動作確認済み**。
- 実Vaultでの利用者操作: **未確認**。利用者が次回TSUZUNE起動後に確認する。
- final writeback時のfresh MCP runtime情報をここへ反映し、古いruntime記述を残さない。

## 次の一手

新しい製品Primaryを自動作成しない。次はinstalled TSUZUNEの日常利用で、起点・目的・時点を変えたときの「根拠の分かりやすさ」を観測する。具体的な摩擦が再現した場合だけ、同じworkspace内の最小改善を契約する。

## 関係

- project: [[10_プロジェクト/TSUZUNE]]
- roadmap: [[30_知識/TSUZUNE開発ロードマップ]]
- architecture: [[30_知識/TSUZUNEシステム設計]]
- context-compiler: [[30_知識/TSUZUNE-Context CompilerとTemporal Memory]]
- root-principles: [[30_知識/TSUZUNE-根幹思想-知識循環と構造探索]]
- navigation: [[00_入口/TSUZUNE運用・開発資料]]
```

## Existing notes to patch once each

Fetch each immediately before a revision-guarded patch. Do not duplicate specifications in hubs.

1. `10_プロジェクト/TSUZUNE.md`
   - Add the atomic note to `今見る場所`.
   - Replace the latest installed-production boundary with Knowledge Time evidence while retaining Calendar as prior verified history.
   - State that there is no new product Primary; next is daily-use observation and user confirmation.
2. `30_知識/TSUZUNE開発ロードマップ.md`
   - Add a dated Complete section for Knowledge Time.
   - Keep generic plugin runtime, embedded AI/chat, DB/vector DB, Hooks, and whole-Vault ingestion Held.
   - Set next to natural-use observation; no automatic follow-on slice.
3. `30_知識/TSUZUNEシステム設計.md`
   - Update `updated` to 2026-08-30.
   - Add the read-only Knowledge Time relation between the renderer workspace and existing Context Compiler / Temporal Memory.
4. `00_入口/TSUZUNE運用・開発資料.md`
   - Update `updated` to 2026-08-30.
   - Make the atomic Knowledge Time note the latest verified UX/product boundary.

## Final verification

1. Fetch the atomic note and compare its rendered content with this packet.
2. Get backlinks for the atomic note without history.
3. Require reachable backlinks from project, roadmap, system design, and navigation entry.
4. Read back all four patched notes and confirm exactly one atomic link in each.
5. Only then mark workflow `persisted -> complete` and complete the active goal.

## Completion result

- Completed through a fresh MCP runtime with `stale_runtime:false`.
- Atomic note revision: `sha256:fa3d2854e79f430f428dd4a797ce3dfbf5dd73bb17314e4abda3406c6710a974`.
- Project revision: `sha256:b3c529016b1188a2c75cc2c213f734ecab39a5745bcfb7aa1f62d6ba2a4abc5f`.
- Roadmap revision: `sha256:52032324740bd8f733d9adb88264d54d24c77a2440057e6aaede48da5da19636`.
- System-design revision: `sha256:c7b96ecede277a6c9a9c0cf681c27684685950b2c0c99dce069cca561f64034c`.
- Navigation revision: `sha256:cf5ece8ceb6e781ec6706ca50f88567ec77e0a11ecf9ff627bfb742ab8e950b6`.
- Read-back: all notes untruncated; each entry contains exactly one atomic link; backlinks total 4 with the expected four sources.
