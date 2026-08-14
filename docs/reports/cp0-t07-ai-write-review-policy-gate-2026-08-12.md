# CP0-T07 AI Write Review Policy gate

日付: 2026-08-12（JST）
結果: `blocked`
製品コード変更: 0
本番Vaultの測定対象本文書込: 0
production update: 未実行

## 対象

CP0-T06で実装した`immutable`保護の次候補として、AI Write Policyの`review`を監査した。対象は、AIが変更案を提示し、人間が確認した内容だけを、最新revisionとimmutable保護を再確認して適用する一つの公開vertical sliceである。

## 実行経路の確認

- `scripts/register-codex-mcp.ps1`はCodex登録時に`create_note`／`update_note`を`prompt`、`autonomous_update_note`を`auto`にする。これはCodex host側の承認設定であり、TSUZUNE MCP serverが承認済みであることを証明する契約ではない。
- `src/mcp/service.ts`の`updateNote`は、正しいrevisionとimmutable判定を満たせばその場で本文を更新する。proposal ID、承認記録、承認後のapply経路は持たない。
- Electron SettingsはExcluded filesとAI immutable pathを保存するが、AI変更案を受信・比較・承認・取消する画面やIPCはない。
- Drive同期にはpreview／applyとfingerprint再確認があるが、pending planはElectron main process内のDrive専用メモリ状態である。別processのMCP serverから利用できず、一般のAI note updateへ流用するとprocess境界と再起動時の意味が曖昧になる。
- 既存historyとrevision guardは、承認後の安全なapplyに再利用できる。ただし「何が承認されたか」を運ぶproposal contractがない。

## 停止理由

安全な`review`には、次の製品判断が必要になる。

1. proposalを一時メモリ、Vault内artifact、または別の永続領域のどこへ置くか。
2. Codex hostだけの確認を`review`と呼ぶか、TSUZUNE appで全MCP client共通の承認を保証するか。
3. 再起動後のproposal保持、取消、期限切れをどう扱うか。
4. 承認時に元revisionが変わっていた場合、失効させるか再baseを許すか。

これらは既存契約から一意に導けず、cardの停止条件「pending proposalの保存場所、保持期間、承認者、取消、承認UIの意味に利用者の新しい選択が必要」に該当する。`review`という表示だけを追加したり、Codexの`prompt`をserver-side保証のように扱ったりすると誤った安全性を示すため、製品変更を行わなかった。

## 推奨する再開契約

再開する場合は、Codex専用のhost設定ではなく、TSUZUNE appを承認者にするserver-enforced方式を推奨する。

- MCPは本文を直接更新せず、元path・元revision・提案本文を含むproposalを作る。
- appはdiffを表示し、承認または取消を一回だけ行う。
- apply直前に元revisionとimmutable policyを再確認し、不一致なら失効させる。
- 成功したapplyだけを既存historyへ記録する。

ただしこれは新しいcross-process契約であり、proposalの保存と再起動時の扱いを先にrequirementsとして固定してから実装する。

## Verification

```text
npm run check:mcp
MCP smoke passed (4 read tools + 3 write tools).

git diff --check
PASS（既存CRLF warningのみ）
```

Ponytail review: `Lean already. Ship.` 製品差分がなく、削除対象の新規抽象化もない。

## 次

CP0の連続標本では本taskを除外せず`blocked`として保持し、次に自然発生するeligibleな依頼をCP0-T08としてadmitする。Review modeは上記contractへの利用者判断が得られるまで再実装しない。
