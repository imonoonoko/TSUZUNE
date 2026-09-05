# 知識の時間 Context Workspace 実装計画

## Task Contract

- objective: 承認済みB案の「知識の時間」専用ワークスペースを実装し、選択ノート・目的・時点から、既存Context Compiler / Temporal Memoryの根拠、選定理由、時間状態、警告、省略情報を読取専用で確認できるようにする。
- deliverables:
  - Activity Railから開ける専用ワークスペース
  - seed note、purpose、as-of、perspectiveを指定できる操作面
  - 既存Context / Temporal処理へ接続する型付きIPCとpreload境界
  - 根拠一覧、時間軸、警告、省略情報、原典を開く導線
  - 公開挙動・アクセシビリティ・状態遷移のテスト
  - 本番更新、インストール済み成果物の受入、TSUZUNE正本への最終記録
- constraints:
  - 既存のdirty worktreeと利用者の変更を保全する。
  - Markdownを正本とし、ノートを書き換えない読取専用機能にする。
  - 新規DB、vector DB、常駐Hook、全Vault取り込み、組込みAI/chat、新規依存を追加しない。
  - 既存Night Workshop配色、Activity Rail、Vault tree、右コンテキスト領域を維持する。
  - 画像アセットではなくsemantic UI、CSS、既存Iconで構成する。
  - Context Compilerの現行上限・選定理由・時間境界を迂回しない。
- success:
  1. 選択ノートから「知識の時間」を開き、目的・時点・perspectiveを指定して構築すると、原典path、選定理由、時間状態、抜粋、警告、省略情報が表示され、原典を開ける。
  2. ノート未選択、loading、empty、error、長い内容、keyboard focus、狭幅で操作可能であり、ノートへの書込みを行わない。
  3. focused tests、typecheck、full tests、check:mcp、packaged/installed production acceptance、live runtime確認が通る。
- lane: Orchestrated
- evidence: source tests、UI capture、production receipt、installed hashes/profile保全、live runtime、TSUZUNE read-back。
- stop: success条件を満たすか、新しい権限・危険なruntime・DB・書込み責務が必要になった時点で停止する。稼働中TSUZUNEを強制終了しない。

## Product boundary

このwork itemのPrimaryは、Graphの置換やAI回答生成ではなく、利用者が「このノートを、この目的と時点で見ると、何が根拠になるか」を自分で検証できる観測面である。

### 採用するB案

- 左: 既存Activity RailとVault treeを維持する。
- 中央: 通常のnote editorから専用「知識の時間」workspaceへ切り替える。
- workspace header: seed note、purpose、current/specified as-of、perspective、構築action。
- timeline: 現在、指定時点、後から判明した情報を区別する。
- evidence list: note title/path、選定理由、temporal state、excerpt、warning、omitted indicatorを示す。
- 右: 既存outline/link/backlink等のcontext areaを維持する。
- source open: 既存の安全なnote-open経路を再利用する。

## State machine

`discovered -> contracted -> executing -> verifying -> persisted -> complete`

現在: `complete`（source、full tests、production 10/10、installed smoke、fresh MCP、TSUZUNE原子記録、4入口のrevision-checked更新、read-back／backlink確認まで完了）

## Work breakdown

1. 現行Context/Temporal、IPC、renderer shell、test seamを特定する。
2. 公開挙動の失敗テストを追加する。
3. 最小の型付きread-only data pathとworkspace UIを実装する。
4. 状態・keyboard・responsive・source-openを仕上げる。
5. focused/full gatesとUI reviewを行う。
6. production:updateとinstalled/live acceptanceを行う。
7. evidence packetをTSUZUNEへ一度だけ書き戻す。

## Explicit exclusions

- Obsidian plugin APIの100%互換
- 任意pluginの実行環境
- AIによる要約・判断・自動リンク・自動更新
- note mutation、rename、move、delete
- background indexingまたはdaemon
- Context Compilerの候補上限をUI都合で拡大すること
