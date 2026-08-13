# AI Write Review Mode Implementation Brief

## Existing Patterns

- `src/shared/ai-write-policy.ts`: canonical pathのimmutable判定。Review判定も同じ正規化規則を再利用する。
- `src/main/settings.ts`: app userDataの`settings.json`とatomicでない小規模JSON設定。
- `src/mcp/vault-source.ts`: MCPへ渡されたsettings pathからVaultとAI policyを解決する。
- `src/mcp/service.ts`: 全MCP書込みのvalidation、revision guard、immutable、AI history。
- `src/main/ipc.ts`／`src/preload/index.ts`: trusted renderer API。
- `src/renderer/App.tsx`: Settings modal、busy、focus restore、message表示。
- `src/main/drive-sync-service.ts`: preview／apply時にfingerprintを再確認する考え方のみ参照する。Drive型やserviceは流用しない。

## Likely Touch Points

- `src/shared/types.ts`: Review paths、proposal／result型、renderer API。
- `src/shared/ai-write-policy.ts`: `immutable > review > auto`解決。
- `src/main/settings.ts`: Review pathsの保存。
- 新規の小さなshared proposal store module 1 file: settings隣接JSONのread、atomic replace、create、cancel、take/apply前取得。
- `src/mcp/vault-source.ts`／`src/mcp/service.ts`／`src/mcp/server.ts`: Review対象のproposal化とtool response。
- `src/main/ipc.ts`／`src/preload/index.ts`／`src/renderer/App.tsx`: list、approve、cancel、Settings UI。
- 既存test filesを中心に、policy、MCP write、IPC、rendererの最小回帰を追加する。

## Technical Assumptions

- proposal store pathはsettings pathのdirnameへ固定名で置く。
- writeは同directoryのtemporary fileへ書いてrenameする。parse失敗は空扱いにせずerror。
- proposal IDは`crypto.randomUUID()`、content hashは`createHash('sha256')`を使い新規dependencyを入れない。
- approveはproposalを取得後、既存MCP write coreと同じvalidationを一度だけ通す。重複実装になる場合はwrite coreだけを小さく共有化する。
- apply成功後にproposalを削除する。apply失敗時は原因を表示できる状態で保持または明示的にinvalid化する。

## Risks

- appとMCPが同時に同一JSONへ書く競合。MVPは一人用かつ同一path 1件だが、atomic replaceだけではlost updateを完全防止しない。実装前RED testで同時性境界を固定し、必要なら短時間lock fileを最小追加する。
- 既存3 write toolのresponse schema変更によるclient互換性。
- update履歴作成後に本文保存が失敗する既存非transactional境界。Review実装で別のrollback機構へ拡張しない。
- 巨大本文のdiff描画。既存100,000文字上限内で、初期UIは全文二面表示とする。

## Test Plan

- Policy precedence: immutable、review、auto。
- MCP 3 write tools: review対象ではVault／history不変、proposal 1件。
- Duplicate proposal、invalid path、oversize、stale revision。
- approve success、cancel、update conflict、create conflict、immutable-after-proposal。
- app／MCP service再生成後もproposal保持。
- Settings UIのempty、pending、approve、cancel、error、keyboard labels。
- Targeted tests後にtypecheck、全test、MCP smoke、build、production gate。

## Rollout Notes

- 初期値はReview paths空。既存利用者の動作を変えない。
- 実装完了後にのみMCP再登録とproduction updateを行う。
- production receiptはbinaryとprofile不変を再確認する。

## Open Questions

- なし。実装中にresponse schemaの後方互換が成立しない場合だけ停止条件として再判断する。
