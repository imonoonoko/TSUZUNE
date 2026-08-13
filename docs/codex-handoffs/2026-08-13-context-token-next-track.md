# Codex Session Handoff: Context／Token優先の次Track再選択

## Reactivation Prompt

```text
We are continuing from this handoff:
C:\Users\Humin\Documents\Codex\TSUZUNE\docs\codex-handoffs\2026-08-13-context-token-next-track.md

Read that document first, then inspect the current repo state and production TSUZUNE. Do not assume the old chat context is available. Continue from the Next Steps section, verifying source/config identity before changing files or global config.
```

## Context

- Repo/path: `C:\Users\Humin\Documents\Codex\TSUZUNE`
- Branch/HEAD at handoff: `agent/tsuzune-mcp-integration` / `5266131f6e2c38afc39b46fe9083c9e1fef39577`
- Current goal: 品質、出典、安全性を落とさず、Codexの実taskにおけるContext／token消費を減らす。
- User priority: Context／token問題を最優先にする。ただしTSUZUNEへAI runtime、独自agent loop、巨大middlewareを組み込まない。
- Working tree: dirty。handoff作成時点で332 paths（modified 33／untracked 299）。利用者と過去taskの変更を保持する。

## Current Decision

- 現在観測された最大要因はTSUZUNEのbundle量ではなく、長大taskで安定した会話prefixがturnごとに再提示されること。
- Native 10 taskではinput 42,806,336、cached input 41,566,464（97.10%）。実費は未観測。
- single-worker matched pairではfresh task側のinputが88.58%少なく、両側529 tests PASS。ただし一対だけの値で一般化しない。
- その後の自然task監視3件はFAIL／PASS／BLOCKED。fresh taskは「cleanで境界明確な長大task」に限り、source/config identity preflight付きで条件採用する。
- X1-C2の固定fixtureでは4k／6k／8k／15kが同じcanonical Contextを返した。4k化してもfixture上のContext量を減らしていないため、既定値変更やhost再採点を次の最優先実装にしない。
- BM25、FTS、SQLite、embedding、GraphRAG、Hooks順位、永続cache／task stateは、対応する反復失敗の証拠がないため保留する。
- 単一・現在・明示sourceは`search → fetch`、複数根拠・時点・provenanceは`build_context`という段階取得を維持する。

## What Changed In The Closing Session

- root `package.json`混入の書き込み元を特定した。隔離Obsidianの版確認で`asar extract-file ... package.json`をrepository rootから実行した診断事故だった。
- `package.json`をcommit `5266131`のcanonical TSUZUNE 0.5.0 manifestへ復旧。`package-lock.json`は変更なし。
- typecheck、58 files／529 tests、MCP smoke、製品build、diff checkをPASS。
- 利用者の明示了承後、公式`npm run production:update`を完走。CP1-B-02を含むworking treeを本番反映した。
- installed v0.5.0は10/10 production checks、built／installed EXE・app.asar hash一致、production profile 57 files不変、MCP再登録を確認。
- Codex Desktop再起動後、production MCPの`fetch`と`build_context`を実呼出しして正常応答を確認。

## Files Touched Or Investigated

- `package.json`（canonical HEADと一致し、現在diff 0）
- `PLAN.md`
- `PROJECT_STATUS.md`
- `docs/INDEX.md`
- `docs/reports/package-manifest-repair-2026-08-13.md`
- `docs/reports/production-update-latest.json`
- `docs/reports/context-profiler-native-baseline-2026-08-12.md`
- `docs/reports/context-budget-priority-2026-08-12.md`
- `docs/reports/progressive-context-route-baseline-2026-08-12.md`
- production TSUZUNE note `10_プロジェクト/TSUZUNE.md`、revision `sha256:68482bb29061cd8afd7ac58474156f5e1fe5ad43a52f614b7fcad246f6249a74`

## Commands And Checks Already Run

- `npm run typecheck` — PASS
- `npm test` — 58 files／529 tests PASS
- `npm run check:mcp` — 4 read tools／3 write tools PASS
- `npm run build` — PASS
- `npm run production:update` — `installed-and-verified`、10/10 checks PASS
- post-restart production MCP `fetch`／`build_context` — PASS
- `git diff --check` — PASS

## Known Issues And Boundaries

- Actual billing cost、cache discount、source／revision／range単位の再読は未観測。input tokenから費用削減を推定しない。
- 88.58%は一つの固定pairだけの値。全taskへ外挿しない。
- 現在のworking treeは本番receiptでfingerprint検証済みだがGit上はdirty。clean commitを意味しない。
- Git commit、push、GitHub release公開は未実施。
- Excluded files Manage UI／FileTree parity、Windows実機accessibility、O1 7-day dogfoodは未完だが、Context削減の根拠なしに混ぜない。

## Next Steps

1. 新規taskでこのhandoff、production TSUZUNE、`git status --short`、`package.json` identityを最初に確認する。
2. 新しい実依頼を一件だけ選ぶ。長大taskなら短いhandoff＋targeted retrievalを使い、旧chat transcriptを再投入しない。
3. Context関連の次の実験は、自然taskで「同一sourceの再読」「巨大tool output」「不必要なbundle」が反復観測された場合だけ、その一因へ限定する。
4. 反復証拠がなければContext製品機能を増やさず、ユーザー価値の高い次の製品Trackを別途選ぶ。
5. 変更する場合は1〜3 success conditions、stop condition、write boundaryを先に固定し、正式gateと本番境界を守る。

## Do Not Touch / Be Careful

- 古いchat全体を新規taskへ貼り直さない。このhandoffと必要なTSUZUNE sourceだけを使う。
- BM25、FTS、embedding、GraphRAG、独自cache、background profiler、agent runtimeを先行実装しない。
- raw error、diff、revision guard、security／accessibility証拠をtoken削減目的で省略しない。
- repository外のarchiveを展開する診断は、必ずrepository外の一時directoryをworking directory／出力先にする。
- dirty working treeの既存変更をreset、restore、checkoutで消さない。
