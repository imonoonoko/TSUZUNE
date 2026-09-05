# TSUZUNE Sync Core v2 Requirements

## 1. Overview

TSUZUNE Sync Core v2は、ローカルMarkdownと添付を正本に保ちながら、複数の本人端末がオフライン編集を含めて安全に収束できる同期機能を提供する。remote transport固有のAPI失敗と、同期上の競合・削除・版履歴を分離する。

## 2. User Stories

- 自分のPCで編集したノートを、別の自分の端末で追加操作なしに読める。
- 両端末で同じノートを編集しても、どちらの内容も失わない。
- 誤編集や誤削除の後に、過去版または削除済みファイルを復元できる。
- 同期が止まった時、止まった理由と安全な次の操作を確認できる。
- TSUZUNEがなくても、ローカルVaultを通常のMarkdownと添付として読める。

## 3. Acceptance Criteria

### Foundation Compatibility

- Given 現行Drive plannerの入力, when Sync Core v2でplanする, then action、reason、順序が現行結果と一致する。
- Drive互換interfaceを使う既存callerとtestは変更なしまたは機械的import変更だけでgreenを維持する。

### Multi-Device Convergence

- 2 profileが同じbaselineから別々のnoteを変更した場合、再接続後に両profileとremoteが同じ集合・revisionへ収束する。
- 同一noteを両側で異なる内容へ変更した場合、片方を上書きせず競合copyと状態を残す。
- 同期途中でprocessが終了しても、再起動後に未完了操作を検出し、安全に再試行または停止する。

### Identity, Move, And Delete

- fileのlogical IDはpath変更後も維持される。
- moveと本文編集が同時に起きても、delete＋new fileとして内容を失わない。
- 削除はtombstoneなしに他端末へ伝播しない。
- stale端末の復帰で、期限内tombstoneが削除済みfileを無条件に復活させない。

### Attachments

- 対応添付はbyte-identicalに同期される。
- 大きな添付の失敗で部分fileを正本pathへ残さない。
- Markdownだけ成功、添付だけ失敗した状態を完全成功として表示しない。

### Version History And Restore

- note、添付、rename、deleteについて過去版を列挙できる。
- restoreは現在版を新しい版として保持し、復元前の現在内容も履歴から失わない。
- 保持期間と容量上限は実装前に明示される。

### Automatic Operation

- local change、起動、network復帰を同期triggerにできる。
- 同一Vaultの同期runは並列にapplyされない。
- offline、認証切れ、quota、remote drift、競合を区別して表示する。
- 自動同期を停止してmanual preview／applyへ戻せる。

## 4. User-Facing Nonfunctional Requirements

### Cost

- Sync Coreの通常運用に有料同期サービス、専用server、従量課金APIを必須化しない。
- 既存のローカルVaultと利用者自身のGoogle Drive adapterだけで動作できる構成を維持する。

### Data Integrity

- stale version、path collision、ownership mismatchではfail closedとする。
- 失敗時はlocalとremoteの少なくとも一方に完全なpreimageを保持する。

### Responsiveness

- 変更なしの通常確認は全本文を再取得しない。
- editor入力をnetwork処理でblockしない。

### Usability And Accessibility

- 同期中、完了、offline、注意、競合、停止を色だけに依存せずtextとiconで示す。
- 競合・履歴・再試行操作はkeyboardで到達でき、明示labelを持つ。

### Privacy

- token、暗号鍵、note本文を診断logへ書かない。
- E2EEを採用するまでは、Google Drive上のremote本文がGoogle側で可読であることをUIで隠さない。

## 5. Interaction Flow

```text
change / startup / reconnect
  -> scan and read last checkpoint
  -> fetch remote delta
  -> deterministic plan
  -> no-op | safe apply | conflict preserve | fail closed
  -> atomic checkpoint
  -> visible status and optional history entry
```

## 6. Open Questions

- E2EEを優先し、Drive上の平文Markdown可読性を失ってよいか。
- version historyの保持期間と容量上限。
- 最初の追加端末をWindows PCとするか、mobileを最初から受入対象にするか。
