# 本番昇格範囲の監査 — 2026-09-05

## 後続のOwner承認 — 2026-09-05

監査後、Ownerが「全体を既存の検証・更新手順で導入する」と明示承認した。以下の監査時点の未承認記述は歴史証拠。現tree全体の正式gate実行・このPCへの導入・MCP登録更新が承認済みで、結果は本承認後のproduction receiptを参照する。新機能／Git公開は含まない。

## 結論と今回の境界

読取監査は完了。本番の実行ファイルと `app.asar` は9月4日の導入receiptに一致する。現sourceを導入すると、主に **Excluded files、文字列／数値／単純リスト／チェックボックスのProperties編集、Context利用・状態由来レシート** を含む更新になる。Obsidian互換性だけを切り出した導入ではない。

推奨は、この範囲と残る限界を示したうえで **現source全体を公式production gateで導入することへのOwner承認** を得ること。現在は範囲監査までの認可で、本番昇格は未実施・未承認。製品source、依存、ビルド済み出力、インストール済みアプリ、profile、MCP登録を変更していない。変更artifactは本監査報告、既存plan/status/state、既存Vault campaignと3入口のみ。

## 現在の導入証拠

- HEAD: `922d46858c963bbe6bf3be8b4af4b803bc113bc9`、main。Git HEADとdirty差分は導入済み境界を表さない。
- receipt: `docs/reports/production-update-latest.json`、`installed-and-verified`、version `0.6.0`、verifiedAt `2026-09-04T10:53:06.739Z`。
- 実測installed EXE SHA-256: `f129daed948b4845b9d3ecf394df6bf3ec426cab19243643c983797d33879610`。
- 実測installed app.asar SHA-256: `47def066d14b06f595011e6e10b86d03289fbdfc94096a489686d25d08b85ceb`。
- 上記2点はreceiptと一致。receipt自体のSHA-256: `f7ca4f3dde98b3f1a437605f8c5894d8a26c0745c16904cad2e7b2529dcfcf0a`。
- receiptはdirty sourceからの導入。1515 filesの集約fingerprint `761348048353b89eaccb7de646deb853e5916cda64ddd68a9ffa54a1bf34afc2` を記録するが、path別manifestやexact source snapshotを保持しない。
- docs、.agent、work、distの関連receipt／snapshot候補を限定調査した範囲では、9月4日導入に対応する全source snapshot／manifestを発見できなかった。PC全体の不存在証明ではない。8月31日の再構築監査資料は別時点の歴史証拠。
- 稼働MCPはdirect、build更新時刻 `2026-09-04T21:43:16.081Z`、起動時刻 `2026-09-05T03:09:29.396Z`、`stale_runtime:false`。`delivery_info:mismatch`。MCPの現在bundleとinstalled GUIは別の証拠面。

## 導入に含まれる内容と比較の強さ

