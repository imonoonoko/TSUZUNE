# Context Explorer — Implementation Brief

状態: proposal-revised。実装開始の承認ではない。

## 1. 実装の中心

新しいdashboardや探索管理基盤は作らない。現行の3-pane workspaceへ、既存`buildContextBundle`の結果を本人向けに表示するread-only surfaceを接続する。

初回は一つの現在ノートをseedとする。問いは任意の`query`として渡す。複数seed、手動include／exclude、typed relationは条件付き拡張に留める。

## 2. 再利用する現行資産

- Context選定: `src/core/context.ts`
- Search: `src/core/search.ts`
- Wiki link／backlink: `src/core/links.ts`
- Temporal／provenance: `src/core/temporal.ts`, `src/core/frontmatter.ts`
- Workspace／保存境界: `src/renderer/App.tsx`
- 現行関連表示: `src/renderer/components/RelatedNotes.tsx`, `TemporalDetails.tsx`
- 原文移動: `MarkdownPreview.tsx`, `WikiGraphView.tsx`, 既存tab経路
- AI Review: `src/mcp/review-proposals.ts`, 既存IPCとSettings差分UI
- MCP transport: `src/mcp/service.ts`, `src/mcp/server.ts`
- revision／history／policy: `src/mcp/service.ts`, `src/shared/ai-write-policy.ts`

## 3. Slice別の最小変更

### CE1 — Visible Context

候補file:

- 追加: `src/renderer/components/ContextExplorer.tsx`
- 更新: `src/renderer/App.tsx`
- 更新: `src/renderer/styles.css`
- 追加または更新: component／app test

方針:

- Rendererは既にcoreのsearch、links、Temporalを直接利用しているため、最初からIPCを増やさない。
- 保存済み`VaultSnapshot.notes`と`pathAliases`を`buildContextBundle`へ渡す。
- 探索開始時に未保存変更があれば既存`flushSave`を通し、成功後のsnapshotで構築する。失敗時は探索開始を止める。
- `generatedAt`と`asOf`は一回の構築内で固定し、不用意なrenderごとの再生成を避ける。
- UIはincluded、selection reasons、temporal status、omitted、warning、truncated、Markdown preview／copyだけを扱う。
- source clickは既存`openNote`／new tabを再利用する。独自navigation stackを作らない。
- 右sidebar内の「関連」と「探索」を切り替える。第4pane、dashboard、floating card群は追加しない。

### CE2 — Shared Contract Verification

候補test:

- `tests/context.test.ts`
- 新規`tests/context-explorer.test.tsx`または既存app safety test
- `tests/mcp-service.test.ts`

固定するもの:

- 一つのfixtureと固定`generatedAt`／`asOf`／query／budgetをcore、Renderer、MCP adapterへ入力する。
- included path、relation、selectionReasons、temporalStatus、contentOmitted、truncated、omittedPaths、warnings、markdownを比較する。
- missing／ambiguous link、Temporal warning、historical request、budget truncation、Path Alias、history既定除外を含める。
- Explorer表示とcopyはwrite APIを呼ばず、Vault／履歴／profileを変更しない。
- 保存失敗時に古いdisk snapshotと現在editor内容の同一性を偽らない。

### CE3 — Knowledge Return Reconnection

候補file:

- 更新: `src/renderer/App.tsx`
- 必要なら更新: `ContextExplorer.tsx`

方針:

- 既存`listAiReviewProposals`を再利用し、included pathに一致するproposalの有無だけを表示する。
- proposal schema、store version、apply処理は変更しない。
- review詳細は既存Settings UIへ移動する。新しいdiff viewerを複製しない。
- 承認／取消後の既存`refreshSnapshot`でExplorerも再構築する。
- 通常pathのAI自動更新に新しいinboxを強制しない。既存policyを維持する。

### CE4 — One-loop Acceptance

- fixtureの成功例だけで閉じず、利用者が必要とする一つの実作業を使う。
- search→seed→Context確認→原文確認→本人またはCodex利用→既存安全write→Context再構築を通す。
- 探索だけではMarkdown、`50_履歴/AI更新`、profile行動logが増えないことを前後countで確認する。
- 製品コード変更を含む最終snapshotだけ公式`npm run production:update`へ進める。

## 4. State契約

初回の探索stateはRenderer memoryだけに持つ。

- open／closed
- seed path
- query
- asOf
- temporal perspective
- max characters
- last built bundle

アプリ再起動後の復元、探索履歴、最近の問い、session一覧は実装しない。必要な知識は本人が通常Markdownへ明示的に残す。

## 5. UI契約

- 初期表示は現行workspaceを維持し、探索を強制しない。
- 現在ノートがない時はExplorerを開始できない。既存検索から一件選ぶ案内だけを出す。
- 「なぜ含まれたか」をsourceごとに短く表示する。
- omitted／warning／truncatedは折り畳めても、0件と存在する状態を区別する。
- temporal statusとwarningは色だけに依存しない。
- 原文を開く操作で未保存内容を失わない。
- 720px幅、keyboard-only、100%／200%拡大、accessible name／focusを確認する。

## 6. Simplicity constraints

- 新規依存0。
- 新規DB、index、cache、daemon、telemetry、session file 0。
- Context選定関数は一つ。Renderer専用rankingを作らない。
- 初回はsingle seed。multi-seed用の抽象化を先に作らない。
- `ContextExplorer`のために`App.tsx`全体をstate frameworkへ移行しない。
- RelatedNotes、TemporalDetails、Graph、Review UIを削除・再実装しない。
- Context MarkdownをVaultへ自動保存しない。

## 7. 検証gate

各製品sliceで最低限次を通す。

1. 対象component／context／MCP parity test。
2. `npm run typecheck`。
3. `npm test`。
4. MCP contractに変更がある場合は`npm run check:mcp`。初回案ではMCP schema変更なし。
5. `git diff --check`。
6. `@ponytail-review`で重複retrieval、不要state、将来用抽象化がないことを確認。
7. UI変更は隔離Electronで表示、原文移動、戻り、再表示、狭幅、focusを確認。
8. 最終製品snapshotだけ`npm run production:update`を実行し、installed smoke、hash、profile不変、MCP再登録を確認。

## 8. Conditional extensions

初回Track完了後、requirementsの開始条件を満たした項目だけ別sliceとして要件化する。

- multi-seed／manual include-exclude
- typed Markdown relation
- grouped AI result

既存Context Explorerへ将来用interfaceやplaceholderを先に追加しない。
