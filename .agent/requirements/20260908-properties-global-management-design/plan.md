# 全体Properties／型管理 設計

- 作成日: 2026-09-08 JST
- 状態: step2-complete
- lane: Planned
- 状態の正本: この `plan.md`
- 成果責任: CEO-01
- 対象: TSUZUNEのVault全体Properties Inventoryと、その後の型管理へ進む順序
- 現在の境界: Step 1のInventory coreとStep 2の読み取り専用UI・workspace統合を実装済み。2026-09-08の追加レビューで判明した除外設定の反映漏れを修正し、設定変更を含む回帰を追加した。本番状態は最新receiptと既存Vault実施記録を参照する。型Registry・複数ファイル書換え・Git公開は対象外。
- 設計開始時の境界（過去）: 最初はStep 1のcoreとfocused testだけを採用し、UIと本番反映を対象外とした。その後の明示選択でStep 2まで進んだ。

## 1. Task Contract

### Objective

アクティブノート限定のProperties編集から、Vault全体を観測できる読み取り専用Inventoryへ安全に拡張する順序と契約を固定する。型の自動推定や複数ファイル書換えは、この設計の後段に分離する。

### Deliverables

1. 第一sliceのデータ契約と既存実装の再利用境界。
2. UI・テスト・観測・型Registry・複数ファイル変更を分離した実装順。
3. 各段階の成功条件、停止線、未確定事項。

### Constraints

- Markdownが原本。app-owned DB、常駐daemon、Hook、外部packageを追加しない。
- `VaultSnapshot.notes` と既存 `parseFrontmatter`／`inspectFrontmatterProperty` を再利用する。
- 第一sliceは読み取り専用。ノート本文、型情報、Registry、設定を変更しない。
- rendererのsnapshotには除外設定の対象も含まれる。Inventoryは既存の`searchNotes`を再利用して`50_履歴`と`userIgnoreFilters`を除き、`visible-snapshot`と明示する。Vault全件相当を名乗らない。
- malformed／複雑YAMLを自動修復しない。unsupportedとして観測し、書込み対象から除外する。
- dirty worktreeの既存変更を保持する。

### Success

1. 既存のMarkdown正本・save/revision境界を変えずに、Property名・件数・観測形状・衝突を決定的に算出できる。
2. Inventoryを開く操作が既存workspaceの中で読み取り専用で完結し、行からノートを開ける。
3. focused test、typecheck、既存回帰で、解析結果の誤分類と既存編集の退行を検出できる。

### Stop

- 第一sliceで型を自動確定しない。
- Previewなしの型変換・全体リネーム・複数ファイル書換えへ進まない。
- Obsidianの型Registry永続形式が一次資料・隔離fixtureで確認できるまで、互換Registryを書かない。
- Inventoryの解析不能率やUI遅延が観測されても、いきなりcache／worker／新runtimeを足さず、測定結果を次の判断材料にする。

## 2. 現在の実装境界

- [`VaultService.scan`](../../../src/main/vault.ts) はMarkdown本文を含む `NoteDocument[]` を既に作り、`vault:snapshot` としてrendererへ渡している。
- [`NoteDocument`](../../../src/shared/types.ts) は `path`、`content`、更新時刻、サイズを持つ。第一sliceに追加IPCは不要。
- [`frontmatter.ts`](../../../src/core/frontmatter.ts) の現在の型は `text`／`number`、`checkbox`、`list`。Property名も現在の編集契約に合わせる。
- [`MarkdownEditor.tsx`](../../../src/renderer/components/MarkdownEditor.tsx) はアクティブノートの `content` だけを解析する。全体Inventoryはこの処理を純粋関数へ切り出して再利用する。
- 設計開始時の互換性台帳ではProperties view／global type managementが未実装だった。現在は読み取り専用一覧を実装済みで、全体型管理と複雑YAMLの全面互換は別契約として残る。[`compatibility-ledger.md`](../../../.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)

## 3. 第一slice: read-only Inventory契約

### 3.1 入力と範囲

```ts
buildPropertyInventory(notes: readonly NoteDocument[]): PropertyInventory
```

入力は現在の `VaultSnapshot.notes`。結果には必ず `scope: 'visible-snapshot'` と対象ノート数を含める。excluded filesを含む全Vault一覧は別の契約にする。

### 3.2 観測形状

現在のlossless編集モデルを越えて型を推定しない。Propertyごとに次を数える。

```ts
type ObservedPropertyShape =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'list'
  | 'null'
  | 'unsupported'
  | 'malformed'

type PropertyInventoryStatus =
  | 'consistent'
  | 'empty-values'
  | 'mixed-types'
  | 'unsupported'
  | 'malformed'
```

