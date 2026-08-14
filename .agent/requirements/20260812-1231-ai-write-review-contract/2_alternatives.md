# AI Write Review Mode Alternatives

## Codebase Findings

- `scripts/register-codex-mcp.ps1`の`prompt`はhost設定であり、server-side承認証明ではない。
- `src/mcp/service.ts`にはcanonical path、revision guard、immutable判定、AI履歴が既にある。
- `src/main/drive-sync-service.ts`にはpreview／applyとfingerprint再確認があるが、Electron main process内のDrive専用状態である。
- `src/main/settings.ts`と`src/renderer/App.tsx`にはVault全体設定を保存・編集する既存経路がある。
- MCP processは`--settings-path`でapp userDataの設定ファイルを参照できる。

## Options

### Option A: Host promptだけをReviewと呼ぶ

Effort: Small
Value: Low

既存Codex登録をそのまま使う。別clientやserver direct callでは保証できず、製品表示と実保証が食い違うため不採用。

### Option B: Vault内Markdown proposal

Effort: Medium
Value: Medium

proposalをVault内へ保存しappで開く。通常の検索・Graph・watcher・履歴へ内部状態が混入し、Raw／知識ノート境界も曖昧になるため不採用。

### Option C: userData JSON inboxとapp承認

Effort: Medium
Value: High

MCPが設定ファイル隣のローカルJSONへproposalを保存し、appがSettings内で表示・承認・取消する。DBや常駐serviceなしでprocessをまたげる。

```text
MCP write request
  -> immutable? reject
  -> review path? proposal JSONへ保存、Vaultは不変
  -> other path? existing write

TSUZUNE Settings
  -> proposalを表示
  -> 承認: revision/policy再確認 -> existing write/history
  -> 取消: proposalだけ削除
```

### Option D: SQLite／background approval service

Effort: Large
Value: Low for current scope

複数client・大量queueには向くが、一人用MVPには過剰なため不採用。

## Recommendation

Option C。既存の安全部品を再利用し、cross-process共有に必要な永続化だけを一つのJSON storeとして追加する。
