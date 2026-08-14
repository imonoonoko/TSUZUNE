# CP0-T06 AI Write Immutable Policy

## 結論

CP0-T06は`pass`。AI Write Policy全体を一度に作らず、最初の公開契約を「AIから変更不可」に限定した。

- `40_情報源`と`50_履歴`は常に保護する。
- Settingsの「AIから変更させないパス」へ、追加のノート／フォルダpathを1行ずつ保存できる。
- 保護pathではMCPの`create_note`、`update_note`、`autonomous_update_note`をすべて拒否する。
- `fetch.metadata.editable`は保護ノートで`false`を返す。
- 拒否時は本文、作成先、`50_履歴/AI更新`のいずれも変更しない。

## 実装判断

既存のSettings保存経路、path filter、MCP Vault source、revision付き更新、履歴保存を再利用した。新しいDB、queue、agent framework、approval workflowは追加していない。

`review`は承認後の適用経路がまだ存在せず、表示だけを追加すると安全性を偽るため今回は実装しなかった。`auto`のfolder別切替、個別ノート用UI、policy継承表示、rollback UIも別sliceとする。

## 公開テスト

- 固定保護ノートの`editable: false`とautonomous update拒否、履歴0件。
- ユーザー追加pathに対するcreate／update／autonomous updateの全拒否、本文不変、新規ファイル0件、履歴0件。
- Settings UIの表示、正規化した保存呼び出し。
- settings.jsonへの正規化保存と再読込。

## 検証

- Targeted: 88/88 pass。
- Full suite: 58 files、525/525 pass（`--maxWorkers=1`）。最初の2-worker runは525 test assertions自体を完了した後、workerがheap limitで異常終了したため合格に使わず、1-workerで再検証した。
- Typecheck: pass。
- MCP smoke: 4 read tools + 3 write tools pass。
- `git diff --check`: pass（既存CRLF警告のみ）。

## 残課題

- custom pathは既存Excluded filesと同じcase-insensitive prefix／`/.../`正規表現契約を再利用する。専用の継承可視化はない。
- UIはfolder／note pickerではなく、既存Settings内の1行1path textareaである。
- `review`を実装するには、先に承認候補の保存場所、適用操作、競合時のrevision契約を一つの公開フローとして固定する必要がある。
- hostは正確なmodel-visible token／費用を公開していないため、CP0 usageは`not_observable`とする。
