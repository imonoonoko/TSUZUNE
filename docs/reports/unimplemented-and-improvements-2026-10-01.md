# TSUZUNE 未実装項目・改善点の再調査 — 2026-10-01

この文書は8項目採用前の調査証拠。同日、利用者が8項目計画を採用した。以後の実装状態は[実装・検証報告](eight-improvements-implementation-2026-10-01.md)と[PLAN Current Decision](../../PLAN.md#current-decision)を参照し、以下の「未実装」は調査時点として読む。

## 現在の結論

前回選択したMarkdown表示、リンクプレビュー、ショートカット設定、Basesセル編集、Properties全体管理は**source実装済み・本番未反映**。未実装候補へ数え直さない。[実装・隔離検証](five-improvements-implementation-2026-09-30.md)と[最終検証結果](../../.agent/requirements/20260930-five-improvements/results.md)を参照する。

今回の最優先修正候補は、**ノートの別フォルダ移動で、そのノート内の相対Markdownリンクが切れるケース**。次に標準Markdownリンクをバックリンク・Graphへ接続する改善がある。新しい機能候補としては、Basesの列数制限緩和、見出し／検索Bookmark、Live Preview、分割表示・ペイン幅変更、未リンク言及、Local Graphの深さ指定が残る。

これは調査上の推奨であり、実装の採用・開始ではない。実行状態は[PLAN Current Decision](../../PLAN.md#current-decision)を維持する。本番反映の停止条件も変更しない。製品コード・設定・通常profile・本番Vaultの値・Git公開は変更していない。

## 1. 今回再現した改善点

### ノート移動時の相対リンク保全

匿名の新規fixture Vaultで、実際の`VaultService`と、人間のノート移動IPCが呼ぶ`EntryMoveCoordinator.preflight/apply`を実行した。

```text
Inbox/A.md: # A\n\n[B](B.md)
Inbox/B.md: # B\n\n本文
Ref.md:    [A](Inbox/A.md)

操作: Inbox/A.md → Archive/A.md
結果: Ref.md は [A](Archive/A.md) に更新された。
      Archive/A.md 内は [B](B.md) のまま。
      Archive/B.md は存在せず、移動後のリンク解決は missing。
```

原因は[move-links](../../src/core/move-links.ts#L118)のMarkdown URL処理が、リンク先が「移動するノート」だった場合だけ書き換えるため。他ノートを指す相対リンクを持つノート自身の移動では、参照基準の変更を補正しない。[IPC経路](../../src/main/ipc.ts#L496)と[main preflight](../../src/main/entry-move.ts#L356)も照合した。

参照元から移動先へのMarkdownリンク更新は既にある。「Markdownリンクを一切更新しない」とは判定しない。最小修正の対象は、移動するノートの既存相対リンクを新しい場所から同じ参照先へ向け直すこと。コード・外部URL・見出し・表示名・本文保全を維持する。今回、folder全体の移動やinstalled UIは再現していない。

### Markdownリンクと構造探索の不一致

同じ匿名2ノートで、現在sourceを既存esbuildでメモリ内bundleし、解決・backlink・Graph・移動影響を比較した。

| A.mdの本文 | Preview用の解決 | B.mdへのbacklink | Graph辺 | B.md変更時の影響件数 |
|---|---|---|---|---|
| `[B](B.md)` | B.mdへresolved | 0件 | 0本 | 0件 |
| `[[B]]` | B.mdへresolved | A.mdの1件 | A→Bの1本 | 1件 |

[links](../../src/core/links.ts#L349)、[Graph](../../src/core/graph.ts#L154)、[影響表示](../../src/renderer/App.tsx#L2174)はWiki抽出を使う。MCPのbacklink読取も同じ関数を使う。Markdownリンクを書いても構造探索へ届かず、移動・名前変更の参照影響件数にも入らない。backlink／Graph対応と影響表示の整合は、移動時の本文修正とは別の改善条件として扱う。

## 2. 残る未実装候補

| 検討順 | 候補 | 現在あるもの／残る範囲 | 最小の次の選択 |
|---|---|---|---|
| 1 | Bases表示の拡張 | セル編集は実装済み。表はfile.name必須・最大3列、1ビュー、sort1件、AND filterのみ。formula／group／summary／cards／listは未対応 | まず必要な表の4列目。複数sortやOR等は個別に選ぶ |
| 2 | 見出し・検索Bookmark | file Bookmark、タイトル・group欄はある。型がfileのみで見出し位置や検索条件を保存できない | よく戻る節か検索を一つ選ぶ |
| 3 | Live Preview | Source編集とPreviewの切替、書式・リンク挿入はある。編集中の本文を装飾表示するモードはない | 編集しながら読みたい構文を限定 |
| 4 | 分割表示・ペイン幅変更 | タブ、名前付きworkspace、左右の開閉はある。同時に複数ノートを置くpane配置・任意幅の保持はない | 2ノート比較か左右幅調整のどちらか |
| 5 | 未リンク言及 | リンク済みbacklinkはある。タイトルが本文に現れるだけのノートを列挙するsurfaceはない | 日本語・同名・一般語の誤検出条件を固定 |
| 条件付き | Local Graphの深さ指定 | 入出リンク・近傍間リンクの切替はある。中心から複数段を辿るdepthはない | 実際に2段目が必要な探索を一件選ぶ |

Basesは実parserで正常な固定profileの受理と、4列・2 sort・2 view・OR・日本語Property参照`note.状態`の拒否を確認した。すべて`UNSUPPORTED_BASE`で理由を返す。これは現行の対応範囲で、壊れた表やセル保存の失敗とは区別する。[parser](../../src/core/base-profile.ts#L391)。日本語Property名は既存の名前検証も制約しており、今回の型管理実装の欠落とはしない。

Bookmarkは[型](../../src/shared/types.ts#L67)と[既存入力](../../src/renderer/components/BookmarkDialog.tsx)、Live Previewは[editor拡張](../../src/renderer/components/MarkdownEditor.tsx#L139)とAppのview切替、配置は[workspace schema](../../src/shared/workspace-state.ts#L12)とCSS grid、未リンク言及は[右文脈UI](../../src/renderer/components/RelatedNotes.tsx#L18)とリンク抽出、depthは[getLocalWikiGraph](../../src/core/graph.ts#L319)を照合した。これらはsourceの型・呼出し・UIの観察で、本人の需要や効果の測定ではない。

## 3. 実装不足と分ける改善・受入条件

- **本番反映の証拠:** 今回のinstalled EXE／app.asar SHA256は9月30日観測と同じ。live MCPは`stale_runtime:false`、`delivery_info:unknown`。現在checkoutとの一致を確認できない。9月24日の全source再構成不足を解消するまで5項目のproduction:updateは停止する。[再構成監査](five-improvements-implementation-2026-09-30.md#本番反映の停止理由)。
- **実機受入:** 日本語IME、Narrator／High Contrast、720px／200%表示、本人の操作確認は前回5項目で未確認。synthetic IMEやsource ElectronのPASSと区別する。
- **資料の現在性:** 9月30日の調査本文と9月9日の候補索引には、完成した5項目を未実装とする当時の記載がある。今回の入口を追加し、過去証拠と現在の実装を分けた。「29候補群」は9月9日時点の件数で、現在の未実装件数ではない。
- **AI再利用:** 固定評価の成功はあるが、日常全般の品質・時短の証明ではない。実際の質問に失敗があれば必要本文・時点・制約・回答根拠から原因を確認する。検索基盤・DB・Hook追加を先に選ばない。

## 4. Held／Researchの扱い

Canvas、復旧snapshot／復元UI、note merge／split等は既存候補として残るが、今回は対応全体・復旧動作を実機再検証していない。データ損失も観測していない。必要な操作と保全条件を選んだ後に確認する。

multi-seed Context、link health、広域Graph、Vector DB／cache、汎用plugin runtime、Hook・新規scheduleは既存のHeld／Researchを維持する。個人一台の用途にないcloud／account／共同編集を、未達の完成条件へ加えない。廃止した履歴機能や終了した構想も再開しない。

## 5. 検証範囲と再開点

- 今回実施: sourceの型・parser・UI・main IPC経路の照合、Wiki／Markdown比較fixture、実mainでの匿名ノート移動fixture、installed2ファイルのhash、live MCPの状態確認。
- 関連回帰: `npx vitest run tests/entry-move.test.ts tests/links.test.ts tests/base-profile.test.ts --maxWorkers=1` は3 files／61 tests PASS。既存の参照元リンク更新等の回帰であり、今回再現した移動後の相対リンク切れの解消は証明しない。修正コードは未実装。
- 文書: `npm run check:current-decision`、`git diff --check`はPASS。変更対象5文書の相対リンク253件を照合し、path欠落0件。リンク先の意味的一致や全anchorの検査ではない。
- 前回の証拠: 9月30日最終suiteは1,319 PASS／0 FAIL／1 SKIP。今回再実行した結果ではない。
- 今回未実施: full test・typecheck・packaged／installed smoke、通常profile全体比較、実OS IME、利用者受入、利用頻度・時間・料金の計測。本番Vaultを移動・変換・試験に使っていない。
- fixture Vault: `C:/Users/Humin/AppData/Local/Temp/tsuzune-audit-20261001-O1IyJK`。今回作成した匿名データであり、本番知識ではない。
- 完了: 未実装／改善／実装済み本番未反映の区別と、上記2件のリンク周辺の再現証拠を整理した。
- 次の一手: source修正なら移動時相対リンク保全を先に選ぶ。本番反映には従来のsource境界確認が必要。新しい機能実装へは今回着手していない。

既存調査記録へ今回の差分を統合する。実行順・採否は利用者が持ち、今回の調査でPLANの本番停止条件やHeldの採用状態を変更しない。
