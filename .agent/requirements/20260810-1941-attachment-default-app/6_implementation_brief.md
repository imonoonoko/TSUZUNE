# GP0-3b-n Attachment Default App Implementation Brief

## Authorization State

初回設計turnでは本書を固定して停止した。その後の明示指示で固定参照capture、製品実装、TSUZUNE capture、比較、検証が承認され、実行済みである。本書は採用した最小経路の実行記録として保持する。feature commit `49ac0f3`をpushし、同じclean sourceから本番更新して`installed-and-verified`を確認した。

## Execution Order

1. 固定Obsidian 1.13.4の`success-intercepted`をcaptureし、menuと`window.open` requestを確定する。
2. referenceが本要件と一致する場合だけ、renderer testをREDにする。
3. `WikiGraphView.tsx`へmenu item 1件を追加し、既存`onOpen(path)`を呼ぶ。
4. App／IPC／Vaultの既存回帰を確認し、欠けた失敗境界だけを最小追加する。
5. TSUZUNE captureで既存IPCとVault validationを通し、`shell.openPath`だけをinterceptする。
6. comparison JSON／HTMLを生成し、PLAN／PROJECT_STATUS／parity資料を完了状態へ更新する。
7. focused tests、全回帰、typecheck、MCP、diff check、Ponytail reviewを通す。
8. 機能単位でcommit／pushし、必要な区切りでのみ本番更新する。

## Expected Product Touchpoints

- `src/renderer/components/WikiGraphView.tsx`
- `tests/wiki-graph-view.test.tsx`
- 必要な場合だけ`tests/app.safety.test.tsx`

以下は固定参照が既存契約を否定しない限り変更しない:

- `src/renderer/App.tsx`
- `src/main/ipc.ts`
- `src/main/vault.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`

## Expected Test Touchpoints

- `tests/wiki-graph-view.test.tsx`: exact label／順序、relative path 1回、menu close、対象外node非表示。
- `tests/app.safety.test.tsx`: Graph context menuから既存`openVaultFile`へ到達し、成功／failure messageとGraph tab維持を確認する狭い公開経路。
- `tests/vault.integration.test.ts`: 既存のsupported file／unsupported／directory検証を再利用する。新しいpath validatorは作らない。

IPC／Vault backendは今回変更していないため、新しいIPC mock群は追加しない。TSUZUNE captureでは既存trusted IPCとVault validationを実経路で通し、OS境界の`electron.shell.openPath`だけを差し替える。

## Evidence Touchpoints

- 既存Obsidian probeへGP0-nの狭いbranch
- 既存TSUZUNE capture harnessへGP0-nの狭いbranch
- report builder 1本
- package scripts、comparison JSON、HTML、必要最小の画像

## Implementation Rule

新しい`onOpenInDefaultApp` prop、IPC channel、external-open helper、service、dependencyを追加しない。既存`onOpen`のattachment branchで足りなくなったことを固定referenceまたはRED testが示した場合だけ設計へ戻る。

## Verification

```powershell
npm run typecheck
npm test
npm run check:mcp
git diff --check
```

captureはhook設置を確認してからactionし、実外部アプリ起動へfallbackしない。
