# O2-P2 Classification Migration Dry-run

日付: 2026-08-10（JST）

## 結論

明示JSON planを入力するread-only CLIで、本番Vaultの分類移行候補を2回dry-runしました。2回とも同じmanifestを生成し、Vault全体のfingerprintは実行前後で不変でした。物理移動、Markdown書換え、Path Alias sidecar作成、Drive操作は行っていません。

`applyAllowed`は`false`です。このreportは本番適用の許可ではなく、現在の候補、参照、投影結果、未解決blockerを固定する証拠です。

## 入力

- Plan: [`docs/migrations/o2-p2-operations-plan.json`](../migrations/o2-p2-operations-plan.json)
- Plan SHA-256: `AF27BAD6DBE5281064D67BF9F271E0C5AC46174EE0B33E61286C693138F9FD11`
- 候補: 5 Markdown notes
- 合計: 11,027 bytes
- 監査時点の実在fileとexpected size／SHA-256が全件一致

| Source | Destination | Bytes |
|---|---|---:|
| `30_知識/TSUZUNE-Google連携・同期・障害対応.md` | `30_知識/ソフトウェア開発/TSUZUNE-Google連携・同期・障害対応.md` | 2,346 |
| `30_知識/TSUZUNE-MCPとAI書き込み運用.md` | `30_知識/ソフトウェア開発/TSUZUNE-MCPとAI書き込み運用.md` | 2,236 |
| `30_知識/TSUZUNE-データ保護・バックアップ・復旧.md` | `30_知識/ソフトウェア開発/TSUZUNE-データ保護・バックアップ・復旧.md` | 2,115 |
| `30_知識/TSUZUNE-開発開始と区切りの標準ループ.md` | `30_知識/ソフトウェア開発/TSUZUNE-開発開始と区切りの標準ループ.md` | 2,078 |
| `30_知識/TSUZUNE-本番更新・インストール・Release運用.md` | `30_知識/ソフトウェア開発/TSUZUNE-本番更新・インストール・Release運用.md` | 2,252 |

## 参照と投影

| 検査 | 結果 |
|---|---:|
| Wiki参照 | 39 |
| active notesからの参照 | 24 |
| `40_情報源`からの参照 | 4 |
| `50_履歴`からの参照 | 11 |
| 参照元file | 28 |
| MCP backlink | 39 |
| Wiki projection | equivalent |
| Graph projection | equivalent |
| Context projection | equivalent |

過去のPhase2監査にある38参照は、その時点の履歴として改変しません。今回のlive dry-runで確認した39参照が現在の移行入力であり、このreportが旧値をsupersedeします。

## Vault不変条件

| 項目 | 結果 |
|---|---|
| Vault files | 301 |
| Vault bytes | 9,727,936 |
| Full fingerprint | `C97351EF6D99F628AA099374961217008153E6E136351C418C92D76BB3FBF875` |
| Manifest SHA-256 run 1 | `789384A9845CB9CBCAC49AF97F5EDEC6E4FE89A5F9891C1FEB309AF563540992` |
| Manifest SHA-256 run 2 | `789384A9845CB9CBCAC49AF97F5EDEC6E4FE89A5F9891C1FEB309AF563540992` |
| Path Alias sidecar | absent |
| Vault writes | 0 |
| Physical moves | 0 |
| Markdown writes | 0 |
| Drive operations | 0 |

Fingerprintはhidden sidecarと添付を含むVault内の全regular filesから算出しました。manifestにはVault相対path、hash、bytes、件数だけを保存し、ノート本文、絶対path、アカウント情報、認証情報は含めていません。

## Apply blockers

- `DRIVE_PATH_ALIAS_UNSUPPORTED`: Drive同期が`.tsuzune/path-aliases.json`を扱わない。
- `REFERENCE_REWRITE_NOT_APPLIED`: 本文参照を移行するapply契約をまだ実行・検証していない。
- `ROLLBACK_PREIMAGES_NOT_CAPTURED`: rollbackに必要な全preimageを保存していない。

この3件が残るため、dry-run成功時も`applyAllowed=false`です。

## 次の分類Gate

分類Trackを再選択した場合だけ、次のどちらか一つを行います。

1. 匿名一時VaultでO2-P3 apply／rollback prototypeを往復し、失敗時に元のbytes、path、参照、Graph、Contextへ戻せることを確認する。
2. DriveがPath Alias sidecarをどう同期するか、またはremote renameへ置き換えるかを先に決める。

本番Vaultへのapplyは禁止したままです。製品のCurrent Transition Queueは変更せず、Graph parityをGP0-3b-mから再開します。
