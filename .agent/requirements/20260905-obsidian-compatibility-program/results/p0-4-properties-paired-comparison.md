# P0-4 Properties — 隔離実機の対比較

As of: 2026-09-05 05:35 JST。比較作業は完了。製品コードの変更・本番反映・Git送信はしていない。

## 結論

同じ匿名ノート5ケースでフォーム操作・保存・別プロセス再起動を比較した。文字列、通常の小数、文字列リストの最終値は一致した。混在リストの項目型、コメント、数値の字面、BOM／改行の保存は異なる。Properties全体の判定は **different** を維持する。

TSUZUNEは今回の対象で元の数値型、コメントの文字列、BOM／CRLF、対象外フィールドと本文を保持した。Obsidianの丸めや型変換・コメント除去へ追従する変更は、データ非破壊という目的に合わないため提案しない。

## 対象と実行方法

- Obsidian: 公式 **1.13.4** のWindows x64配布物を展開し、インストーラを実行せず起動。固定参照版であり、最新版を意味しない。[公式release](https://github.com/obsidianmd/obsidian-releases/releases/tag/v1.13.4)／[Properties公式説明](https://obsidian.md/help/properties)を2026-09-05に確認。
- 公式installer SHA-256: `8c761aaa40310d339b6936092e91e99a9886daf1fd655f4c8d59e9f7fa46e7a0`。展開した `obsidian.asar`: `51218495ad940a8515b202d380bde638be6570a198e121f7ca6d484a8a158917`。exe hashとruntime版はsession／isolation evidenceに記録。
- TSUZUNE: 現在のdirty sourceを `npm run build` で構築した `out` を、repositoryのElectron 43.2.0で起動した。**installed productionの受入ではない**。起動wrapperはuserData、表示位置、background renderingだけを制御し、Propertiesや保存処理は変更していない。
- 両者に同一byteの5対象ノートとリンク先 `Note.md` を別々に複製。VaultとuserDataは `output/playwright/p0-4-properties-20260905/{obsidian,tsuzune}/` 以下。mainのuserDataを照合し、Obsidianのactive Vault pathも照合した。TSUZUNEはisolated settingsのlastVaultPathと匿名ファイル一覧を確認した。
- Codex内ブラウザはnative Electronへ接続できないため、読み込んだPlaywright Skillに従い、同梱PlaywrightのCDP接続を使用。DOM／ARIAを観測してからフォームへclick、fill、Enter／Tab、メニュー操作を送った。Obsidianのnote openとprofile/version読取には既存harnessと同じworkspace／Electron APIを使用した。値の保存にAPIや直接ファイル書換えは使用していない。
- Obsidianの起動時protocol再登録を避けるため、既存 `obsidian://` 登録が指していた、消失済みの過去の隔離runtime directoryへ公式runtimeを再展開した。registryを削除・書換えず、前後で完全一致を確認した。
- Obsidianのネットワーク名前解決は検証用起動引数で無効化。TSUZUNEのBrowser Clip bridgeは既存本番portとの競合をログへ出したが、本比較でbridgeは使用していない。production TSUZUNEを終了・再登録・更新していない。

## 比較結果

| ケース／操作 | TSUZUNE | Obsidian 1.13.4 | 判定 |
|---|---|---|---|
| 01 文字列 `before → after` | textとして保存。引用符とinline commentを保持 | textとして保存。引用符とcommentを除去 | 値と型はmatched、byteはdifferent |
| 02 `9007199254740993.1200` を開き、`-0.50`へ編集 | 初期の全桁を表示。保存も `-0.50`、BOM／CRLF／comment保持 | 初期表示 `9007199254740994`。未編集のopenは元byteを保持。編集後は `-0.5`、BOM除去、全体LF化、comment除去 | 編集後の数値はmatched、精度表示／字面／非対象byteはdifferent |
| 03 flowの混在list `["42", -2.5, "[[Note]]"]` の先頭を43、数値を-3.50へ | text／number／textを維持。blockへ整形し2コメントを保持 | 初期type unknown。メニューでlistを選び、変換確認後に編集すると全項目がtextへ。2コメント除去 | mixed-type round tripはdifferent |
| 04 indentless＋header/itemコメントの混在listを同様に編集 | text／number維持。header comment保持、2 item commentは独立行へ移動。`flag`／`date`／`empty: null`はbyte保持 | 初期unknown。listへ切替後の編集で全項目text。コメント除去。`empty: null → empty:`、nullの意味は維持 | 型／コメント関連付け／保存byteはdifferent |
| 05 text list `labels=[alpha,"42"]`を追加し、alpha→beta、42項目削除、title property削除 | 最終 `labels: ["beta"]` | 最終 `labels: [beta]` | 最終値／型／追加・編集・削除はmatched、引用符はdifferent |

ケース03／04は、Obsidianで追加の型選択・変換確認が必要だったため、同一操作数や直接編集の一致とは呼ばない。変換確認だけではMarkdown byteは変わらず、ケース03の先頭文字列だけを43へ編集した時点で、**触っていない数値 -2.5まで引用付き文字列へ変わった**。最後に数値項目を入力したことだけを変換原因とは扱わない。

ケース04のTSUZUNEはコメントの文言を保持するが、元の項目へのinline関連付けを保持しない。コメント完全往復のclaimはしない。両アプリとも `flag=true`、日付文字列、nullの意味は保持したが、Obsidianはnullの書式を変更した。Obsidianのケース02は本文もCRLFからLFに変わるので、本文byte保持とは呼ばない。

## 永続化・安全性

- 全5ケース×2アプリの再起動後フォームを再観測。各アプリの保存後ファイルと再起動後ファイルは、リンク先を含む6/6 SHA-256が一致した。両アプリ間のhash一致ではない。
- TSUZUNE PID `28860 → 12896`、Obsidian PID `11524 → 10872`。再起動前に前者のwindowをclose、後者は隔離profileを照合してapp.quitを呼んだ。終了後の親checkで記録した4 PIDは不在、CDP listener 19424／19425は閉鎖、本番TSUZUNE PID **27160** は同じinstalled pathで稼働継続を確認した。
- 親の33 invariant checksは33/33 PASS。再起動前後hash、TSUZUNEの5本文、7コメント文言、BOM／CRLF、unsupported隣接3フィールド、P0-3製品3ファイルhash、選択した本番settingsとprotocol登録、Obsidianの数値未編集openを確認した。33は独立ケース数ではなく機械検査項目数。
- `npm run build` PASS（typecheck、Electron build、MCP buildを含む）。製品code変更がないため全test／production gateは再実行していない。P0-3の1099 PASS／1 SKIPは過去のsource regression evidenceとして分離する。
- 最終の `npm run check:current-decision` と `git diff --check` はPASS（既存LF→CRLF advisoryのみ）。同期待ち4対象のJSONとtask stateをparseして、比較completed／Vault同期blockedの区別を確認した。
- 保護確認は `%APPDATA%/TSUZUNE/settings.json`、`%APPDATA%/obsidian/obsidian.json` の有無/hashと `HKCU/Software/Classes/obsidian`。**本番profile全ファイルやactive Vault全体の前後hash監査ではない**。automated testの対象にactive Vaultを指定していない。

## Evidenceの入口

repository rootからの相対path:

- 元入力の唯一の正本: `output/playwright/p0-4-properties-20260905/initial-fixtures.json`
- 最終保存: 同directoryの `tsuzune-saved-files.json`／`obsidian-saved-files.json`
- 再起動: `restart-result.json`、各 `*-first-session.json`／`*-session.json`／`*-isolation.json`、`*-reopened.{png,aria.txt,dom.json}`
- 保存前の型: `obsidian-number-initial.json`、`obsidian-flow-initial.json`、`obsidian-indentless-initial.json`、TSUZUNEの `02-number-before`／`03-flow-form`／`04-indentless-before` snapshots
- 変換の時点: `obsidian-list-selected-files.json`、`obsidian-list-converted-files.json`、`obsidian-list-first-edited-files.json`
- 操作中の証拠: `*-added-files.json`、各caseの `*-saved.png` とDOM／ARIA。`*-four-saved-files.json` はcase05操作前であり、case05完了の証拠に使わない。
- 安全性・exact source/build hashes: `parent-verification.json`、`protected-before.json`／`protected-after.json`、`process-cleanup.json`
- task専用の段階別操作script: `work/p0-4-properties-runtime/*.mjs`。既存fixtureを変更するため、同じfolderへ丸ごと再実行するone-shot testではない。
- `*-initial.{png,aria.txt,dom.json}` と `*-initial-files.json` は起動scriptが再起動時に上書きした最新startup snapshot。**元入力／初回表示の証拠から除外**する。初回snapshot命名の問題は次のharnessでstage suffixを必須にする。

## 委譲・採否・改善

- `paired_harness_scout`／Euler、調査、Luna・low、read-only: 既存のisolated Electron/CDP launch、profile assertion、固定版hash、registry副作用を抽出。runtime操作・source/Vault writeは禁止。親は最小の安全な起動部品だけを採用し、既存script全体は実行しなかった。
- `paired_matrix_review`／Leibniz、検証、Luna・low、read-only: 独立した最小比較ケースを提案し、完成したfile／restart証拠を照合。親は精度、混在型、コメント、unsupported隣接、通常list操作を採用した。最終reviewのcase05に中間stageを混ぜた記述は不採用とし、両者が `*-saved-files.json` とrestartのexact値で訂正した。
- 親はruntime操作・統合・33項目の未提示境界・本番TSUZUNE書戻しを所有。親の実model識別子は推定しない。子のLuna/lowはtoolのrole metadataによる。
- 観測したharness再作業: Windows ESM絶対pathのfile URL化、空のELECTRON_RUN_AS_NODE除去、非表示windowのscreenshot timeoutをshowInactiveで解消。いずれもtask harnessだけの修正。製品failureとして集計しない。
- 維持: 読取の根拠抽出と最終証拠reviewの分離。変更: evidenceの初回／中間／最終stage名を明示し、子の結論だけで完了にせず親がexactファイルを再取得する。新runtime、dashboard、常設agentは作らない。時間/token/billingの改善は主張しない。
- 使用Skill: orchestrate-skills、ai-coding-operator、codex-dynamic-workflows、playwright、ponytail、tsuzune、tsuzune-execution-record。今回の製品TDDは対象外。

## 次の一手と完了境界

P0-4の比較は完了。TSUZUNEの型・コメント文言・数値字面の保持を維持する。次の候補は、ケース04で実際に差を確認した **真偽値（checkbox）の無損失フォーム編集**。工房主が選択した後に、その一件だけをaccepted syntaxとsave/reload fixtureから開始する。候補提示だけで着手しない。

Properties全体、Unicode名、複雑YAML、全Vaultのproperty型共有、他のObsidian版、cross-app交互編集、物理操作、installed TSUZUNE、production promotionは今回の検証範囲外。比較だけのため製品の挙動・外観は変えていない。

ローカルの比較記録・台帳・plan／statusと、Vaultへの同期は完了した。最初の更新は `STALE_RUNTIME_WRITE_BLOCKED` で停止したが、2026-09-05 06:00〜06:01 JST、工房主の再起動通知後に4対象を再fetchして旧revisionと一致することを確認し、既存campaignを先に、project／roadmap／current-actionを続けて各一度更新した。全4ノートのread-backは予定差分適用後の全文と完全一致し、一意検索1件と関連3入口からのbacklinkを確認した。P0-4のstateはcompleteであり、Program全体完了を意味しない。

`p0-4-pending-tsuzune-writeback.json` は初回の同期待ち差分を保持し、現在はapplied-and-verifiedとexact revision／read-back／backlink証拠を記録した完了資料である。本番保存先は既存の `30_知識/TSUZUNE-Obsidian互換性P0-1-Excluded-files-実施記録-2026-09-05.md`、`10_プロジェクト/TSUZUNE.md`、`30_知識/TSUZUNE開発ロードマップ.md`、`00_入口/今やること.md`。再開時はtsuzuneとtsuzune-execution-recordの既存契約を継続し、順序依存の記録同期だけなので親が一体で処理した。MCP設定変更・guard回避・直接Vault書込み・比較再実行・製品変更は行っていない。

効率計測は初回実行のstart／finishを各一度記録した。当時のoutcome=blockedは同期停止時点の履歴であり、今回の再開分は含まない。完了済み計測を再finishせず、最終作業状態は本reportとstate.jsonのcompleteを参照する。使用量や推定費用をVaultへ複製していない。