```ts
interface PropertyInventoryEntry {
  name: string
  noteCount: number
  shapeCounts: Partial<Record<ObservedPropertyShape, number>>
  status: PropertyInventoryStatus
  samplePaths: string[] // 最大5件。値本文は保持しない。
}

interface PropertyInventory {
  scope: 'visible-snapshot'
  noteCount: number
  frontmatterNoteCount: number
  entries: PropertyInventoryEntry[] // nameのlocaleCompare('ja')順
}
```

判定規則:

- `inspectFrontmatterProperty` が成功した型を `text`／`number`／`checkbox`／`list` として数える。
- null／空値は `null`。nullだけでは型衝突にしない。
- `NON_SCALAR_PROPERTY` 等、現行編集モデル外は `unsupported`。
- frontmatter warningまたは安全に解釈できない対象は `malformed`。
- 複数の実型があれば `mixed-types`。null併存は `empty-values`として別表示する。
- `malformed` > `unsupported` > `mixed-types` > `empty-values` > `consistent` の優先順でstatusを決める。
- date／datetime／tagsなど、現行モデルがtextとして読める値は自動で別型へ昇格させない。表示上は観測結果と未確定境界を分ける。
- 第一sliceではduplicate keyの完全判定を互換保証に含めない。将来の書込み前にduplicate検出契約を追加する。

### 3.3 可視化

第一sliceの表示は、既存のglobal graphと同じworkspace内の読み取り専用global viewとする。新しいwindowやDBは作らない。

- タブ名: `プロパティ一覧`
- 列: Property名、使用ノート数、観測形状、状態
- 行選択: 最大5件のサンプルパスを表示し、クリックで既存のノートタブを開く
- 検索: Property名の部分一致のみ
- 並び順: Property名／使用ノート数
- 状態: `観測済み`、`空値あり`、`型混在`、`解析不可`
- `編集`、`型変更`、`全体リネーム`、`一括変換`ボタンは置かない
- 色だけに依存せず、状態名をテキストとARIAで伝える

workspaceへの追加は `global-properties` というsingleton tab kindで行う。保存・再起動で復元できる既存workspace契約へ追加し、RegistryやInventory結果そのものは保存しない。

## 4. 実装順序

### Step 0 — この設計の固定（現在）

この文書を状態の正本とし、第一sliceの可視範囲、観測形状、書込み禁止を固定する。既存Compatibility ProgramのP0完了・Production receiptを変更しない。

完了条件: scope、status、stop条件がレビュー可能であること。

### Step 1 — 純粋なInventory core

対象候補:

- `src/core/property-inventory.ts`
- `tests/property-inventory.test.ts`

`NoteDocument[]`を受けて決定的な`PropertyInventory`を返す。ファイル書込み、IPC、React、設定を持たせない。既存frontmatter関数を呼び、解析不能を安全側へ分類する。

最小fixture:

- frontmatterなし
- text／number／checkbox／list
- null／空list
- 同一Propertyのtext＋number混在
- unsupported flow mapping／nested YAML
- malformed frontmatter
- BOM・CRLF・コメントを含む本文が入力後も変更されないこと

受入: core testが結果の順序・件数・statusを固定し、入力Markdownが変更されない。

実装済み: [`src/core/property-inventory.ts`](../../../src/core/property-inventory.ts) と [`tests/property-inventory.test.ts`](../../../tests/property-inventory.test.ts)。`visible-snapshot`、frontmatter有無、text／number／checkbox／list／null／unsupported／malformed、status優先順、最大5件の決定的samplePaths、値本文を保持しないことを固定した。空listは空値として`null`に分類し、nested YAMLは`unsupported`、frontmatter warningと既存解析境界外の構文は`malformed`とした。

検証済み: focused `npx vitest run tests/property-inventory.test.ts tests/frontmatter-properties.test.ts tests/frontmatter.test.ts --maxWorkers=1`（3 files / 85 tests）、`npm test`（110 files / 1,156 passed / 1 skipped）、`npm run typecheck`。

### Step 2 — 既存snapshotからglobal view

対象候補:

- `src/renderer/components/PropertyInventoryView.tsx`
- `src/renderer/components/WorkspaceTabBar.tsx`
- `src/shared/workspace-state.ts`
- `src/renderer/App.tsx`
- 必要最小限のstyleとUI test

`App`の既存snapshotを`useMemo`で一度だけ集計し、snapshot更新時に再計算する。新しいIPC・永続Registry・別scanは追加しない。大量Vaultでの遅延はまず計測し、測定なしのcache／worker化をしない。

実装済み:

