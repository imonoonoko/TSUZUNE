# Context読取境界の実装・検証 — 2026-09-10

利用者の「検証しつつ実装」に基づき、`build_context` が質問の全意味を収録すると読める説明を、実際の見出し選択の保証範囲へ訂正した。本文が不足するときの追加取得と、十分な本文・解消根拠のない矛盾を再取得しない判断を、既存の説明文へ統合した。

source実装と隔離評価は完了。本番反映の完了は、このsourceに対応する [production receipt](production-update-latest.json) と既存Vault記録「TSUZUNE-Context読取境界設計-実施記録-2026-09-10」を正本とする。本書はgate前に確定し、本番成功を先取りしない。実行状態は [PLAN.md](../../PLAN.md#current-decision) が所有する。

## 変更と境界

- `src/mcp/server.ts`: `build_context.description` と `query.describe` の2文字列を置換。`section_projection` は `truncated:false` でも必要節を欠く場合があること、`warnings:[]` は現在性の確認ではないことを明示した。
- 同説明の末尾: 欠けた本文は必要に応じて取得する。全文が既にあるsourceを、unknown lineageや矛盾の解消だけのために再取得せず、未解決点を示す。
- `docs/mcp-integration.md`: 既存の「Context本文の変換種別」へ同じ読取境界を統合。既知の本文とrevisionの再利用、旧serverで種別不明を補完しない扱いを維持した。
- `scripts/check-mcp.mjs`: 既存のtool説明契約チェックを新文面へ合わせた。queryのoptional・500文字上限等の検査は維持する。
- 既存設計への短い参照と、設計追補・PLAN・status・docs索引を接続した。

core、service、schemaの構造、候補選定、本文生成、予算、rankingは変更しない。新metadata、runtime、DB、依存、AGENTS／Skillの新規ルールは追加しない。設計§6の本番原資料2件の内容訂正は別候補であり、今回実行しない。

## 実AIの受入

既存S0の使い捨てVault／MCP SDK呼出しを再利用した。6ケース・8合成ノートを固定し、現行説明と候補説明を別のfresh Agentへ渡した。各readerは同じ読取手順で、質問、実際のSDK `listTools` catalog、初回の実応答だけを受け取り、必要と判断した追加読取を実行した。oracle・variant名・fixtureファイルの直接読取は渡していない。

最終候補の初回応答はbaselineをそのまま再利用し、CLIが実際に渡す本文とcatalogの一致も検査した。別途、最終候補serverへ実callした応答も比較し、生成時刻／as_ofの4箇所を除き同一、revisionを含む他のfieldは不変だった。catalogの差分は上記2つのdescriptionだけ。全8ファイルとdirectoryを含むfixtureの前後不変を確認した。

| ケース | baselineの追加call | 最終候補の追加call | 判定根拠 |
|---|---:|---:|---|
| K01: 必要な過去節がない抜粋 | search 4 + fetch 1 | search 2 | PASS。初回はsection_projection／truncated:false、過去節なし。最終候補は2回目の検索一致抜粋で過去の必要文を取得し、初回本文の現行契約と分けて回答した。全文取得したとは主張していない。 |
| K02: 両時点の本文が既にある | 0 | 0 | PASS。必要本文とrevisionを再利用した。 |
| K03: lineageはunknown、本文は明示的な現行契約 | 0 | 0 | PASS。採用日と旧案の適用終了を根拠に回答し、unknownだけを理由に取得しない。 |
| K04: 本文同士が矛盾し、解決先がない | 0 | 0 | PASS。Review要否を断定せず、両記述の不一致を示した。 |
| K05: 過去時点のReview運用 | search 1 + fetch 1 | search 1 + fetch 1 | PASS。初回body_omittedから必要本文を取得し、指定日のReview／旧本文保存を説明した。 |
| K06: revision／provenanceと旧本文復元の区別 | 0 | 0 | PASS。通常更新で旧本文は自動保存されず、この仕組み単独では復元できないと回答した。 |

baselineも6ケースを満たした。最終候補による一般的な正答率・速度・token・費用の改善は未確認。K01のcall数差を効果の証明にしない。SDK/CLIで提示したtool説明への行動評価であり、native hostのcatalogキャッシュ更新や自然利用全体の効果を証明しない。

最初の候補はK04で不要な`build_context`を1回追加した。末尾を一般的な「十分な本文を再利用する」に変更した2案目でも同じ余分な取得が出たため、全文が既にある場合の再読禁止を具体化した最終案を採用した。2案目はK01〜K04を実行し、失敗判明後のK05／K06は実行しなかった。

最終案の最初の4回は、比較用runnerの変更で初回応答が渡されなかった。A/Bとしてはinvalidとし、入力を渡す部分を修正して6件すべてfresh Agentで再実行した。invalid 4件は質問から通常の検索／fetch／build_contextで正しい根拠へ到達した補助証拠としてのみ保持し、K01の抜粋不足検知やK02の再取得不要の合格数に含めない。全部で26 reader実行、うち正式な最終比較はbaseline 6件＋最終候補6件である。

## 検証と証拠の所在

- `npm run typecheck`: PASS。
- `npm test`（single worker）: 1,253 PASS、1 SKIP。115 test files PASS、1 SKIP。
- `npm run check:mcp`: 旧文面literalのチェックを修正後PASS。最終文面でもPASS。既存query coverageの実装は維持される。
- `npm run check:current-decision` と対象差分の空白検査: PASS。docs索引の先頭にPLANへの正本導線を維持する検査で1回失敗し、今回の参照をその次へ移して修正した。
- 独立review: K04の不要取得とK01の検索一致抜粋による根拠充足を確認。Ponytail review: `Lean already. Ship.` 新規抽象化・依存を増やしていない。

ローカルの再現資料は次の作業領域に保存した（製品への組込みなし）。

`C:/Users/Humin/Documents/Codex/2026-09-09/https-github-com-memtensor-memmy-agent/work/context-boundary-implementation-20260910/`

- `baseline/`: 今回の編集前ファイル。既存dirty差分との分離用。
- `baseline-server.js`、`candidate-server.js`、`candidate2-server.js`、`candidate3-server.js`: 説明ごとの隔離bundle。
- `evaluation/fixtures/`、`cases.json`: 固定資料・質問。
- `evaluation/runs/parent-mapping.json` と `parent-mapping-final.json`: 比較条件、初回応答、catalog、revision。各runの追加call実応答も同directory。
- `evaluation/parent-audit.mjs`／`.json`: CLI実入力、実server応答、descriptionのみの差分、全fixture不変の機械検査。
- `evaluation/parent-assessment.md`: 本文と回答の対応、途中失敗、最終判断。
- `npm-test.log`、`production-source-audit.json`: 回帰検査と導入境界の証拠。

実行者は全readerが履歴非継承、model／reasoningは親から継承。実際のmodel名・effortはcollaboration結果に返らず未観測であり、推測して記録しない。親がfixtureの意味・採点・source編集・最終判断を担当し、補助AgentがSDK runner準備と独立reviewを担当した。本番TSUZUNE writeは親だけが行う。

## 本番反映の境界

開始時receiptは2026-09-09T06:26:30.554Zの`installed-and-verified`、source digestは`976a56a9fc76ecff0668d7d9841047288515d65c66ee6819c27747dc4a231ca9`。1,621ファイルの保存済みsource archiveを実ファイルから照合した。今回開始時のserver／MCP検査／利用案内はその本番archiveと一致する。既存dirty treeに含まれる他の製品変更は同archiveに既に収録済みで、今回新しく採用する差分ではない。

今回の変更以外にarchiveとの差があるのは、前段で追加されたdocs索引と2026-09-09の未実装候補整理の文書だけ。候補採用や新機能を含めないことを確認した。現在rootから既存production gateを実行し、typecheck／production tests／MCP／package／installer／packaged・installed smoke／hash／profile不変／登録を確認する。

本番アプリは利用者の保存・終了を待ってから更新し、強制終了しない。gate後は除外対象のreceiptと本番Vault記録へだけ結果を保存する。live MCPのfresh接続、`delivery_info`、最終同期のread-back・一意性・参照関係までが完了境界。Git公開、自然利用の一般的な効果、設計§6の原資料訂正は未実施のままとする。

設計の詳細は [Context読取境界の設計追補](../../.agent/requirements/20260906-0410-ai-reuse-contract/context-boundary-design-2026-09-10.md) を参照する。
