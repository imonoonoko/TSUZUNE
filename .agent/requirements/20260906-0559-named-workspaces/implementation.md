# ワークスペース保存・復元 — 実装契約と分担

2026-09-06、設計完了後の利用者の「開始」で、[要件](requirements.md)・[設計](design.md)・[受入条件](acceptance.md)の製品実装を開始する。設計時の「文書まで」は今回の範囲へ更新する。進行状態の所有先は引き続き [PLAN.md の Current Decision](../../../PLAN.md#current-decision)。この文書は作業契約と排他的な分担を保持する。

目的は名前付き配置とVaultごとの前回配置を安全に保存・復元できること。成功条件は (1) A1〜A11に対応する実行可能な検証、(2) 必須gateと独立した保存・世代境界review、(3) production updateと隔離installed受入。本人の使いやすさ・実機IME受入は観測した範囲だけ報告する。

CEO-01が統合・App・本番反映・TSUZUNE最終同期を所有。ai-coding-operator、Ponytail、codex-dynamic-workflowsを適用し、保存／復元の振る舞いはtddで一件ずつRED→GREENを通す。Orchestratedは保存基盤と独立UI部品の並列利益、および保存安全性の別検証のため。既存dirty変更を保持し、Git公開、新依存、Vault本文の自動変更、MCP機能追加は対象外。

## 分担と共有interface

- W-A backend: gpt-5.6-sol / high。複数moduleの保存保護を一貫して実装する。所有: `src/shared/workspace-state.ts`、`src/shared/types.ts`、`src/main/settings.ts`、`src/main/workspaces.ts`、`src/main/ipc.ts`、`src/main/vault.ts`のroot getter、`src/preload/index.ts`、対応するsettings/workspace/IPC tests。画面、他のVault機能、本番操作は禁止。契約変更は親へ戻す。
- W-B components: gpt-5.6-terra / medium。既存dialogパターンで限定部品を完成する。所有: `WorkspaceDialog.tsx`と専用CSS/test、`RelatedNotes.tsx`とそのtest、`MarkdownEditor.tsx`とそのtest、`CommandPaletteDialog.tsx`とそのtest。Appと共通typesは親／backend所有。compositionは確定doc伝播までguardし、timingに不足があれば親へ上申する。
- W-B/C integration: CEO-01。`App.tsx`、renderer復元helper、App tests、統合CSS、隔離受入script、最終docs。backendとcomponentsの変更を受入後に連結する。
- 独立review: source_state（gpt-5.6-terra / medium、読取専用）。保存非破壊・世代・未保存入力を別観点で確認。blocking findingは親が修正証拠とともに解除する。

全担当は共同作業中であり、他者の編集をrevertしない。本番TSUZUNE writeと最終採否は親専有。基準は2026-09-06開始時のdirty tree、HEAD `4bcadc4ce6fee424a88aed5fbeaec9de9b9a6884`。既存製品差分は最新production receiptのsource archiveと突き合わせてから本番更新する。

共有typesは`shared/workspace-state.ts`から `WorkspaceSnapshotV1`、`VaultWorkspacesV1`、`WorkspaceScope = {rootPath:string; rootRevision:number}`、`WorkspaceCollection = {scope:WorkspaceScope; state:VaultWorkspacesV1}` をexport。

```ts
getWorkspaces(expectedVaultPath: string): Promise<Result<WorkspaceCollection>>
saveWorkspace(scope: WorkspaceScope, name: string, snapshot: WorkspaceSnapshotV1, replaceExisting: boolean): Promise<Result<WorkspaceCollection>>
deleteWorkspace(scope: WorkspaceScope, name: string): Promise<Result<WorkspaceCollection>>
saveLastWorkspaceSession(scope: WorkspaceScope, snapshot: WorkspaceSnapshotV1): Promise<Result<null>>
```

WorkspaceDialog props: `named: VaultWorkspacesV1['named']`, `mode:'save'|'open'`, `busy:boolean`, `error:string|null`, `onSave(name,replaceExisting):void`, `onLoad(snapshot,name):void`, `onDelete(name):void`, `onClose():void`。削除確認とfocus trapはdialog内。RelatedNotesは`activeTab`／`onActiveTabChange`をcontrolled propsとして追加（既存単体利用はoptional fallback）。MarkdownEditorは`onCompositionChange?: (composing:boolean)=>void`を追加する。

## 統合と検証

W-Aとcomponentsは独立。親はAppの公開操作testから復元経路を実装し、両packetを統合。focused tests合格後に保存・世代・IMEを独立reviewし、未提示境界を一つ以上確認する。全体gateは `npm run typecheck`、`npm test`、`npm run check:mcp`。docsを確定してproduction updateがsource snapshotを取った後はfingerprinted repo資料を変更しない。

本番更新は既存AGENTSの採用済み手順内で実行する。稼働中の利用者アプリを強制終了しない。exactなproduction相当境界を証明できない場合や新権限が必要な場合は、その依存操作だけ停止する。実Vaultを自動smokeへ開かず、packaged／installedの隔離profileとfixtureを使う。結果・残る受入境界・分担の実績は最終reportと既存のVault campaignへ一度統合する。
