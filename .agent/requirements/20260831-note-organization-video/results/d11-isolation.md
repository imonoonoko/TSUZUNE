# D11 Task-owned Isolation

## Decision

Inbox capture runtimeはGit基準へ独立可能。ただし4ハンク分離は機能検証用であり、production delivery用のbaselineにはできない。

## Existing HEAD dependencies

- `ensureDirectory`
- `availableNoteName`
- `createAndOpenNote`
- `createNoteInDirectory`
- Command Palette command type, list, and dispatch
- existing create-note IPC

新dependency、core/shared変更、新APIは不要。

## Runtime closure

- `src/renderer/App.tsx`
  1. `inbox-note` command definition
  2. `createNoteInDirectory('01_受信箱')` dispatch
- `tests/app.safety.test.tsx`
  1. stable command list label
  2. collision-safe Inbox create/readback/editor public behavior test

README、MCP docs、PLAN、PROJECT_STATUSはruntime依存ではなく、別に移植できる。

## Production warning

直近installed productionはGit HEADではなく当時のdirty source全体から作られ、そのexact source snapshotは残っていない。HEAD＋4ハンクをinstallすると、既に本番へ入った未commit機能を巻き戻す可能性がある。productionへ進む場合はcurrent source全体への明示承認、または別scopeの広範な再構成・監査が必要。

## Clean-boundary gates

```powershell
npm ci
npm run typecheck
npx vitest run tests/app.safety.test.tsx --maxWorkers=1
npm test
npm run check:mcp
npm run check:current-decision
git diff --check
```

## Stop

4ハンクの適用に別作業差分が必要になる、またはGit基準の既存helperで解決しない場合は隔離を停止する。branch、worktree、commit、install、Vault操作は未実施。
