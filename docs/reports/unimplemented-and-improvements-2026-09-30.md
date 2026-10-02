# 未実装部分と改善余地の調査 — 2026-09-30

> 以下は5項目の採用前の調査証拠。5項目はその後source実装済み・本番未反映となった。[実装結果](five-improvements-implementation-2026-09-30.md)と[2026-10-01の再調査](unimplemented-and-improvements-2026-10-01.md)を現在の状態として参照する。

## 結論と範囲

日常の読み返しを改善するなら、まず**Markdownプレビューの基本対応**と**リンク先の短いプレビュー**を検討する。入力を改善するならcustom hotkeysが次候補。Bases・Propertiesの拡張は、具体的な作業目的が成立したものを個別に選ぶ。

これは調査上の推奨で、実装採用ではない。Primary／Nextは[PLANのCurrent Decision](../../PLAN.md#current-decision)のまま、新しい製品変更は未選択。機能コード、本番binary、設定、既存dirty差分を変更していない。

確認対象は現在checkoutの主要UI／parser、既存互換性台帳、9月9日の候補索引、Vaultの受入・運用記録。全画面・全syntax・全テスト・本番実機の全量監査ではない。現在checkoutとinstalledの一致は[先行照合](current-state-reconciliation-2026-09-30.md)のとおりunknownなので、以下の新しい描画結果は**現在の開発ソース**の証拠とする。

## 1. 今回再現した基本表示の不足

現在の`MarkdownPreview`を既存esbuildで隔離bundleし、Reactのstatic renderingで匿名fixtureを描画した。ネットワーク・Vault・通常profileへアクセスしていない。

| 入力 | 現在ソースの描画結果 | 利用上の改善余地 |
|---|---|---|
| `[[Other|Wiki]]` | Wikiリンクとして描画 | 既存機能。再実装しない |
| `[Local](Other.md)` | `inactive-link`のspanになり、リンクではない | 標準MarkdownのVault内ノートへ移動する経路 |
| `[Section](#section)` | 同じく非リンク | ノート内の見出しへ移動する経路。見出しID解決契約が必要 |
| `[Web](https://example.com)` | 外部リンクとして描画 | 既存機能。今回URLを開いてはいない |
| pipe区切りのMarkdown表 | table要素にならない | 表を本文として読むための表示対応 |
| `- [ ] task`／`- [x] done` | checkbox要素にならない | タスク状態の表示。クリック書戻しは別機能とする |

根拠: [プレビューのrenderer](../../src/renderer/components/MarkdownPreview.tsx)（188行、209〜239行）、[Wiki変換](../../src/core/links.ts)（144行）。現行rendererはWikiとHTTP(S)以外のリンクを非リンクへ落とし、GFM拡張を設定していない。表・checkboxの不足はSSRでも確認した。単なるdependency名の検索から未実装と断定していない。

証拠: `work/improvement-audit-20260930/preview-observation.json`に入力・描画HTML・判定を保存。証明範囲は静的な現在ソースの描画で、installed UI、クリック操作、スクリーンリーダー、保存結果、実利用頻度は未確認。

## 2. 未実装を現在ソースで確認した主要部分

| 項目 | 既にあるもの | 残る未実装部分 | 最小の検討範囲と根拠 |
|---|---|---|---|
| リンク先preview（B3） | Wiki解決、クリック遷移、本文preview | 本文リンクのhover／focus時に短いリンク先本文を表示 | 既存Wikiリンクに限定。keyboard・欠落・曖昧・除外・遅延・長さを決める。[MarkdownPreview](../../src/renderer/components/MarkdownPreview.tsx) |
| custom hotkeys（B5） | Ctrl+O、Ctrl+P、検索、タブ操作の固定shortcut | 利用者による割当・衝突表示・既定値復元 | 既存commandへの割当のみ。IME／OS予約／設定保存を受入条件にする。[App](../../src/renderer/App.tsx) 1479行・2997行、[settings](../../src/main/settings.ts) |
| Basesセル編集（A5） | 候補一覧、読取表、filter／sort、再読込、ノート遷移 | セルから単一ノートPropertyへの保存 | 単一セル・単一note・既存型に限定し、revision／atomic write／競合保全を再利用。[BaseTableView](../../src/renderer/components/BaseTableView.tsx) 20行・113行。全体型Registryを強制前提にしない |
| Bases表示拡張（A6） | 固定profileのtable | formula、別view、複数view、複数sort、OR等のfilter拡張、summary／group | 全面parser化ではなく必要なsyntaxを一つ選ぶ。[base-profile](../../src/core/base-profile.ts) 229行・331行・351行・444行。対応外を診断する現状を故障としない |
| Properties全体管理（A3／A4） | 単一note編集、使用数・型混在を示すInventory | 明示型Registry、型変更契約、複数note名変更・値変換 | 型の表示指定と値の変換を分離。bulk変更はdry-runと各revisionが必要。[PropertyInventoryView](../../src/renderer/components/PropertyInventoryView.tsx)、[管理計画](../../.agent/requirements/20260908-properties-global-management-design/plan.md) |
| Bookmarksの拡張（B4） | ファイルbookmark、title／group | 見出しや検索をbookmarkする型・操作 | 既存group欄まで未実装扱いしない。[VaultBookmark型](../../src/shared/types.ts) 67行、[BookmarkDialog](../../src/renderer/components/BookmarkDialog.tsx) |
| Local Graph拡張（B7） | 入出リンクの直接近傍、近傍間リンクの表示切替 | 可変depthで複数段を辿る操作 | 実際の構造探索需要がある時だけdepthを限定。[getLocalWikiGraph](../../src/core/graph.ts) 319行 |

既存[互換性台帳](../../.agent/requirements/20260905-obsidian-compatibility-program/compatibility-ledger.md)の`different`／`not_proven`は、機能全体の未実装という意味ではない。

## 3. そのほかの候補と保留理由

9月9日の[29候補群の索引](tsuzune-unimplemented-ideas-2026-09-09.md)を維持する。今回の基本表示不足はB1／B2の具体化であり、候補数を増やすための別programを作らない。

- **日常編集:** Live Preview、未リンク言及、slash commands、文字数表示、独自の一意note作成、Outlineの操作、分割pane・sidebar幅調整。既存のsource編集・見出しjump・workspaceを不足全体へ数え直さず、必要な一操作を選ぶ。
- **データ表現／復旧:** Canvas、復旧snapshot／復元UI、note merge／split、format converter。安全保存やtrashは復旧snapshotと別責務。損失が観測された場合は復旧を優先するが、今回は損失を観測していない。
- **AI／MCP:** multi-seed Context、出典を保つ重複表示整理、link health、Context量・検索性能、状態compiler拡張。目的・誤検出・品質比較・実測不足のためHeld／Research。履歴復活、全Vault ingestion、Vector DBやcacheを先行追加しない。
- **外部連携／配布:** 選択取込、Export候補apply、署名とupdater追加受入、Theme／CSS snippets等。個人一台の用途に必要かを先に決める。汎用plugin、cloud／account／共同編集は現行scope外。

ここは既存設計・台帳からの候補整理であり、各項目を今回全量実機再検証した結果ではない。Theme等の旧案や個別connectorの現在有無は未確認を保持する。

## 4. 機能追加以外の改善余地

1. **本番証拠の保全:** 9月24日source／receiptが欠け、現在同一性を確定できない。新しい本番更新の前に復元監査、または現checkout全体のpromotionを本人が選ぶ必要がある。新機能不足と分けて最初のdelivery条件にする。
2. **日本語入力の受入:** source上、タブshortcutには`isComposing` guardがあり、全体のCtrl+O／P／検索handlerには同じguardがない。これは確認候補で、実IME障害やデータ損失を今回再現したものではない。custom hotkeysに進む前に既存経路のIME fixture／実機受入を確認する。
3. **AI再利用の質:** S0固定5問・Context固定6件・限定連続試行のPASSから、日常全般の回答精度や誤答減少は保証できない。実際の質問一件で、取得本文・日付・制約・回答根拠を照合することが、基盤追加より小さい次の確認になる。
4. **整理処理の性能:** 9月30日のOpenClaw性能記録では少量日次に障害を観測していないが、長文候補の逐次モデル比較は分単位になり得る。OpenClaw日次jobはその後停止済み。過去の長文試験をCodex automationの現在性能へ転用せず、再開・大量投入時に候補数と時間を測ってから最小修正を選ぶ。

## 5. 推奨する選び方

| 順位 | 検討候補 | 判断理由・必要な次の確認 |
|---|---|---|
| 1 | Markdownプレビューの相対リンク／見出しリンク、表・タスク表示から一件 | 基本的な読み返しの不足を現在source fixtureで再現できた。通常Markdownを読む用途なら先に確認。リンク解決とGFM表示は分けて受入する |
| 2 | Wikiリンク先の短いpreview | 元の文脈を離れず根拠を見る改善。従来のB3推奨は引き続き妥当だが効果は未測定 |
| 3 | custom hotkeys | よく使う操作を短くする。実際に割り当てたいcommandを先に決め、IMEと衝突を確認 |
| 4 | Bases単一セル編集 | 表を作業場所にしたい場合に選ぶ。本文書換えを伴うため読取改善より保全条件が多い |
| 条件付き | Properties型管理、Outline／bookmark、pane幅、復旧等 | 現在困っている対象が一つに定まったものを繰り上げる。全面互換の順位へ戻さない |

完了済みのBases候補一覧、名前付きworkspace、検索一致抜粋、Context本文変換種別、直接保存、日次整理、Browser Clipperは再実装しない。Heldは保留、Researchは比較段階を維持する。調査完了時点の次の一手は候補の選択であり、今回の実装はなし。

## 検証・限界

- 主要呼出し／renderer／parser／settings型と既存受入証拠を限定照合した。
- 新しい動作証拠は匿名3fixtureの現在source SSR描画。full test、typecheck、installed smoke、UI操作、利用者受入、利用頻度・効果・工数の測定は今回実施していない。
- `check:current-decision`と`git diff --check`はPASS。文書3件のlocalリンク切れ0、対象外baseline 1,637ファイルのhash不変を確認した。例示のinline codeはリンク検査から除外した。最終Vault同期は実施記録と関係入口のrevision付き更新・read-backで確認する。文書調査から本番更新・設定・Git公開へ進まない。
