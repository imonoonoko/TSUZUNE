# TSUZUNE History Store v2 Scope

## MVP — Phase 1

- versioned immutable intent schema。
- exact before bytesのBrotli圧縮。
- before/after SHA-256とsize。
- transaction ID、target、recorded_at、reason、source_refs、previous_revision、previous_record_sha256の保持。
- canonical read-back後に作るimmutable commit receipt。
- intent/receipt/observed-afterの検証。
- previous bytesのverify-and-export用復元。
- Unicode、CRLF、LF、BOM、空本文、改ざんのfixture tests。

## Nice To Have

- 実履歴copyでのBrotli full-preimage圧縮率benchmark。
- immutable recordからinventoryを再構築するread-only projection。

## Future

- production writerへのshadow接続。
- cross-process lockを含むcrash-safe intent/receipt protocol。
- closed periodのimmutable pack化。
- maintained delta libraryの必要性評価。
- rebuildable SQLite index。
- UIからのas-of復元preview。
- legacy Markdown履歴のverified migration。

## Out Of Scope

- 既存 `50_履歴/AI更新` の移動、削除、書換え、圧縮。
- production Vaultへのv2 file作成。
- Git、GitHub、cloud serviceの利用。
- human editorのsave contract変更。
- `note_link_add`、entry move履歴形式の変更。
- background daemon、Hook、自動retention。
- custom delta codec、mutable manifest、open monthly pack append。

## Constraints

- Technology: Node標準libraryと現行依存を使用する。
- Compatibility: 現在Markdownは引き続き単独で読める正本とする。
- Safety: hashまたはintent/receiptが不正なら部分復元せずfail closed。
- Rollout: code変更をproductionへ反映する場合は固定production update gateが必須。