- `src/renderer/components/PropertyInventoryView.tsx` を追加し、既存snapshotから除外設定を適用した `searchNotes` のInventoryを読み取り専用で表示する。Property名検索、Property名／使用ノート数の並び替え、状態・観測形状、最大5件のサンプルノートを提供する。
- `global-properties` をworkspaceのsingleton tab kindとして追加し、開閉・切替・lastSession／named workspaceの復元へ通した。サンプルパスは既存のノートタブ経路で開く。
- activity railとcommand paletteから開ける。本文・Registry・型情報・Inventory結果の書込み操作は追加していない。
- 新しいIPCは追加していない。Inventory入力は既存の `vault:snapshot`／preload `getSnapshot` の契約を再利用している。

受入:

- command paletteまたはactivity railから開ける。
- workspace tabの開閉・切替・再起動復元が壊れない。
- row選択から既存ノートを開ける。
- 画面上で書込み操作が発火しない。
- excluded filesを含むと誤表示しない。

検証済み: `tests/property-inventory-view.test.tsx`、`tests/workspace-state.test.ts`、`tests/app.properties.test.tsx` のfocused test、`npm run typecheck`、`npm test`（112 files / 1,160 passed / 1 skipped）、`npm run check:mcp`。

### Step 3 — 隔離fixtureと7日観測

匿名fixtureで、Property名検索、混在状態の確認、ノート遷移、再起動復元を確認する。実VaultではInventoryの利用頻度と、`mixed-types`／`unsupported`の発生を観測するが、本文・Registryは変更しない。

停止条件: 反復する全体管理需要が確認できなければ、型Registryの実装へ進まずInventoryで止める。

### Step 4 — 型管理契約の決定ゲート（未着手）

Step 3で需要が成立した場合だけ、Obsidianの型適用範囲・空値・混在list・永続形式を隔離fixtureで確認する。決める項目は次の通り。

- Property名ごとの型をTSUZUNEが保持するか
- Obsidian既存Registryを読むか、TSUZUNE-local表示設定にするか
- `unknown`／`conflict`を型として扱うか
- 型変更時に値変換を許すか、別Preview操作にするか

このゲートを通るまで、`types.json`等の未確認形式を作らない。

### Step 5 — 型Registry（将来slice）

明示的な型指定と実値観測を別に持つ。自動推定結果で型を上書きしない。Registryの保存先・revision・競合・削除規則をStep 4で確定した後にのみ設計する。

受入候補: 影響ノート一覧、無効値、変換前後Preview、キャンセル、再起動後の同一結果。

### Step 6 — 複数ファイル変更（別承認）

Property全体リネーム、型変換、値正規化はInventory／Registryから分離する。dry-run、対象数、revision確認、collision拒否、失敗時の未変更保証を先に固定し、単一ノートsaveとは別の受入を持たせる。

### Step 7 — Bases（別契約で読み取り専用表を本番受入済み）

設計開始時は反復需要の観測待ちとしたが、利用者の明示選択により[専用契約](../20260908-bases-design/plan.md)で固定versionの`.base`読み取り専用表を実装・本番受入した。旧観測待ちへ戻さない。独自DB、formula、全型round-tripは未採用であり、この計画から着手しない。

## 5. 未確定事項とResearch

- `visible-snapshot`からexcluded filesを含む範囲へ広げる必要があるか。
- date／datetime／tagsの観測表示をどこまで字句解析するか。
- duplicate key、anchor、alias、複雑なflow YAMLの検出精度。
- Obsidianの型Registry永続形式と、TSUZUNEが互換保存すべきか。
- 数千ノートでのsnapshot再集計時間。現状は新cacheを作らず、Step 2で測定する。

## 6. 完了・次・Held・Research

- 完了: 公式仕様調査、現行source境界、全体Inventoryの最小契約、Step 1の純粋Inventory coreとfocused回帰、Step 2の既存snapshot global view・workspace統合・focused回帰。
- 次: 今回の除外設定修正を必須checkと隔離installed fixtureで検証する。結果は最新receiptと既存Vault実施記録を正本とし、長期観測から型管理へ進む判断は別に行う。
- Held: 型Registry、全体リネーム、型変換、Basesの未採用拡張。
- Research: excluded scope、完全YAML、duplicate key、Registry保存形式、規模性能。

## Evidence

- [Obsidian Properties](https://obsidian.md/help/properties)
- [Obsidian CLI](https://obsidian.md/help/cli)
- [Obsidian data storage](https://obsidian.md/help/data-storage)
- [Obsidian Bases](https://obsidian.md/help/bases)
- [TSUZUNE Bases assessment](../../../docs/reports/obsidian-bases-assessment-2026-08-13.md)
- [Compatibility ledger](../../../.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)
