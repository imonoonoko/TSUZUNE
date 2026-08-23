# AI更新履歴の止血・削減プレビュー — 2026-08-16

## 結論

同一本文のAI自動更新を、`expected_revision`の有無にかかわらず履歴を作らないno-opへ変更した。既存履歴には削除・移動・圧縮・書換えを行っていない。

本番Vaultのread-only削減プレビューでは、`10_プロジェクト/TSUZUNE.md`の履歴連鎖だけが2 MiB上限を超え、先頭・末尾の全文と全件メタデータmanifestを残す仮定で約6.23 MiBの削減余地が出た。ただし現行`previous_revision`は旧ノートのmtimeを含み、履歴側にそのmtimeが保存されていないため、設計上必須の連鎖再計算ができない。したがって`applyEligible: false`であり、削減は未適用。

## 本番read-only結果

計測時刻: 2026-08-16 20:22:09 JST
対象: active production Vaultの`50_履歴/AI更新`
完全manifest: `work/history-compaction-preview-2026-08-16.json`（Vault外、1,117,173 bytes）

| 指標 | 結果 |
|---|---:|
| 全履歴 | 851 files / 12,721,601 bytes (12.13 MiB) |
| `ai_revision` | 841 files / 12,715,711 bytes |
| 対象外 | `note_move` 10 files / 5,890 bytes |
| 対象ノート数 | 147 |
| 30日超ローテーション候補 | 0 files / 0 bytes |
| 連鎖集約の推定削減 | 6,530,317 bytes (6.23 MiB、全体の51.33%) |
| Vault前後digest | 一致 |
| 実適用 | 不可・未実施 |

## 第一候補

| 指標 | `10_プロジェクト/TSUZUNE.md` |
|---|---:|
| 履歴 | 164 files / 6,680,140 bytes (6.37 MiB) |
| 仮保持 | 先頭全文 + 末尾全文 + 164件のmetadata manifest |
| manifest | 135,045 bytes |
| 仮集約後 | 149,823 bytes (146.31 KiB) |
| 推定削減 | 6,530,317 bytes (97.76%) |
| frontmatter/body marker/revision形式/file名suffix検査 | 0 errors |
| 重複revision | 0 |
| 連鎖再計算 | `unverifiable` |

## 非破壊性

- 実行前後のAI更新履歴digest: `eb967b22d207853d822f66f7101bad9ebe4a59bba4e0f88f896f1918f039cbd2`
- 実行前後とも851 files / 12,721,601 bytes。
- CLIは出力先がVault配下なら拒否する。
- `note_move`、`source-summary`、その他の非`ai_revision`は削減候補に含めない。
- 本文SHA-256と履歴ファイル全体SHA-256を各manifest行に残した。本文SHA-256を`previous_revision`と誤比較しない。

## 適用前に残るゲート

1. 現行revisionはVault root、note path、mtime、size、contentから計算されるが、履歴は旧mtimeを保持していない。既存164件の厳密なrevision連鎖は履歴だけから再計算できない。
2. 将来分は履歴へ検証可能な独立content hashまたはrevision再計算に必要なmetadataを保存する必要がある。
3. 既存分を集約する場合は、厳密な連鎖ゲートを維持するか、record/body hashと監査縮退を受け入れる契約へ変更するかを明示決定する必要がある。
4. 実データfixtureで復元と`build_context(as_of:)`の縮退表示を確認し、apply packetを再提示してから別途承認を得る。

## 再実行

```powershell
node scripts/run-preview-history-compaction.mjs `
  --vault "<active production Vault>" `
  --output "work/history-compaction-preview.json"
```

このCLIはプレビュー専用であり、圧縮・移動・削除のapply経路を持たない。

## 2026-08-17 最終再確認

直近4項目の終了境界で同じread-only CLIを1回再実行した。Vaultへの書込み・移動・削除・圧縮は引き続き0である。

| 指標 | 結果 |
|---|---:|
| 全履歴inventory | 874 files / 13,321,372 bytes |
| `ai_revision` | 864 files / 13,315,482 bytes |
| 対象外 | `note_move` 10 files / 5,890 bytes |
| 対象ノート数 | 153 |
| `10_プロジェクト/TSUZUNE.md` | 167 files / 6,713,526 bytes |
| 30日超ローテーション候補 | 0 files / 0 bytes |
| 推定削減 | 6,547,741 bytes |
| 厳密な構造検査 | body marker、target、日時、revision形式、filename suffixは全件0 errors |
| 重複revision | 1件（`30_知識/TSUZUNE-A2-1-検索演算子-要件-2026-08-15.md`） |
| 連鎖検証 | 153/153 targetsが`legacy-unverifiable` |
| apply | `false`、未実施 |

実行前後は874 files / 13,321,372 bytes、digest `94d96b0c106928d2dc9b83132b25b6808445bc57faf58b4d4542173995e36360`で一致した。前回の164件から167件への増加は、その後に行われた通常の履歴付き更新による。旧形式の履歴はrevision再計算に必要なmtime・size・Vault root hashを保持しないため、件数が増えても圧縮承認条件は満たさない。

sourceは将来の新規履歴へ`previous_modified_at`、`previous_size_bytes`、`revision_root_sha256`を保存する。既存864件を後付けで検証可能とは扱わず、新形式の実記録が蓄積して連鎖fixtureを検証できるまでapply経路は追加しない。
