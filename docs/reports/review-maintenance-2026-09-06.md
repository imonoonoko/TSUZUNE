# レビュー後の保守 — 2026-09-06

公開対象外ファイルの保護、推移依存3件の更新、現在欄と本番source証拠の整合を実装・source検証した。利用者のノート操作・画面の仕様は変えていない。本番反映の結果は、この文書を含むsourceに対応する最新[production receipt](production-update-latest.json)とVault実施記録を正本とする。

## 契約と変更境界

工房主は[プロジェクトレビュー](project-review-2026-09-06.md)の3件をまとめた保守提案を選択した。親CEO-01が一体で実装・検証を担当し、追加の分業は行っていない。状態所有先は[PLAN.mdのCurrent Decision](../../PLAN.md#current-decision)。成功条件は、非公開資料が通常stageに入らないこと、更新を指定3依存に限定して必須検査を通すこと、正確なsource証拠と本番同一性を通常gateで確認できること。

開始時のmainは`7892263cc6e039cde90a49e346246ed9581801e4`。既存差分は前回レビューのdocs INDEXとレビュー文書、前回から保持した非公開29 filesだけで、未統合の製品コード変更はなかった。2026-09-05の全体本番昇格と、その後のGit統合の証拠を引き継ぎ、今回承認された保守変更を加える。前回Git checkoutで失われた元の混在改行のbyte一致を復元したとは主張しない。

## 変更

1. **公開対象の保護:** `.gitignore`にroot抽出bundleと、確認済みのVault整理資料2ディレクトリの除外を追加した。ファイルは削除せず保持し、`.agent`／`.workflow`全体や他の実装証拠は除外しない。実workspaceの`git add --all --dry-run`から非公開対象が消え、隔離fixtureでも公開可能な新規ノートだけが候補に残ることを確認した。
2. **依存3件:** fast-uri `3.1.5 → 3.1.7`、qs `6.15.3 → 6.16.0`、@xmldom/xmldom `0.8.13 → 0.8.15`。lockfileの変更entryはこの3件だけ。`package.json`、Moment `2.29.1`、他の依存は維持した。
3. **sourceと現在欄:** `.gitattributes`でtext checkoutをLFに統一。既存Git indexがLFの1,152 filesについて、正確なbyte backupを取った後、CRLFだけをLFへ変換した。これによるGit上の内容差分の追加はない。利用者Vault内のBOM・改行を保持する製品契約は変更していない。
4. **本番source archive:** 既存`source-fingerprint.mjs`の列挙・hashを再利用し、production gate開始時だけ検証対象sourceを`work/production-source-*`へそのままコピーする。コピー先のhashを照合し、既存fileへの上書きは拒否する。成功receiptは対応するarchiveへの相対pathを持つ。通常のread-only fingerprint呼出しには書込みを加えていない。gateのwhitespace検査もHEADとの差分を対象にし、staged／unstaged両方を含める。
5. **文書の整合:** PLANの現在欄からP0-5時点の未反映説明を外し、過去の区切りを時点付き証拠として明示した。PROJECT_STATUSとProperties台帳もP0-7までの本番受入に合わせ、固定Calendar経路と汎用plugin runtimeを区別した。READMEには2026-08-26公開版と最新sourceの差を明示し、運用ガイドにLF・archive・gate後の文書確定規律を記載した。

## 検証済みsource証拠

| 検査 | 結果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | 107 files PASS / 1 SKIP、1141 tests PASS / 1 SKIP |
| `npm run check:mcp` | PASS。隔離bundleを使用し、登録済みMCP bundleの不変性も検査 |
| `npm run check:current-decision` | PASS。INDEXの最初の現在欄も単一正本pointerへ整合 |
| 新規archive fixture + 既存release contract | 6 PASS。CRLF設定下のLF checkout、dirty BOM／混在改行、untracked保持、非公開除外、重複archive拒否、後続source変更とarchive不変を確認 |
| `git diff --check` / stage dry-run / lock entry差分 | PASS / 非公開対象0 / 指定3 entriesだけ |
| `npm audit` | High 1 packageが残る。今回対象の3 packagesは解消 |

新規fixtureの初回は、Gitが内容不変と判断したfileを再checkoutしないためLF検査がFAILした。隔離fixtureのfileを一度取り除いて再checkoutする実際の再展開経路へ修正し、上記6検査をPASSした。製品障害ではない。Ponytail-reviewでは不要な抽象化・追加依存は見つからなかった。

Momentの2 advisoryは固定Calendar互換性で既に採用された残存リスクであり、audit全体をPASSとは表示しない。[採用境界](../../.agent/requirements/20260829-0603-calendar-plugin-compatibility/8_evidence_packet.md)の固定artifact、sandbox、限定bridgeと再評価条件を維持する。

## 本番受入と停止線

この文書と関連PLAN／statusを最後のsource確定物とし、その後に`npm run production:update`を行う。本番完了は、対応するreceiptの10/10、built／installed hash一致、production profile不変、archiveとsource fingerprint一致、fresh MCPのdelivery matchによって判定する。gateが失敗した場合、source検証を本番完了へ読み替えない。active Vaultを自動smokeへ渡さず、起動中の本番appは強制終了しない。

Git commit／PR／公開Releaseの作成は今回の保守に含めない。クリップID再利用の低頻度候補、次の日常操作機能、LIFE Weatherの利用者評価はこの3点の実装に追加しない。既存の機能優先順・採否は維持する。

## Evidence

- 実装: [fingerprint / archive](../../scripts/source-fingerprint.mjs)、[production gate](../../scripts/update-production.mjs)、[fixture](../../tests/source-fingerprint.test.ts)
- 運用: [Windows本番運用](../windows-production.md)、[Current Decision](../../PLAN.md#current-decision)
- localログ: `work/review-maintenance-20260906/{typecheck,tests,mcp}.log`、`npm-audit.json`、`lf-normalization.json`
- LF変換前の正確なsource copy: `work/review-maintenance-20260906/before-lf/`。本番成功のarchiveは最新receiptの`sourceArchive.path`を参照する。これらはローカル証拠で、Git cloneに同梱しない。
- 使用Skill: ai-coding-operator、Ponytail、ponytail-review、tsuzune、tsuzune-execution-record。
