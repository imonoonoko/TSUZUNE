# P0-6 名前変更・移動・衝突の実機比較

観測日: 2026-09-05 JST。比較は完了。製品修正は未着手。検査は47 PASS／1 FAILで、本番プロファイル全体の不変条件は満たしていない。

## 結論

同じ匿名fixtureを本番インストール済みTSUZUNE 0.6.0と固定Obsidian 1.13.4で操作した。名前変更とフォルダ間移動、同名への名前変更拒否、移動先衝突時の `Source 1.md` への連番退避は一致し、既存ノートを上書きしなかった。各アプリを別processで再起動して保存結果の全データbyteが維持された。

差はリンクの追従と保存形式にある。TSUZUNEは参照切れを警告するが、続行後の参照元本文を更新しない。ObsidianはWikiリンク、表示名・見出し付きリンク、Markdownリンク、frontmatter内の参照を追従させた。一方、Obsidianの一連の操作ではBOM／CRLFが除去・LF化され、参照元YAMLの非対象コメントも失われた。TSUZUNEの非破壊保存を維持し、これらの書換えは模倣しない。

**次の修正候補は一件:** 普通のMarkdownノートを名前変更・移動した際の、解決先が確定している参照元リンクの非破壊追従。Wiki／Markdownの対象path部分だけを変更し、alias・heading・周辺YAML・コメント・BOM・改行を保持する。曖昧参照、保護原典、履歴、外部編集競合は自動書換え対象にしない。複数ファイルの保存失敗時に既存データを失わない境界を先に定める。この比較の承認は製品実装の承認を含まない。

## 条件と証拠

- 9 Markdownと1 SVGの同一byte入力。名前変更、二階層への移動、rename collision、move collisionの4操作を両アプリのdialogから実行した。TSUZUNEの影響警告はfixtureに限って承認した。
- TSUZUNEは実際のinstalled EXE／app.asar。Obsidianは公式固定1.13.4、asar SHA256 `51218495ad940a8515b202d380bde638be6570a198e121f7ca6d484a8a158917`。最新版との互換性は主張しない。
- Obsidianのfixture設定は `alwaysUpdateLinks:true`。false時、prompt分岐、同名候補の曖昧解決、folder単位移動、Drive同期、障害注入、外部編集競合は未比較。
- 各アプリのVault／userData／CDP portを分離し、UIが開いたrootを照合した。本番VaultをUIで開かず、操作時のdataファイル・ARIA・screenshot・native dialogを保存した。Codex内ブラウザはnative Electron操作を提供しないため、既存Playwright dependencyとCDPを使用した。
- 匿名の証拠一式: `output/playwright/p0-6-file-operations-20260905/`。`initial-files.json`、各 `*-final-data.json`、`*-reopened*.json/png`、`verification.json`、`profile-diff.json` を参照。実行補助と完了状態は `work/p0-6-file-operations/`。
- 公式公開説明: [Internal links](https://obsidian.md/help/links)、[Settings](https://obsidian.md/help/settings)（2026-09-05確認）。公開仕様と今回の固定runtime観測は区別する。

## 観測表

| 対象 | TSUZUNE | Obsidian 1.13.4 | 判定 |
|---|---|---|---|
| 通常のrename／moveと再起動 | 指定pathへ移動、再起動後維持 | 同左 | matched、今回のfixture内 |
| 同名rename | エラー、元と既存fileを保持 | エラー、元と既存fileを保持 | matched |
| 同名move | 既存fileを保持し `Source 1.md` に移動 | 同左 | matched |
| rename／move対象の本文byte | BOM／CRLF／metadata／コメントを完全保持 | 直後は同一、後続操作までにBOM除去・LF化。本文と値は保持 | different、一連のUI操作の結果 |
| rename参照元 | 本文未更新、Wiki参照切れ警告 | 4参照を新ノートへ解決。alias・headingを保持 | different |
| move参照元 | 本文未更新、Wiki参照切れ警告 | Wiki／Markdownの2参照を新pathへ更新 | different |
| 参照元YAMLの非対象comment | 保持 | `keep: unchanged # retain` のcommentを除去 | different、TSUZUNEの保存性を維持 |
| 移動ノート内のMarkdown相対link | 本文は同一だがpreviewでは非active text | 本文pathは同一、元のNeighbourへ解決してclick可能 | different |
| Markdown相対画像 | 再起動後も未表示 | 元のSVGへ解決して表示 | different |
| Vault内path明記のWiki画像 | 再起動後も表示 | 同左 | matched、今回のSVGのみ |

TSUZUNEのMarkdown相対linkが非activeになるのは `MarkdownPreview.tsx` の既存render分岐であり、移動によって新たに発生した回帰とは断定しない。相対画像も今回の移動後表示の観測であり、初期表示との完全な比較は未実施。Obsidianのbyte正規化はrename／move直後のsnapshotではまだ生じず、後続のノート切替までに生じた。rename API単体が原因とは断定しない。巨大整数はObsidianの表示で丸められたが、今回保存された原文の数字列は保持された。

## 安全性・検証の残る境界

- 観測結果の検査: 48件中47 PASS、1 FAIL。これは「意図した差の観測も含むassertion」であり、47項目の機能互換を意味しない。
- FAILは本番 `%APPDATA%/TSUZUNE` profile全体の不変条件。273ファイル中10件が変化した。`DawnGraphiteCache/index`、`DawnWebGPUCache/index`、`DIPS`、`GPUCache/data_1`、`GPUCache/index`、`Local Storage/leveldb/LOG`、同 `LOG.old`、`Session Storage/000003.log`、同 `LOG`、同 `LOG.old`。設定を含む残り263ファイルは一致。差分を元へ戻す操作はしていない。
- 原因は未特定。本番Session StorageのLOGは11:04:32 UTCの起動を記録するが、その操作主体は確定できない。fixture側にも別profileのsessionログが存在する。したがって「本番profileに一切触れなかった」「完全隔離PASS」とは呼ばない。次回の実機操作前にprocess／profile／session保存先と本番appの並行稼働を確認する。
- installed EXE／app.asar、Obsidian本番設定hash、Obsidian protocol登録、比較期間中のrepository source fingerprintは一致。今回のdoc追記前に確認した。テスト用アプリは閉じ、19444／19445にlistenerは残っていない。
- この後のrepo変更は比較reportと既存plan／ledger／statusの文書だけ。本体を再build・installしていないため画面や製品挙動は変わらない。repo全体fingerprintは文書更新で変わるので、昇格時のreceiptとのcurrent delivery matchは主張しない。先行promotionの受入時証拠を今回のprofile差分で書き換えない。
- 初期の非表示起動でscreenshotがtimeoutし、fixtureだけを通常起動へ変更した。最初のTSUZUNE rename試行はPlaywrightのnative confirm既定dismissで無変更、その後dialogを記録・承認して実行した。Obsidianのalias linkはaccessibility名が表示文字列と異なり、selectorを実際の名前へ訂正した。これらはharnessの試行として保持し、製品不具合には数えない。

## 実行責任と終了

Ownerが「やろう」と選択した比較作業。CEO-01がfixture、UI操作、検査、判断、最終保存を一体で実行した。独立trackを要さず委譲なし。使用Skill: ai-coding-operator、playwright、ponytail、tsuzune、tsuzune-execution-record。実行model／reasoningの正確なhost実表示は未確認であり推測記載しない。

比較・差分分類・修正候補選定は完了。安全性の未達条件は上記のとおり残し、次の実機試験の前提とする。製品修正、再インストール、Git deliveryは実施していない。
