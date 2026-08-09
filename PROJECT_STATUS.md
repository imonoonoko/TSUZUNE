# TSUZUNE Project Status

更新日: 2026-08-09（JST）

この文書は、TSUZUNEの「今」を一枚で確認するための入口です。実行順と将来計画は[PLAN.md](PLAN.md)、製品の不変条件は[PRODUCT.md](PRODUCT.md)、画面・ブランド規約は[DESIGN.md](DESIGN.md)を正本とします。完了証拠は[docs/INDEX.md](docs/INDEX.md)から辿ります。

## 現在地

| 対象 | 現在の状態 | 正本 |
|---|---|---|
| インストール済み本番 | v0.5.0、`installed-and-verified`。2026-08-09 19:58 JSTにcommit `efe52ea`から更新し、GP0-3b-k、全438 tests、packaged／installed smoke、build／installed hash一致、profile不変、MCP再登録まで確認 | [production-update-latest.json](docs/reports/production-update-latest.json) |
| 開発ブランチ | `agent/tsuzune-mcp-integration`。C0-A〜C1-C、O1-W0、O1-W1、GP0-3b-kを実装・検証・commit・push・本番反映済み | Git |
| 直近slice | GP0-3b-kでattachment nodeのブックマークを比較。作成、取消、同一path再編集upsert、`ctime`保持、Graph再表示／別プロセス再起動保持、Vault内容不変を`matched-core-behavior`にした | [比較report](docs/reports/graph-gp0-attachment-bookmark-2026-08-09.html) |
| 直近の性能評価 | 同じ起点3件でTSUZUNEなし／ありを比較。固定4問は1/4→4/4、出典追跡0/3→3/3。Context構築medianは0.021ms→149.685msで、絶対追加約150ms | [benchmark](docs/reports/tsuzune-with-without-benchmark-2026-08-09.md) |
| 最優先Track | v0.6 Obsidian Graph Parity | [PLAN.md](PLAN.md#active-track-v06-obsidian-graph-parity) |
| 次の縦切り | GP0-3b-kはattachment nodeの`ブックマーク…`を比較済み。次はGP0-3b-lで`パスをコピー`のclipboard内容、menu close、Graph保持を固定比較する | [PLAN.md](PLAN.md) |

## 実装済みの基盤

- ローカルMarkdown編集、folder、Wiki link、backlink、検索、添付preview。
- MCPによる検索、取得、backlink、Context、明示作成、revision付き更新、履歴付きAI自律更新。
- Temporal Memory Lite M0〜M5。valid-timeとknowledge-timeを分け、過去時点への未来情報混入を保守的に抑制する。
- Local／Global Graph、円形node、Canvas edge、Force runtime、Graph設定、Groups、検索、Animate、状態復元のcheckpoint実装。
- Google OAuth、基本profile、Google Drive手動同期。
- Windows installer、アプリ内更新、本番更新gate、installed hash検証、MCP再登録。
- `90_テンプレート`のMarkdown雛形と、filesystem最終更新日／`review_after`による非破壊の鮮度表示（本番反映済み）。
- 通常ノートのアプリ内新規作成、Daily／Ideaフォーム、定型Markdownの安全なフォーム再編集、最小Markdown書式ツールバー（本番反映済み）。

## 検証済みだが、完了と言わない範囲

### Graph

GP6-0Wでは公式Obsidian Desktop 1.13.4と同じfixture、viewport、DPR、themeで、7 Markdown、8 node、12 directed edge、8 undirected pairの構造一致を確認しました。操作、保存、設定、視覚の完全互換は未判定です。

GP0-3b-aでは、未保存のGlobal Graphを初めて開いたときに設定パネルが表示される公開挙動を一致させました。Obsidian 1.13.4の`close: false`に対し、TSUZUNEのVault scope既定を`settingsOpen: true`としました。Local既定と利用者が明示保存した開閉状態は変更していません。

GP0-3b-bでは、Global GraphのSearch filesへ`path:"10_projects"`を入力し、Graph再表示と別プロセスによるアプリ完全再起動後まで検索条件が保持されるかを比較しました。Obsidian 1.13.4とTSUZUNEはいずれも入力直後を含む3観測点で2 node／1 unique visible edgeを維持しました。このqueryとライフサイクルだけを`matched`とし、ピクセル一致、他query、起動時のGraph workspace自動復元は主張しません。

GP0-3b-cでは、Global Graphへ制御された論理wheel `deltaY=-120`と背景drag `+96,+64 CSS px`を与え、Graph再表示と別プロセスによるアプリ完全再起動後を比較しました。Obsidian側はCDPマウス入力、TSUZUNE側は隔離オフスクリーンのDOM合成入力です。両製品ともzoom `1.5`を保持し、panは中央へ戻りました。6/6比較が`matched`だったため、TSUZUNEへpan永続化などの製品変更は加えていません。物理マウス／trusted event、ピクセル一致、zoom easing、Local Graph、fit／reset、zoom限界、workspace leaf自動復元は未証明です。

GP0-3b-dでは、同じ画面条件で`00_Home.md`を`+96,+64 CSS px`ドラッグし、押下中、pointerup直後、250ms後、settled、Graph再表示後、アプリ完全再起動後を比較しました。両製品とも押下中だけnodeを一時固定し、pointerupで固定を解除してForce simulationへ戻り、Graph再表示／再起動へnode座標・pinを保存しません。意味契約5/5は`matched`で、製品source修正は不要です。Obsidianの再シード座標とTSUZUNEの決定的baselineは永続化契約の差ではありません。物理マウス／trusted event、ピクセル単位のForce軌跡、Local Graph、touch／penは未証明です。

GP0-3b-eでは、Global Graphの`00_Home.md`を右クリックし、項目、順序、無効状態を固定比較しました。対象ラベル、先頭文言、削除操作は一致しましたが、Obsidian 1.13.4は11操作、TSUZUNEは2操作で、先頭操作もTSUZUNE側では無効でした。6比較中3一致・3差分の`different`であり、今回の製品修正は最初の公開差である文言を`新規タブに開く`へ合わせる一項目だけです。残るmenu操作、submenu、種別別open、物理マウス、見た目の完全一致は未証明です。

GP0-3b-fでは、その先頭操作を実際に有効化しました。note nodeは編集可能なworkspace tabを新規作成してactive化し、attachment nodeはアプリ内preview tabで表示します。TSUZUNEから既定アプリを開くのはpreview内の明示操作だけです。Obsidian 1.13.4とのnote比較ではtab作成・active化は一致しましたが、Obsidianは元Graph leafを保持し、TSUZUNEはGraph表示を閉じるため全体は`partial`です。Obsidian側attachment nodeの同操作は未証明です。

GP0-3b-gでは、この残差だけを閉じました。Global Graphをworkspace tabとして作成・保持し、noteを新規tabで開いた後もGraph tabを再選択して元のGlobal Graphへ戻れます。Obsidianはnote新規tab後もGraph leaf 1、TSUZUNEはGraph tab保持・復帰を固定fixtureで確認したため対象差は`matched`です。タブ復元・分割・並べ替えとObsidian attachment実動作は未証明です。

GP0-3b-hでは、公開フィルタの「添付書類」を有効化して`attachments/diagram.svg`を表示し、添付nodeの`新規タブに開く`を比較しました。Obsidian 1.13.4とTSUZUNEはいずれも内部preview tabを作成・active化し、元Global Graph tabを保持して復帰できるため対象差は`matched`です。製品コード変更はありません。添付context menuの網羅性はObsidian 11対TSUZUNE 2で未達です。

GP0-3b-iでは、添付nodeの`新規ウィンドウで開く`を比較しました。両製品とも2つ目のトップレベルウィンドウを生成し、`attachments/diagram.svg`をOS外部アプリではなく内部画像ビューで表示し、元Global Graphを保持してcontext menuを閉じるため対象動作は`matched`です。TSUZUNEの独立ウィンドウは最小shellであり、Obsidianのworkspace装飾との視覚一致と残るcontext menu操作は未達です。

GP0-3b-jでは、添付nodeの`ファイルを移動…`を取消、通常移動、同名衝突の3シナリオで比較しました。両製品とも通常移動後に埋め込み`![[attachments/diagram.svg]]`を自動書換えせず、旧pathを未解決node、新pathを実在する孤立attachment nodeとしてGraph再表示／アプリ再起動後まで保持します。同名衝突では既存`20_knowledge/diagram.svg`を上書きせず、移動元を`diagram 1.svg`へ自動採番します。中核動作は`matched-core-behavior`です。移動先選択はObsidianのtypeahead promptに対してTSUZUNEはselect/buttonで、context menu全体も11対4の既知差です。

GP0-3b-kでは、添付nodeの`ブックマーク…`を取消、作成、同一path再編集の3シナリオで比較しました。両製品とも取消では保存せず、作成後は対象pathのbookmarkをちょうど1件保持し、再編集では重複を作らず同じbookmarkをupsertして`ctime`を保持します。Graph再表示と別プロセス再起動後もbookmarkと対象attachment nodeを保持し、Markdown／Vault内容は変更しません。中核動作は`matched-core-behavior`です。Obsidianのgroup selectorに対するTSUZUNEのplain text input、context menu全体11対5、Bookmarks side panel／一覧／並べ替え／group階層は未一致または未証明です。

- [GP6 comparison report](docs/reports/graph-gp6-production-comparison-2026-08-02.html)
- [GP6 working-tree evidence](docs/reports/assets/graph-gp6/tsuzune-working-tree/manifest.json)
- [GP7 initial settings comparison](docs/reports/graph-gp7-global-settings-default-2026-08-03.html)
- [GP0 search persistence comparison](docs/reports/graph-gp0-search-persistence-2026-08-03.html)
- [GP0 camera persistence comparison](docs/reports/graph-gp0-camera-persistence-2026-08-03.html)
- [GP0 camera machine-readable comparison](docs/reports/assets/graph-gp0-camera-persistence/comparison.json)
- [GP0 node drag persistence comparison](docs/reports/graph-gp0-node-drag-persistence-2026-08-04.html)
- [GP0 node drag machine-readable comparison](docs/reports/assets/graph-gp0-node-drag-persistence/comparison.json)
- [GP0 node new-tab comparison](docs/reports/graph-gp0-node-new-tab-2026-08-09.html)
- [GP0 node new-tab machine-readable comparison](docs/reports/assets/graph-gp0-node-new-tab/comparison.json)
- [GP0 attachment file-move comparison](docs/reports/graph-gp0-attachment-file-move-2026-08-09.html)
- [GP0 attachment file-move machine-readable comparison](docs/reports/assets/graph-gp0-attachment-file-move/comparison.json)
- [GP0 attachment bookmark comparison](docs/reports/graph-gp0-attachment-bookmark-2026-08-09.html)
- [GP0 attachment bookmark machine-readable comparison](docs/reports/assets/graph-gp0-attachment-bookmark/comparison.json)

### Performance

500件／2000件の疎グラフfixtureを各3回測定しました。主ボトルネックはGraph構築ではなく、継続Force simulation、毎フレーム描画、watcher後の全体再反映です。これは改善前後を比べるbaselineで、合格値や一般Vault性能の証明ではありません。

- [Large Vault performance report](docs/reports/tsuzune-large-vault-performance-2026-08-03.html)
- [Machine-readable public summary](docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json)

### Temporal Memory

M5固定dogfoodでは時間整合性が1/4から4/4、State NoteからSourceへの一致が0/3から3/3へ改善しました。これは根拠Bundleの改善であり、モデル本体の一般知能、人間の主観時間、エントロピー認識の実現ではありません。

2026-08-09の本番Vault実測では、時間対応Contextの構築＋安全分析は要求単位snapshot indexの導入前median 151.123ms／p95 180.404ms、導入後median 35.934ms／p95 47.798msでした。改善後も現在Context 33,412文字／24ノート、過去Context 3,585文字／6ノート、未来情報混入0、出典6／3組を維持し、生成MarkdownのSHA-256も一致しています。Vault scan、MCP通信、AI生成、UI描画はこの値へ含めていません。

- [M5 dogfood](docs/m5-dogfood.md)
- [TSUZUNEあり／なし benchmark](docs/reports/tsuzune-with-without-benchmark-2026-08-09.md)

## 正本の優先順位

1. 実行中の事実: インストール済み本体と最新のproduction receipt。
2. 実装の事実: source、tests、fixture、machine-readable artifacts。
3. 製品境界: `PRODUCT.md`、`DESIGN.md`、`AGENTS.md`。
4. 実行順: `PLAN.md`のActive TrackとCurrent Transition Queue。
5. 本番TSUZUNE Vault: 現在地への検索導線、判断履歴、日付付きEvidence。repo仕様の複製ではない。

SemVerやHEADだけで同一性を判断しません。現在の本番commit、source fingerprint、clean/dirty状態、EXE／`app.asar` hashは[production-update-latest.json](docs/reports/production-update-latest.json)を唯一の正本とし、この段落へ可変値を複製しません。

## 優先キュー

1. M5-Cは要求単位snapshot indexで完了。Context構築median 151.123ms→35.934ms、p95 180.404ms→47.798ms、改善前後のMarkdown SHA-256と意味指標は一致した。
2. retained heap比較は未測定。cacheを要求境界より長寿命化する提案が出た場合だけ、GCを分離したharnessを先に作る。永続DBやbackground cacheは追加しない。
3. GP0-3b-kのブックマークは`matched-core-behavior`で完了。次はGP0-3b-lでObsidian attachment nodeの`パスをコピー`実動作を同じfixtureで採取し、clipboard内容、menu close、Graph保持をTSUZUNEと固定比較する。
4. 公開差が確認できた場合だけ一件を修正し、同じcaptureで回帰を確認する。
5. O1-W1は利用者指示で先行し、Daily／Ideaフォーム、新規ノート作成修正、最小書式ツールバーまで全回帰を通して完了した。
6. node context menuの残差分を一項目ずつ閉じた後、720px／200% zoom、tree semantics、実Windows accessibilityを別sliceで扱う。
7. さらにGoogle Tasks、Drive選択取込、YouTube、Data Portabilityから一つを再選択する。
8. ChatGPT候補は新しい高信頼例が10件以上たまるまで自動適用を解禁せず、C1-Dへ進まない。
9. Context Compiler 2.0、より深い時間モデル、GraphRAG、独自DBは固定評価または計測で必要性が出てから一つずつ導入する。

## CheckpointとWorking treeの扱い

Graph検索保持の製品コード、tests、fixture、再現script、report assetsは`ad26532`へ収録済みです。GP0-3b-cとGP0-3b-dは比較harness、raw observation、画像、比較表、HTMLレポートだけを追加し、製品sourceは変更していません。C0-A〜C1-CはGit管理外の`work/`へ個人本文とreviewを出す開発用CLI／純粋coreであり、Electron本番UI・packaged runtimeへは接続していません。C1-Cは既知誤検出を止めた一方、rule別review 10件未満のため自動適用を解禁せず、人物プロフィール5ノートへのwriteは0です。O1-W0／O1-W1はElectron UIへ接続し、2026-08-09のproduction update gateでこのPCの本番へ反映済みです。GP0-3b-jは`b47671a`、production testの2-worker gateは`9bec872`／`4051f9f`として同名originへpushし、12:54 JSTにclean sourceから本番へ反映済みです。GP0-3b-kは`efe52ea`として同名originへpushし、19:58 JSTに同commitのclean sourceから全438 tests、packaged／installed smoke、hash一致、production profile不変、MCP再登録を確認して本番へ反映済みです。

- 次のsliceでも、sourceだけ、reportだけの機械的な分割commitをせず、共有型、App、Vault、testsを含む機能契約単位で切る。
- fixture、日付付きreport、machine-readable artifactは比較の証拠として保持し、生成ゴミと決めつけて一括削除しない。
- `work/`は再計測用のローカル作業領域。耐久する性能証拠は`docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json`を参照する。

## 再開時の確認

```powershell
git status --short
npm run typecheck
npm test
npm run check:mcp
git diff --check
```

製品コードを本番へ反映する区切りでは、通常の検証後に`npm run production:update`を実行します。文書・調査だけの変更では、同じbinaryを再インストールしません。

資料全体の案内は[docs/INDEX.md](docs/INDEX.md)を参照してください。