| 対象 | 現sourceの到達経路／実効内容 | 本番との比較証拠 |
| --- | --- | --- |
| Excluded files | AppのSearch／Quick switcherで優先度を下げ、Graphから除外。設定を既存IPCで保存。`src/shared/excluded-files.ts`、`App.tsx`、`QuickSwitcherDialog.tsx`、`core/graph.ts`、`main/ipc.ts` | 既存current出力に `excludeWikiGraphPaths`、`moveDeprioritizedToEnd` が追加。App／QuickSwitcher／registerIpcの宣言差を確認。隔離互換性検証は既存P0-1報告。 |
| Properties | `core/frontmatter.ts`からMarkdownEditor／Previewへ。文字列・数値・単純list・booleanを型を保って追加・編集・削除。既存revision付き保存を利用 | installed MCP sourcemapのfrontmatter sourceとの差、既存renderer出力の編集helper追加とMarkdownEditor／Previewの宣言差を確認。全面YAML互換ではない。 |
| Context利用・状態由来レシート | MCP `build_context`の応答に収録観測、seed revision、現在State、明示source、supersedes、競合、再確認要否を追加。read-only情報 | installed sourcemapとcurrent sourceを構文比較。21個のtool登録のうち差があるのは `build_context` のみ。serviceはContextOutput／buildContextの変更とreceipt型・helper追加、contextはContextBundle／生成処理の変更。63個の既存service宣言は同一。 |
| Observatory／Calendar | 現sourceのAppから到達する既存画面 | installedと既存current rendererのObservatoryView、場の生成／更新関数、DailyCalendar、CalendarPluginFrameはコメントを除いた構文で同一。新規導入機能と数えない。画面全体のfresh runtime parityは未確認。 |
| Drive Sync | 既存App／preload／IPC／main serviceから到達。利用者の設定・操作に依存 | sourceで到達経路を確認。preload出力はinstalledとbyte同一、runtime依存集合も同一。ただしDriveの全機能同等性をこの監査だけで宣言しない。接続・同期操作は実施していない。 |
| Browser Clipper | packageのextraResourcesにbrowser-extensionを含み、既存main bridgeが動作。拡張の読込・pairingは別操作 | untracked directoryだが、installed resources内の8ファイルを直接hash比較して全件同一。Git diffに出ないことは未同梱の根拠ではない。 |
| 履歴生成廃止／旧試作の削除 | ordinary mutationの履歴生成廃止は既存契約。legacy `50_履歴`保護を維持。history-store-v2削除は別の隔離試作整理 | HEAD差分だけから今回の追加変更とは扱わない。installed-map側と21 toolの登録・既存service宣言比較で、これらを今回追加した公開操作とは認定しない。 |
| LIFE Weather試作、docs／tests／検証scripts | source fingerprintには含まれる。現時点でLIFE Weather試作のアプリ導線なし | `out/**/*`とpackage.jsonが本体、browser-extensionがextraResources。repository全ファイルがそのまま製品画面やruntimeになるわけではない。 |

現在package.jsonとinstalled package.jsonのversion／runtime依存11件は同一。これは推移依存やbuild再現性の証明ではない。既存 `out/tools/chatgpt-export-preview.js` とmapはinstalledとbyte同一で、map中の古いsourceとcurrent sourceに差があっても今回の未反映差分とは数えない。

比較は既存の出力を使用し、fresh buildは行っていない。named関数・class member・変数の構文hashは範囲を絞る証拠であり、全source復元や全挙動一致ではない。一部ライブラリ宣言の差は生成名の変化を含み得るため、機能追加や依存更新と断定しない。ここまでの監査でproduction-equivalent source boundaryは認定していない。

## 検証と承認後の受入

今回実行: installed identity、installed mapの21 source範囲、限定したbundle宣言、拡張8ファイル、依存集合、gate経路の照合。`node scripts/update-production.mjs --plan` PASS、`git diff --check` PASS（CRLF正規化の予告のみ）。アプリ起動・build・installer・full testsは実施していない。

再利用する直前のP0-5証拠: 全1124 tests PASS／1 SKIP（`--maxWorkers=1`）、typecheck、固定Obsidian 1.13.4との隔離実機26検査PASS。これは今回の再実行やproduction gateのPASSではない。新規未チェック値はTSUZUNE=false／Obsidian=空欄、コメント／BOM／改行の扱いにも差があり、TSUZUNEの非破壊保存を維持する。

全体導入が承認された場合の手順:

1. この監査以降のsource driftと競合作業を確認し、導入対象のrepo plan/statusを確定する。TSUZUNEが起動中ならOwnerによる終了を待つ。強制終了しない。
2. `npm run production:update`。競合／whitespace検査、sourceとprofileのsnapshot、typecheck、`test:production`（2 workers）、MCP、package、installer contract、隔離packaged smokeを通す。
3. source不変とアプリ終了を再確認してsilent install。隔離installed smoke、built/installed EXE・asarの完全hash一致、production profileのbyte不変、MCP登録を検証し、receiptを更新する。途中FAILなら成功扱いしない。必要な修正が範囲を広げる場合は戻す。
4. 更新後のruntime／deliveryと新レシート応答を確認し、既存campaignへ最終証拠を書き戻す。profile／active Vaultを自動smokeで開かない。Git push／PR／releaseは含まない。

