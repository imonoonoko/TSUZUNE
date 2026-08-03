# TSUZUNE Project Status

更新日: 2026-08-03（JST）

この文書は、TSUZUNEの「今」を一枚で確認するための入口です。長期計画と完了履歴は[PLAN.md](PLAN.md)、製品の不変条件は[PRODUCT.md](PRODUCT.md)、画面・ブランド規約は[DESIGN.md](DESIGN.md)を正本とします。

## 現在地

| 対象 | 現在の状態 | 正本 |
|---|---|---|
| インストール済み本番 | v0.5.0、`installed-and-verified`。2026-08-03 11:48 JSTにpackaged／installed smoke、hash一致、profile不変、MCP再登録まで確認 | [production-update-latest.json](docs/reports/production-update-latest.json) |
| 開発ブランチ | `agent/tsuzune-mcp-integration`、HEAD `5c0f4bb3`。`origin/agent/tsuzune-mcp-integration`と一致 | Git |
| Working tree | clean。v0.6 Graph parity、Temporal、MCP自律更新、製品最適化、tests、fixture、report assetsをcheckpointへ収録済み。typecheck PASS、45 files／全367 tests PASS、MCP smoke 4 read＋3 write PASS | source、tests、fixture、report assets |
| 最優先Track | v0.6 Obsidian Graph Parity | [PLAN.md](PLAN.md#active-track-v06-obsidian-graph-parity) |
| 次の縦切り | GP0-3b／GP1-7の残り。同一fixtureでnode drag、camera、context menu、Groups、Animate、Restore defaults、再起動後保存を比較する | [Graph parity reference](docs/obsidian-graph-parity-reference.md) |

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

GP0-3b-aでは、未保存のGlobal Graphを初めて開いたときに設定パネルが表示される公開挙動を一致させました。Obsidian 1.13.4の`close: false`に対し、TSUZUNEのVault scope既定を`settingsOpen: true`としました。Local既定と利用者が明示保存した開閉状態は変更していません。この一項目だけが`matched`であり、node drag、camera、context menu、Groups、Animate、Restore defaults、再起動後保存は引き続き未判定です。

- [GP6 comparison report](docs/reports/graph-gp6-production-comparison-2026-08-02.html)
- [GP6 working-tree evidence](docs/reports/assets/graph-gp6/tsuzune-working-tree/manifest.json)
- [GP7 initial settings comparison](docs/reports/graph-gp7-global-settings-default-2026-08-03.html)

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

SemVerやHEADだけで同一性を判断しません。現在の本番v0.5.0は`5c0f4bb3`を作る直前のdirty working treeから検証・導入されたため、receiptはGit provenanceとして`93a8502f`と`dirty: true`を正しく保持しています。本番同一性はreceiptのsource fingerprint、EXE／`app.asar` hashを併用して確認します。

## 優先キュー

1. GP0-3b／GP1-7の残る同条件操作比較を採取し、`matched`、`different`、`missing`、`intentional exception`へ分類する。
2. 次に確認できた公開差を一件だけ修正し、同じcaptureで回帰を確認する。
3. Graph Trackを閉じた後に、720px／200% zoom、tree semantics、実Windows accessibilityを別sliceで扱う。
4. その後、Google Tasks、Drive選択取込、YouTube、Data Portabilityから一つを再選択する。
5. Context Compiler 2.0、より深い時間モデル、GraphRAG、独自DBは固定評価または計測で必要性が出てから一つずつ導入する。

## CheckpointとWorking treeの扱い

現状は`5c0f4bb3`へ製品コード、tests、fixture、再現script、report assetsを収録し、working treeはcleanです。ブランチは同名のoriginへpush済みです。

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
