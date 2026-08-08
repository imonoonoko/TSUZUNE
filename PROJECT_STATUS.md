# TSUZUNE Project Status

更新日: 2026-08-08（JST）

この文書は、TSUZUNEの「今」を一枚で確認するための入口です。長期計画と完了履歴は[PLAN.md](PLAN.md)、製品の不変条件は[PRODUCT.md](PRODUCT.md)、画面・ブランド規約は[DESIGN.md](DESIGN.md)を正本とします。

## 現在地

| 対象 | 現在の状態 | 正本 |
|---|---|---|
| インストール済み本番 | v0.5.0、`installed-and-verified`。2026-08-03 20:11 JSTにfeature checkpoint `ad26532`のclean sourceから更新し、packaged／installed smoke、hash一致、profile不変、MCP再登録まで確認 | [production-update-latest.json](docs/reports/production-update-latest.json) |
| 開発ブランチ | `agent/tsuzune-mcp-integration`。GP0-3b-dとOpenAI公式Export C0-Aのcheckpointを同名originへ同期 | Git |
| 直近slice | OpenAI公式Export C0-Aを実装・検証済み。原本非破壊の読み取り専用preview、安定ID、分岐・role・時刻・privacy・添付参照・hashの正規化に限定 | [PLAN.md](PLAN.md#c0-a-read-only-preview-and-normalized-manifest) |
| 最優先Track | v0.6 Obsidian Graph Parity | [PLAN.md](PLAN.md#active-track-v06-obsidian-graph-parity) |
| 次の縦切り | C1-A Candidate Preview。843件のeligible user textから出典付き候補をローカルpreviewへ整理し、人物プロフィールへの適用差分だけを表示する。Vault writeは0 | [PLAN.md](PLAN.md#c1-a-candidate-preview-without-vault-writes) |

## 実装済みの基盤

- ローカルMarkdown編集、folder、Wiki link、backlink、検索、添付preview。
- MCPによる検索、取得、backlink、Context、明示作成、revision付き更新、履歴付きAI自律更新。
- Temporal Memory Lite M0〜M5。valid-timeとknowledge-timeを分け、過去時点への未来情報混入を保守的に抑制する。
- Local／Global Graph、円形node、Canvas edge、Force runtime、Graph設定、Groups、検索、Animate、状態復元のcheckpoint実装。
- Google OAuth、基本profile、Google Drive手動同期。
- Windows installer、アプリ内更新、本番更新gate、installed hash検証、MCP再登録。

## 検証済みだが、完了と言わない範囲

### Graph

GP6-0Wでは公式Obsidian Desktop 1.13.4と同じfixture、viewport、DPR、themeで、7 Markdown、8 node、12 directed edge、8 undirected pairの構造一致を確認しました。操作、保存、設定、視覚の完全互換は未判定です。

GP0-3b-aでは、未保存のGlobal Graphを初めて開いたときに設定パネルが表示される公開挙動を一致させました。Obsidian 1.13.4の`close: false`に対し、TSUZUNEのVault scope既定を`settingsOpen: true`としました。Local既定と利用者が明示保存した開閉状態は変更していません。

GP0-3b-bでは、Global GraphのSearch filesへ`path:"10_projects"`を入力し、Graph再表示と別プロセスによるアプリ完全再起動後まで検索条件が保持されるかを比較しました。Obsidian 1.13.4とTSUZUNEはいずれも入力直後を含む3観測点で2 node／1 unique visible edgeを維持しました。このqueryとライフサイクルだけを`matched`とし、ピクセル一致、他query、起動時のGraph workspace自動復元は主張しません。

GP0-3b-cでは、Global Graphへ制御された論理wheel `deltaY=-120`と背景drag `+96,+64 CSS px`を与え、Graph再表示と別プロセスによるアプリ完全再起動後を比較しました。Obsidian側はCDPマウス入力、TSUZUNE側は隔離オフスクリーンのDOM合成入力です。両製品ともzoom `1.5`を保持し、panは中央へ戻りました。6/6比較が`matched`だったため、TSUZUNEへpan永続化などの製品変更は加えていません。物理マウス／trusted event、ピクセル一致、zoom easing、Local Graph、fit／reset、zoom限界、workspace leaf自動復元は未証明です。

GP0-3b-dでは、同じ画面条件で`00_Home.md`を`+96,+64 CSS px`ドラッグし、押下中、pointerup直後、250ms後、settled、Graph再表示後、アプリ完全再起動後を比較しました。両製品とも押下中だけnodeを一時固定し、pointerupで固定を解除してForce simulationへ戻り、Graph再表示／再起動へnode座標・pinを保存しません。意味契約5/5は`matched`で、製品source修正は不要です。Obsidianの再シード座標とTSUZUNEの決定的baselineは永続化契約の差ではありません。物理マウス／trusted event、ピクセル単位のForce軌跡、Local Graph、touch／penは未証明です。

- [GP6 comparison report](docs/reports/graph-gp6-production-comparison-2026-08-02.html)
- [GP6 working-tree evidence](docs/reports/assets/graph-gp6/tsuzune-working-tree/manifest.json)
- [GP7 initial settings comparison](docs/reports/graph-gp7-global-settings-default-2026-08-03.html)
- [GP0 search persistence comparison](docs/reports/graph-gp0-search-persistence-2026-08-03.html)
- [GP0 camera persistence comparison](docs/reports/graph-gp0-camera-persistence-2026-08-03.html)
- [GP0 camera machine-readable comparison](docs/reports/assets/graph-gp0-camera-persistence/comparison.json)
- [GP0 node drag persistence comparison](docs/reports/graph-gp0-node-drag-persistence-2026-08-04.html)
- [GP0 node drag machine-readable comparison](docs/reports/assets/graph-gp0-node-drag-persistence/comparison.json)

### Performance

500件／2000件の疎グラフfixtureを各3回測定しました。主ボトルネックはGraph構築ではなく、継続Force simulation、毎フレーム描画、watcher後の全体再反映です。これは改善前後を比べるbaselineで、合格値や一般Vault性能の証明ではありません。

- [Large Vault performance report](docs/reports/tsuzune-large-vault-performance-2026-08-03.html)
- [Machine-readable public summary](docs/reports/assets/large-vault-performance-2026-08-03/summary-public.json)

### Temporal Memory

M5固定dogfoodでは時間整合性が1/4から4/4、State NoteからSourceへの一致が0/3から3/3へ改善しました。これは根拠Bundleの改善であり、モデル本体の一般知能、人間の主観時間、エントロピー認識の実現ではありません。

- [M5 dogfood](docs/m5-dogfood.md)

## 正本の優先順位

1. 実行中の事実: インストール済み本体と最新のproduction receipt。
2. 実装の事実: source、tests、fixture、machine-readable artifacts。
3. 製品境界: `PRODUCT.md`、`DESIGN.md`、`AGENTS.md`。
4. 実行順: `PLAN.md`のActive TrackとCurrent Transition Queue。
5. 本番TSUZUNE Vault: 現在地への検索導線、判断履歴、日付付きEvidence。repo仕様の複製ではない。

SemVerやHEADだけで同一性を判断しません。現在の本番v0.5.0はfeature checkpoint `ad26532`のclean sourceから検証・導入され、receiptは同コミットと`dirty: false`を保持しています。本番同一性はreceiptのsource fingerprint、EXE／`app.asar` hashを併用して確認します。

## 優先キュー

1. C1-Aとして、843件のeligible user textを出典付き候補previewへ整理し、現在プロフィール5ノートとの差分をwriteなしで確認できるようにする。
2. 候補の現在性、privacy、訂正関係、出典を検証し、本人確認または明示ルールを通過した候補だけを後続sliceでVaultへ適用する。
3. GP0-3b-eとしてGlobal Graphのnode context menuを採取し、`matched`、`different`、`missing`へ分類する。
4. 公開差が確認できた場合だけ一件を修正し、同じcaptureで回帰を確認する。
5. Graph Trackを閉じた後に、720px／200% zoom、tree semantics、実Windows accessibilityを別sliceで扱う。
6. その後、Google Tasks、Drive選択取込、YouTube、Data Portabilityから一つを再選択する。
7. Context Compiler 2.0、より深い時間モデル、GraphRAG、独自DBは固定評価または計測で必要性が出てから一つずつ導入する。

## CheckpointとWorking treeの扱い

Graph検索保持の製品コード、tests、fixture、再現script、report assetsは`ad26532`へ収録済みです。GP0-3b-cとGP0-3b-dは比較harness、raw observation、画像、比較表、HTMLレポートだけを追加し、製品sourceは変更していません。C0-AはGit管理外で動く開発用CLIと純粋coreであり、Electron本番UI・packaged runtime・Vaultへは接続していません。このcheckpointでは同一binaryを再インストールせず、ブランチと本番TSUZUNEの開発記録だけを同期します。

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