同version 0.6.0の再導入はgateが許容する。現在のreceiptとdistは別証拠として扱い、旧installerの復旧可能性は未検証。自動rollback成功は主張しない。

## Owner判断の比較

| options | 許可する操作と成果 | 行わない操作／残る境界 |
| --- | --- | --- |
| A: 現source全体を導入（推奨） | 上記3領域を含む現treeを公式gateでbuild・このPCへinstall・MCP再登録し、installed受入を完了する | Git公開、機能追加、第三者への送信、active Vault自動操作をしない。gate結果と実利用受入はこれから。 |
| B: 本番維持 | 導入済みアプリを維持し、source検証済み成果と監査を保存する | build／install／登録変更をしない。今回の互換性改善は本番未反映のまま。 |
| C: 本番相当sourceを再構築 | 別の隔離境界で復元監査・再現buildを検討し、限定導入可能性を確認する | 本番導入や既存tree破壊をしない。完全snapshot未発見のため復元成功・限定導入可能性は未確定。 |

- decision: 監査で説明した現source全体を、このPCの本番更新対象として承認するか。
- recommendation: A。小さな部分だけをproduction baseと推定するより、実在する現treeと正式な受入gateで導入境界を固定できる。
- evidence and unknowns: installed identityは一致。主要差分は上記の通り。全source snapshotとfresh production受入は未確認。
- reversibility and impact: AはinstalledアプリとMCP登録を更新。gateがprofile不変を検査する。復旧の実機確認は未実施。Bは状態維持、Cは隔離した追加調査。
- defer cost: Bは改善の実利用が遅れる。Cは完全baseが見つからないまま再構築の調査・検証を要する。
- decision owner: 工房主。今回の「やろう」は直前に示した範囲監査の選択として扱い、全tree導入承認へ拡張していない。

承認根拠はrepo `AGENTS.md:19`: “require either explicit approval to promote the current source tree as a whole or a reconstruction audit that identifies a verified production-equivalent boundary.” この停止線は候補調査を続けるためではなく、現在の累積treeを導入対象として確定するために適用する。

## 委譲・証拠・再開

- production_baseline_scout / Luna low / 調査: 関連receipt・再構築資料のread-only照合を所有。9月4日の完全snapshot未発見という限定結論を採用。歴史的8月31日資料を現在baseには採用しない。
- production_scope_review / Terra medium / 正本・文脈監査: product導線とpackage入力のread-only追跡を所有。到達経路を採用。Git HEAD差分をinstalled差分とする推定、およびuntracked拡張に差がないとの初期解釈は不採用。親のinstalled資源・map比較で訂正した。
- 両agentともsource／Vault書込、build、install、Git変更、秘密取得を禁止。親がハッシュ実測、公開tool登録の未提示照合、最終採否、Vault同期を担当。引継ぎでbaselineの定義を再説明する負担が発生した。次回はinstalled比較artifactを先に渡し、HEAD差分からの機能推測を禁止する運用を維持する。恒久agentや追加管理runtimeは作らない。
- 監査用asar inventoryの初回実行はWindows区切りにより0件となった。assertを加えnative pathで再実行し11ファイルを確認した。製品不具合ではなく監査harnessの修正。
- durable結果: 本報告。既存plan/state/PLAN/PROJECT_STATUSが次の一手を示す。
- local evidence: `work/production-scope-20260905/{identity-before,installed-output-inventory,output-comparison,dependency-comparison,embedded-source-comparison,bounded-bundle-comparison,declaration-comparison,source-manifest-before,final-invariance}.json`。bundle本体やcredentialは抽出保存しない。
- Vault保存先: `30_知識/TSUZUNE-Obsidian互換性P0-1-Excluded-files-実施記録-2026-09-05.md`へ同campaignの監査を統合し、ロードマップ／project／今やることを各一度更新。同期証拠は `results/production-scope-tsuzune-sync.json`。
- 次の一手: A／B／CのOwner判断。機能実装を自動開始しない。全体導入の承認があれば上記gateを実行する。
