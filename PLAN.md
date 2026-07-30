# TSUZUNE Near-Term Plan

## Temporal Memory Lite

作成日: 2026-07-30
状態: 完了（M0〜M5）
対象: v0.2のCodex・ChatGPTデスクトップ連携を基礎にしたv0.3開発

この文書は、TSUZUNEの長期的な機能一覧ではなく、次に実装する順序と停止条件を決めるための計画である。`docs/v0.1-scope.md`を置き換えず、グラフ、同期、プラグイン、独自DBまで一度に扱わない。

## Active Track: v0.4 Google Drive Manual Sync + Local Graph

更新日: 2026-07-31
状態: 標準ログイン経路の実装・ローカル検証完了（実クライアントIDの発行・組み込みと実Google確認は未完了）

v0.4では、実運用でノート同士の近傍を確認しやすくする1-hopグラフと、ローカルMarkdownを原本のまま別端末へ運べる手動Google Drive同期だけを扱う。Googleデータ取り込みによるパーソナライズ、プラグイン、独自DB、バックグラウンド同期は同時に実装しない。

### v0.4 Progress

- [x] 要求権限、削除、競合、原本、非対象データを要件として固定
- [x] 選択ノート中心の1-hopグラフを純粋coreとSVG＋HTMLボタンで実装
- [x] Desktop OAuth JSON解析、PKCE、loopback callback、token exchangeを実装
- [x] 配布版へ公開Desktop OAuthクライアントIDだけを組み込み、通常UIを「Googleでログイン」へ短縮
- [x] 独自OAuth JSONは詳細設定へ移し、保存済みJSONを標準設定より優先
- [x] 更新トークンの`safeStorage`向け暗号化保存を実装
- [x] `drive.file`で専用VaultフォルダとMarkdownだけを扱うDrive APIクライアントを実装
- [x] 送信・受信・競合・保持を決める削除非伝播の同期plannerを実装
- [x] デスクトップ画面へGoogle接続、同期preview/apply、グラフの操作面を追加
- [x] main processで認証、Driveクライアント、Vault、同期ledgerを接続
- [x] 別端末から既存Drive Vaultを一覧・検証・明示ペアリングできる操作を追加
- [x] 同期途中の成功操作を都度ledgerへ確定し、再試行時の不要な競合を防止
- [x] mock/fixtureによる同期適用テストと全回帰確認
- [ ] TSUZUNE用Desktop OAuthクライアントIDを発行して配布ビルドへ組み込む
- [ ] 組み込みIDを使った実Google認証・Drive往復確認

実Google確認にはGoogle Cloudで発行したTSUZUNE用クライアントIDが必要である。クライアントID未設定のモックテストPASSを、Googleアカウントでの認証成功やDrive上の実ファイル同期成功として報告しない。

ローカル検証結果:

```text
npm run typecheck    PASS
npm test             PASS: 23 files / 177 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
```

## Progress

- [x] M0: v0.2基準（`0c66af8`）の型検査、56テスト、MCP smoke、ビルドを確認
- [x] M1: State/Event契約、正常値、失敗値、時間境界をテストで固定
- [x] M2: 非破壊frontmatter parser、時間判定、再確認期限、`supersedes`、subject別タイムラインを純粋coreとして実装
- [x] M3: 時点・質問・知識時点を考慮し、根拠と警告を付けるContext Compiler
- [x] M4: MCPと右パネルのTemporal Inspector
- [x] M5: Starter Vaultでdogfood

M4では、既存MCPの後方互換性を保ったまま`as_of`と`include_history`を公開し、右パネルへ読み取り専用のTemporal Inspectorを追加した。不正な時間メタデータがあっても、ノート編集は継続できる。M5の公開前監査で、MCPにも`temporal_perspective`を追加し、既定のvalid-timeと明示的なknowledge-timeを呼び分けられるようにした。

M4完了時点の検証:

```text
npm run typecheck    PASS
npm test             PASS: 13 files / 102 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
git diff --check     PASS
```

M4の公開済みチェックポイント:

```text
branch: agent/tsuzune-mcp-integration
commit: 4b35765 Add temporal memory context and inspector
remote: origin/agent/tsuzune-mcp-integration
visibility: private
```

M5ではStarter Vaultへ3対象、State Note 5件、Event Note 3件、追加出典ノート1件を投入し、起点だけ、従来1段Context、時間対応Contextを同じ固定質問で比較した。

```text
固定4問の厳密正答        A: 1/4  B: 1/4  C: 4/4
State Note → Source一致 A: 0/3  B: 0/3  C: 3/3
過去への未来State/Event C: 0
過去への時点不明本文     C: 0
再確認警告               C: 2
安全性プローブ           PASS: 4/4
```

dogfood中に、過去時点Contextへ後日の通常ノート本文が露出する問題を発見した。明示された過去の`as_of`では、有効時点を持たない通常ノート本文を保守的に省略し、stub、`content_omitted`、`UNSCOPED_NORMAL_CONTENT_OMITTED`警告を返すよう最小修正した。詳細は`docs/m5-dogfood.md`に記録した。

M5完了時点の検証:

```text
npm run typecheck    PASS
npm test             PASS: 14 files / 113 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
npm run build        PASS
npm run dogfood:m5 -- "<Starter Vault path>" 2026-07-31 2026-07-22
                       PASS
git diff --check     PASS
```

M5の実装・検証結果は、このブランチの次の公開チェックポイントとして確定する。

## 1. Objective

Markdownノートへ任意の時間情報と出典を付け、TSUZUNEとCodexが次を区別できるようにする。

- 現在有効な状態
- 過去に有効だった状態
- ある日に起きた出来事
- 最後の確認から時間が経ち、再確認が必要な情報
- 新しい情報によって置き換えられた情報

最初の完成形は「人間のような主観時間」ではない。

> 古い状態を消さず、指定時点で有効な情報を選び、その根拠を示せるローカルMarkdown記憶

を完成させる。

## 2. Current State

2026-07-31に現在のリポジトリで確認した状態:

- `main`はv0.1.0の基礎メモアプリ（`cf24860`）
- 現在の`agent/tsuzune-mcp-integration`ブランチは、v0.2.0基準（`0c66af8`）へTemporal Memory Lite M0〜M4を加えた`4b35765`上でM5を完了した
- `4b35765`はprivate remoteへpush済みだが、まだ`main`へ統合していない
- Markdownが原本で、アプリ固有DBはない
- Vault走査結果は`NoteDocument[]`としてメモリ上で扱う
- Wikiリンク、バックリンク、文字列検索が純粋なcore処理として分離されている
- MCPは検索、取得、バックリンク、文脈構築、作成、改訂確認付き更新の6ツール
- `build_context`は起点、リンク先最大5件、バックリンク最大3件を文字数上限付きで構築する
- MCPからの削除、移動、名前変更、フォルダ作成、強制上書きは公開していない
- frontmatter、時間断面、知識時点、再確認期限、置き換え、出典警告を純粋coreで判定する
- Context Compilerは質問一致を1段リンクの上限適用前に順位付けする
- Context本文は参照データ境界で囲み、ノート内の命令文をシステム命令として扱わない方針を明示する
- MCPの`build_context`は任意の`as_of`と`include_history`を受け取り、時間判定、選定理由、警告を返す
- MCPの`build_context`は任意の`temporal_perspective`でvalid-timeとknowledge-timeを選べる
- 右パネルは現在、過去、未来、出来事、再確認期限超過、置き換え済みを読み取り専用で表示する
- 過去の`as_of`では、有効時点を持たない通常ノート本文を採用せず、内容省略と対象Pathを構造化して返す
- Starter Vault dogfoodの比較、誤判定、手作業負担、修正結果は`docs/m5-dogfood.md`に固定した
- v0.4では1-hopグラフ、Google Desktop OAuth、暗号化token store、`drive.file`限定Driveクライアント、削除非伝播の同期planner、main process、画面とpreload APIを接続済み
- 同期適用はDrive版の直前再確認、危険な相対パス拒否、Windows上の大文字小文字衝突拒否、stale plan拒否、競合コピーを含む
- v0.4の実Googleアカウント確認だけが、この時点では未完了

確認済みの基準:

```text
npm run typecheck    PASS
npm test             PASS: 10 files / 56 tests
npm run check:mcp    PASS: 4 read tools / 2 write tools
```

## 3. Product Rules

1. Markdownを唯一の原本として保つ。
2. 時間情報は任意とし、既存ノートへ追加を強制しない。
3. 時間情報が壊れていても、ノートの閲覧と編集を妨げない。
4. 古い情報を自動削除しない。
5. 「古い」と「誤り」を同じ意味にしない。
6. ファイル更新日時を、出来事の発生日時や事実の有効期間として扱わない。
7. AIが推測した日時を、本人確認済みの日時として保存しない。
8. v0.3では読み取り・判定・説明を優先し、新しい自動書き込みを増やさない。
9. Markdown本文をfrontmatterパーサーで再整形しない。
10. SQLite、ベクトル検索、グラフDB、常駐処理は導入しない。
11. Googleアカウント接続を導入しても、ログインなしのローカル利用を維持する。
12. Google認証、Googleデータ取り込み、Vault同期を別々の機能として設計する。
13. 外部履歴から推測した関心や好みを、本人確認済みプロフィールとして自動確定しない。

## 4. Success Conditions

次の3条件をすべて満たしたら、Temporal Memory Liteを完成とする。

1. プロジェクトの状態が変わっても、以前の状態、期間、変更理由、出典をMarkdownから確認できる。
2. Codexが「現在」と「指定日現在」の文脈を作り分け、採用したノートと理由を示せる。
3. 再確認期限を過ぎた情報を現在の事実として黙って扱わず、警告付きで提示できる。

## 5. Canonical Terms

### Normal Note

時間情報を持たない通常のMarkdownノート。これまでどおり検索、リンク、編集の対象になる。

### State Note

ある対象について、一定期間成立する状態を記録したノート。

例:

- プロジェクトが開発中
- 機能が凍結中
- 現在使っている技術構成

### Event Note

特定の時点で起きた出来事を記録したノート。

例:

- プロジェクトを再開した
- 設計方針を変更した
- 本人が以前の状態を訂正した

### Current

指定時点が`valid_from`以上で、`valid_to`より前にある状態。`valid_to`が空なら終了未確認として扱う。

### Historical

指定時点では有効期間外だが、過去の状態として保持されている情報。

### Review Due

`review_after`を過ぎている情報。誤りとは断定せず、現在も有効か再確認が必要と表示する。

### Superseded

別ノートの`supersedes`によって置き換えられた情報。削除せず、履歴として残す。

## 6. Minimal Markdown Contract

通常ノートはfrontmatterなしで利用できる。時間を扱いたいノートだけ、標準的なYAML frontmatterを付ける。

### State Note

```yaml
---
kind: state
subject: "[[10_プロジェクト/TSUZUNE]]"
status: active
valid_from: 2026-07-30
valid_to:
observed_at: 2026-07-30
verified_at: 2026-07-30
review_after: 2026-10-30
source: "[[40_情報源/会話-新しいソフト作成希望]]"
supersedes:
---
```

### Event Note

```yaml
---
kind: event
subject: "[[10_プロジェクト/TSUZUNE]]"
event: status_changed
occurred_at: 2026-07-30
observed_at: 2026-07-30
source: "[[40_情報源/会話-新しいソフト作成希望]]"
---
```

### Field Rules

| Field | State | Event | Rule |
|---|---:|---:|---|
| `kind` | required | required | `state`または`event` |
| `subject` | required | required | 対象ノートへのWikiリンク |
| `status` | required | - | 状態名。初版では自由文字列 |
| `event` | - | required | 出来事の種類。初版では自由文字列 |
| `valid_from` | required | - | 状態の開始日 |
| `valid_to` | optional | - | 状態の終了日。終了時点は含まない |
| `occurred_at` | - | required | 出来事が起きた日 |
| `observed_at` | optional | optional | TSUZUNEまたはAIが知った日 |
| `verified_at` | optional | - | 現在も正しいと最後に確認した日 |
| `review_after` | optional | - | 再確認を促す日 |
| `source` | recommended | recommended | 根拠ノートへのWikiリンク |
| `supersedes` | optional | optional | 置き換えるノートへのWikiリンク |

日時の初版ルール:

- 日単位は`YYYY-MM-DD`
- 時刻が必要な場合はタイムゾーン付きISO 8601
- 日付だけの値はローカル暦日として比較し、UTC変換で日付をずらさない
- `valid_from`は含み、`valid_to`は含まない
- 「昨日」「先週」などの相対表現はメタデータへ保存しない
- 日付精度が不明な情報は推測せず、本文へ不確実性を書く

## 7. Storage And History Policy

### Current Summary

既存のプロジェクトノートは、読みやすい現在概要やMap of Contentとして保つ。すべてのプロジェクトノートをState Noteへ変換しない。

### Durable History

履歴が必要な状態と出来事だけを、State NoteまたはEvent Noteとして独立したMarkdownへ残す。

- 古いState Noteを編集して現在状態へ変換しない
- 新しいState Noteを作り、必要なら`supersedes`で古いState Noteを参照する
- 状態変更の理由はEvent Noteとして残せる
- 保存場所はVault内であれば固定しない
- Starter Vaultでは`50_履歴`を推奨例として使うが、アプリの必須フォルダにはしない

初版では、状態変更時の複数ノート自動更新を実装しない。人またはCodexが明示的にState Note/Event Noteを作成し、読み取り側の有用性を先に検証する。

## 8. Behavior

### Open A Note

1. Markdown本文を通常どおり表示する。
2. frontmatterがあれば、時間情報を読み取り専用で解析する。
3. 右パネルへ次のいずれかを表示する。
   - 現在有効
   - 過去の状態
   - 未来開始
   - 再確認期限超過
   - 置き換え済み
   - メタデータ不完全
4. エラーがあっても本文編集は継続できる。

### Build Current Context

1. 起点、リンク先、バックリンクを従来どおり収集する。
2. 関係するState NoteとEvent Noteを追加候補にする。
3. 現在有効なState Noteを優先する。
4. 置き換え済みや過去状態は、通常の現在文脈では優先度を下げる。
5. 再確認期限超過は除外せず、警告を付ける。
6. 各ノートに選定理由と時間判定を付ける。

### Build Context As Of A Date

1. `as_of`を指定する。
2. その日付で有効なState Noteを選ぶ。
3. その日付までに発生したEvent Noteを選ぶ。
4. 現在の知識で過去を書き換えず、当時有効だった状態を示す。
5. 該当する時間情報がない場合は「不明」とし、推測で補完しない。
6. 有効時点を持たない通常ノート本文は過去の根拠に採用せず、内容省略と対象Pathを警告する。

### Malformed Metadata

- 日付、型、Wikiリンクが不正でもファイルを変更しない
- 解析できた本文とWikiリンクは従来どおり利用する
- 右パネルとMCP出力へ短い警告を付ける
- 不正値を自動修正しない

## 9. Architecture Plan

```text
Markdown files
      |
      v
VaultService scan
      |
      +--> existing links / backlinks / search
      |
      v
frontmatter parser
      |
      v
temporal resolver
  - current / historical
  - review due
  - superseded
  - as-of selection
      |
      +--> right-side Temporal section
      |
      +--> Context Compiler / MCP
```

Markdown本文は`NoteDocument.content`のまま保持する。時間情報は走査時または利用時に作る派生データであり、別の原本を作らない。

想定する主な追加箇所:

- `src/core/frontmatter.ts`: frontmatterを本文から非破壊で読み取る
- `src/core/temporal.ts`: 時点判定、鮮度、置き換え、対象別タイムライン
- `src/shared/types.ts`: 派生メタデータと判定結果の型
- `src/core/context.ts`: 時点指定と選定理由
- `src/mcp/service.ts`: 時点指定をcoreへ渡す
- `src/mcp/server.ts`: 後方互換な任意引数
- `src/renderer/components/TemporalDetails.tsx`: 右パネルの読み取り表示
- `tests/frontmatter.test.ts`
- `tests/temporal.test.ts`
- `tests/context.test.ts`
- `tests/mcp-service.test.ts`

新しい依存関係を追加する場合は、frontmatterを安全に読むための小さなYAMLパーサー1件までとする。パーサーがMarkdown全体を再出力する使い方はしない。

## 10. MCP Plan

既存6ツールは互換性を保つ。初版では新しい書き込みツールを追加しない。

`build_context`へ後方互換な任意入力を追加する。

```text
as_of?: ISO 8601 date or date-time
include_history?: boolean
```

出力には、既存情報を残したまま次を追加する。

```text
as_of
temporal_status
selection_reason
warnings
```

必要性が実運用で確認された場合だけ、読み取り専用の`get_timeline`を次の小版で検討する。`record_state_change`のような複数ファイル書き込みツールは、読み取り版のdogfoodが終わるまで追加しない。

## 11. Milestones

### M0. Freeze The v0.2 Baseline

Work:

- v0.2 MCP連携の受け入れ状態を確認する
- 現在のMCPブランチを、Temporal機能と混ぜる前に確定する
- 現行fixtureとテスト結果を基準として残す

Gate:

- 型検査、自動試験、MCP smoke check、ビルドが成功する
- 作業ツリーに意図不明な変更がない
- v0.2とTemporal機能の差分が分離されている

### M1. Contract And Fixtures

Work:

- 本文書のfrontmatter契約をテストfixtureへ落とす
- current、historical、future、review due、superseded、不正値を用意する
- 同じsubjectについて複数時点のState NoteとEvent Noteを用意する

Gate:

- 実装前に、期待する現在状態と過去時点状態をfixtureで説明できる
- 必須フィールドと対象外がテスト名から読み取れる

### M2. Pure Temporal Core

Work:

- 非破壊frontmatter parser
- 時点判定
- 再確認期限判定
- `supersedes`解決
- subject単位のタイムライン構築
- 不正メタデータの警告

Gate:

- Electron、React、MCPなしの単体テストで全判定が成功する
- frontmatterなしの既存ノートの結果が変わらない
- 読み取り処理がMarkdownを変更しない

### M3. Time-Aware Context Compiler

Work:

- `buildContextBundle`へ任意の`asOf`を追加する
- 現在文脈と過去時点文脈を作り分ける
- 選定理由、時間状態、警告を出力する
- 質問一致をリンク件数上限の適用前に順位付けする
- valid-timeとknowledge-timeを分離する
- 競合、再確認期限、出典不明、不正メタデータを黙って確定しない
- ノート本文を信頼しない参照データとして境界付けする
- 文字数と1段リンクの上限を維持する

Gate:

- 現在と過去で異なる正しいState Noteが選ばれる
- 再確認期限超過が警告付きで残る
- 未来情報が過去時点へ漏れない
- 当時未観測の情報がknowledge-timeへ漏れない
- 同じ入力と明示時刻から同じBundleが生成される
- 警告が増えても文字数上限を超えない
- 既存の`build_context`呼び出し結果との後方互換性を保つ

### M4. MCP And Inspector

Work:

- MCPの`build_context`へ任意の`as_of`と`include_history`を追加する
- 右パネルへ時間情報の読み取り表示を追加する
- メタデータ不完全時の短い説明を追加する
- キーボードとスクリーンリーダー向けの名前を既存パネルに合わせる

Gate:

- Codexから現在文脈と過去時点文脈を取得できる
- TSUZUNE画面で同じ時間判定を確認できる
- 不正メタデータがあっても編集、保存、リンク、検索が動く

### M5. Starter Vault Dogfood

Result: PASS（2026-07-31）

Work:

- Starter Vaultへ少数の時間付きサンプルを追加する
- 少なくとも2プロジェクト、2回の状態変化、1件の訂正を扱う
- 同じ固定質問を次の3条件で比較する
  - 起点ノートだけ
  - 従来の1段リンクContext
  - M3の時間対応Context
- 次の質問をCodexから実行する

```text
現在動いているプロジェクトは何か。
2026-07-22時点では何が動いていたか。
再確認が必要な情報は何か。
この状態を採用した根拠は何か。
```

Gate:

- 3つのSuccess Conditionsを満たす
- 時間対応Contextが固定質問の正答数と根拠一致率で従来Context以上になる
- 過去時点への未来情報漏洩が0件
- 根拠がない質問では推測せず「不明」または再確認を返す
- 競合状態を一方だけ確定せず、警告と両方の根拠を示す
- 手作業の負担と誤判定を記録する
- 観測されていない便利機能を追加しない

このA/Bは「モデル一般が賢くなった」と証明するものではない。TSUZUNEが、同じモデルへより正確で時点整合的な根拠を渡せるかを検証する。

実測結果、比較回答、dogfoodで発見した過去Contextの本文漏えいと修正、手作業負担は`docs/m5-dogfood.md`を正本とする。

## 12. Verification Baseline

各Milestoneの完了時に、関連テストに加えて次を実行する。

```powershell
npm run typecheck
npm test
npm run check:mcp
npm run build
git diff --check
```

追加で確認する不変条件:

- frontmatterなしの既存Vaultがそのまま開く
- Markdown本文のバイト内容を読み取り処理が変更しない
- malformed frontmatterで起動不能にならない
- 外部変更競合と改訂トークンの保護が維持される
- MCPからVault外へアクセスできない
- 文脈上限を超えて無制限に履歴を読み込まない

## 13. Risks And Controls

### Time Fields Become Busywork

Control:

- 全ノートへ必須化しない
- 最初は重要な状態変化だけに使う
- dogfoodで使われなかったフィールドは次版へ持ち越さない

### Freshness Is Mistaken For Truth

Control:

- `review_after`超過は警告だけにする
- 自動的に誤り、無効、削除とは判定しない

### Current Knowledge Rewrites The Past

Control:

- `as_of`判定を純粋関数とfixtureで固定する
- 当時のState Noteがなければ「不明」と返す

### State And Event Notes Diverge

Control:

- 初版は自動二重書き込みを作らない
- `source`と`subject`を表示し、人が追跡できる状態を優先する
- 自動記録はdogfood後に別計画で扱う

### History Floods The Context

Control:

- 現在文脈ではcurrentを優先する
- historyは明示指定時だけ増やす
- 既存の件数上限と文字数上限を維持する

### Temporal Work Pulls In A Database

Control:

- v0.3は既存のメモリ上走査で実装する
- 現行の500ノート、合計10MB基準で問題が観測されるまでSQLiteを追加しない

## 14. Explicit Non-Goals For Temporal Memory Lite (M0-M5)

次の項目はM0〜M5へ混ぜない。M5後に実際の必要性と独立した受け入れ条件がある場合だけ、別トラックで扱う。

- 主観時間のモデル化
- エントロピー生成や時間反転尤度の推定
- Neural CDEなどの学習型世界モデル
- 常時起動して毎秒状態を更新するサービス
- AIによる日時、状態、出典の無確認な自動抽出
- 古い記憶の自動削除
- ベクトル検索、GraphRAG、グラフDB
- グラフ表示
- クラウド同期
- プラグインAPI
- アカウント、共同編集、モバイル版
- 汎用データベースやNotion風プロパティ編集UI
- MCPからの削除、移動、名前変更、強制上書き

## 15. Immediate Next Work

M0〜M5は完了した。Temporal Memory Liteは3つのSuccess Conditionsを満たしたため、ここで機能追加を停止する。

次の独立トラックとしてv0.4 Google Drive Manual Sync + Local Graphを選択し、実装とローカル検証を完了した。残作業は次の順序に固定する。

1. TSUZUNE用Desktop OAuthクライアントIDを発行し、`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`を設定した配布ビルドを作る。
2. 組み込みIDから実アカウントでログインし、初回送信、別端末相当の受信、競合コピー、接続解除を手動確認する。
3. 複数端末から同期applyを同時実行せず、端末ごとにpreview/applyを完了してから次の端末で確認する。
4. 実Google確認後にv0.4の停止条件を判定し、Takeout、ChatGPT export、入力補助のいずれか1トラックだけを選ぶ。

ChatGPTアーカイブもGoogle Takeoutも未提供のまま、非公開履歴を推測取得したり、ログイン、Cookie、画面スクレイピングで代替したりしない。

## 16. Decision Rules After Dogfood

- 時間情報の入力が負担なら、先にテンプレートまたは小さな入力補助を検討する。
- 過去時点の検索が役立たなければ、データモデルを拡張しない。
- 履歴が多すぎる場合は、DBより先に検索範囲と表示方法を見直す。
- 自動状態記録が必要になった場合は、書き込み整合性を別PLANで定義する。
- v0.4グラフは1-hopに留め、Vault全体グラフやGraphRAGが必要かはdogfood後に別判断する。
- v0.4同期は明示preview/applyに留め、バックグラウンド同期、削除伝播、Drive Changes APIはdogfood後に別判断する。
- プラグインAPIとSQLiteは、それぞれ独立した困りごとと受け入れ条件が確認された後に別々に計画する。

## 17. Active Track: v0.4 Google Sign-In, Manual Drive Sync, Local Graph

このトラックはM5完了後の独立トラックである。Google接続を使わないローカルMarkdown運用を標準のまま維持し、認証、同期、パーソナライズ用データ取り込みを混同しない。

### v0.4 Scope

1. 選択中のノートと直接つながるノートだけを示す1-hopグラフ
2. Google Desktop OAuthによる任意のアカウント接続
3. TSUZUNE管理下のMarkdownだけを対象にした、preview/apply式の手動Drive同期

ローカルMarkdownが唯一の原本である。同期ledgerとGoogle接続情報はアプリのuser dataへ置き、Vault本文へアプリ固有の同期メタデータを書き込まない。

### V4-1. Selected-Note 1-Hop Graph

Work:

- 現在選択しているノートを中心にする
- 直接のリンク先とバックリンクだけをノードにする
- ノード操作で既存のノートを開く
- 未保存の編集中Wikiリンクを表示へ反映する
- Markdownと既存Wikiリンクresolverから都度構築し、グラフDBや新しい永続索引を持たない

Gate:

- 選択ノート、リンク先、バックリンクの1段階だけを表示する
- 孤立ノートでも空状態として破綻しない
- マウスとキーボードの両方でノートを開ける
- ノートを開き直すと、そのノートを中心に再構築する
- Vault全体の力学グラフ、GraphRAG、編集可能なグラフへ拡張しない

### V4-2. Optional Google Desktop OAuth

Work:

- Google Cloudで作成したOAuthクライアントの種類をDesktop appに限定する
- 配布ビルドには公開値であるDesktop OAuthクライアントIDだけを組み込み、通常UIから直接接続する
- 独自OAuth JSONは詳細設定から任意選択でき、保存済みJSONを組み込みIDより優先する
- client secret、token、アカウント情報は配布物へ組み込まない
- システムブラウザ、`127.0.0.1`のランダムloopback port、PKCE S256、state照合を使う
- scopeは`openid email profile https://www.googleapis.com/auth/drive.file`だけにする
- 名前、メールアドレスなどの基本プロフィールだけをアカウント表示に使う
- 更新トークンはElectron `safeStorage`を通してWindowsの暗号化機構へ保存し、アクセストークンは永続保存しない
- 接続解除でローカルの更新トークンを削除し、Drive上のファイルとローカルVaultは残す

Gate:

- Google未設定、未ログイン、オフライン、認証失敗でもローカル編集とMCPが動く
- OAuth callbackのstate不一致とprovider errorを拒否する
- OAuth JSON、token、認可codeをVault、Markdown、Git、通常ログへ書かない。公開クライアントIDだけをmain bundleへ含める
- `drive`、`drive.readonly`などの広いDrive scopeを要求しない
- Googleログインだけで検索履歴や広告プロファイルを取得したと表示しない

### Google Cloud Setup Contract

1. Google Cloudプロジェクトを作成または選択する。
2. Google Drive APIを有効にする。
3. OAuth同意画面を構成する。ExternalのTestingを使う場合は利用者自身をtest userへ追加する。
4. OAuth client IDを「Desktop app」として作成する。
5. クライアントIDだけを`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`へ設定して配布ビルドを作る。
6. TSUZUNEの「Google / 同期」から「Googleでログイン」を押し、システムブラウザでscopeを確認する。

独自のGoogle Cloudプロジェクトを使う場合だけ、詳細設定からDesktop OAuth JSONを選択する。このoverrideを保存した端末では組み込みIDへ暗黙フォールバックせず、異なるクライアントの更新トークンを混用しない。

ExternalかつTestingのOAuth同意画面では、Googleの仕様によりrefresh tokenは原則7日で失効する。安定運用では公開要件を確認し、Publishing statusをIn productionへ移す。TSUZUNEは期限切れtokenを回避するためにCookie、ブラウザprofile、別scopeを流用しない。

公式仕様:

- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://www.electronjs.org/docs/latest/api/safe-storage

### V4-3. Manual Drive Sync

Work:

- `drive.file`でTSUZUNEが作成・管理する専用VaultフォルダとMarkdownだけを扱う
- ローカルとDriveの内容ハッシュ、前回同期ハッシュ、Drive file IDを比較する
- 最初に送信・受信・競合・保持のpreviewを表示し、利用者がapplyした場合だけ変更する
- 片側だけに新規ノートがある場合は、存在する側から存在しない側へコピーする
- 前回同期済みノートが片側で欠落した場合は、削除を伝播せず、残っている側を保持する
- 両側で変更された場合は無言のlast-write-winsを行わず、Drive版をローカルの別ノートとして保存する
- 同期中もローカル原本を上書きする前に版を再確認し、stale previewを拒否する
- 各同期操作が成功するたびにledgerをチェックポイントし、後続操作の失敗後も成功済み状態を保持する
- 別端末ではDrive上の既存TSUZUNE Vaultを列挙し、空で未同期のローカルVaultへ明示ペアリングする
- Drive上のTSUZUNEファイルを削除するAPIは実装しない

Gate:

- 新規送信、新規受信、ローカル変更、Drive変更、両側変更、片側欠落、変更なしをfixtureで再現できる
- previewとapplyの間に内容が変わった場合、古いplanを適用しない
- 競合時にローカル原本、Drive原本、ローカル競合コピーの三者を失わない
- 通信中断または認証切れで既存Markdownを失わない
- 複数操作の途中失敗後に成功済みノートを編集しても、不要な両側競合として扱わない
- 同期済みローカルVaultを別のDrive Vaultへ付け替えない
- `.trash`、ドットフォルダ、シンボリックリンク、OAuth JSON、token、同期ledgerをアップロードしない
- Drive全体を走査せず、他アプリが作成したファイルを取得しない

### V4-4. Verification Boundary

自動テストでは次をモックまたはローカルfixtureで確認する。

- OAuth URL、PKCE、callback、token exchange、refresh
- 暗号化token store
- Drive APIのlist、folder作成、download、create、update
- 同期plannerと同期適用
- 1-hopグラフと操作UI
- v0.1〜v0.3、MCP、Temporal Memory Liteの回帰

実Google確認には発行済みのTSUZUNE用Desktop OAuthクライアントIDを組み込んだ配布ビルドが必要である。次を実アカウントで完了するまで「Google Drive同期の実運用確認済み」としない。

1. Google認証と基本プロフィール表示
2. 初回preview/applyとDrive専用フォルダ作成
3. ローカル変更の送信とDrive変更の受信
4. 両側変更時のローカル競合コピー
5. 片側欠落時の削除非伝播
6. アプリ再起動後のtoken refresh
7. 接続解除後のローカルVault継続利用
8. 別端末相当の空Vaultから既存Drive Vaultを選択し、ノートを受信
9. preview後にDrive側を変更し、古い版の更新を拒否して両内容を保持

### Personalization Data Boundary After v0.4

Googleログインで得る基本プロフィールは、本人の関心、好み、検索行動を増やす材料にはならない。パーソナライズ情報を増やす別トラックでは、利用者が明示選択したGoogle Takeoutをローカルで取り込み、原本、抽出候補、本人確認済みノートを分離する。

- Google内部の完全な広告ターゲティングモデル、関心スコア、推定根拠、予測ロジックを取得できる一般公開APIはない
- Google検索履歴はOAuth基本プロフィールや`drive.file`では取得できない
- 検索履歴を扱う場合は、利用者が提供したTakeoutの「マイ アクティビティ」を第一経路にする
- 検索1回を恒久的な好みとして確定しない
- 候補には根拠レコード、期間、件数、最終観測日を付け、本人確認後だけ通常ノートへ反映する
- My Ad CenterやMy Activityの画面スクレイピング、Cookie流用、Drive全体取得を代替手段にしない

Takeout importer、Google Data Portability API、パーソナライズ候補生成はv0.4へ含めない。

### Explicit Non-Goals For v0.4

- Googleアカウント必須化
- Google内部の広告プロファイル取得
- Google検索履歴、Gmail、Google Photos、位置履歴の取得
- `drive`または`drive.readonly`によるDrive全体取得
- Google Docsの自動取り込み
- バックグラウンド常駐同期、webhook、Drive Changes API
- 削除伝播、Driveファイル削除、無言のlast-write-wins
- Vault全体グラフ、GraphRAG、グラフDB
- プラグインAPI、SQLite、独自クラウド
- 複数人共有、モバイル同期
- ログイン情報からの自動プロフィール確定

## 18. Future Track: ChatGPT Export Intake

このトラックはM5完了後に着手する。Google連携やChatGPTへのログインとは分離し、ユーザーが明示的に選択したChatGPTデータエクスポートだけをローカルで取り込む。

### Current Intake Status

2026-07-31時点では、ローカルにChatGPT公式データエクスポートのZIP、`conversations.json`、`chat.html`は見つかっていない。現在参照できた会話はStarter Vaultへ出典付きで選択保存したが、全アーカイブ取込とは扱わない。

次の開始条件は、ユーザーが公式エクスポートZIPまたは展開済みフォルダを提供することである。製品内の自動インポーターはM5完了後の別トラックだが、Codexによる一回限りの原本保持型整理はアーカイブ受領後に実行できる。

### Confirmed Availability Boundary

2026-07-31時点のOpenAI公式仕様を基準に、次を前提とする。

- 対象アカウントではChatGPTの設定またはPrivacy Portalからデータエクスポートを要求できる。
- ダウンロードZIPにはチャット履歴と関連アカウントデータが含まれる。
- エクスポートによっては`conversations.json`、番号付き会話JSON、会話で使用したファイルや資産が含まれる。
- TSUZUNEはエクスポートの要求、生成、メール受信、ダウンロードを代行しない。
- ユーザーがアーカイブを提供していない場合、TSUZUNEは非公開会話を取り込めない。
- ChatGPTへのGoogleログイン、OpenAI API key、ブラウザCookieから会話履歴を取得できるとは扱わない。
- 公式エクスポート形式は変更され得るため、実装時にfixtureと公式仕様を再確認する。

公式仕様:

- https://help.openai.com/en/articles/7260999
- https://help.openai.com/en/articles/20001279

### C0. Archive Contract And Source Preservation

Work:

- ユーザーが選択したZIPまたは展開済みエクスポートだけを対象にする
- `conversations.json`、番号付き会話JSON、参照される添付資産を検出する
- 会話ID、メッセージID、role、元時刻、添付参照を保持する
- 原本JSONと添付資産を変更せず、source manifestへハッシュ、import日時、対応状況を記録する
- 原本保存領域と派生候補ノートの保存領域を分ける
- 未対応ファイルは推測して解析せず、原本として保存して警告する
- 同じ会話とメッセージを再取り込みしても重複しない識別方法をfixtureで固定する

Suggested separation:

```text
ChatGPT export source
  - original conversation JSON
  - numbered conversation JSON
  - original attachments
  - import manifest and hashes

Derived TSUZUNE notes
  - conversation source notes
  - extraction candidates
  - user-approved notes
```

Gate:

- アーカイブ未選択時は取込不可を説明し、Vaultを変更しない
- 原本JSONと添付資産のバイト内容を変更しない
- 会話、メッセージ、添付、派生ノートの出典関係を追跡できる
- 同じアーカイブを再取り込みしても原本と候補を重複作成しない
- malformed JSONまたは欠落添付があっても既存ノートを変更しない
- 派生候補の却下や削除が原本と添付を変更しない

### C1. Provenance-Backed Candidate Notes

Work:

- 会話をそのまま現在プロフィールへ変換せず、出典付き候補ノートを作る
- user、assistant、tool、systemなどのroleを失わない
- ユーザー発言も引用、仮定、創作、過去情報を含み得るため、無確認で現在事実へ確定しない
- ChatGPT回答はモデル出力として保持し、本人確認済み事実または一次証拠として扱わない
- 各候補へ会話ID、メッセージID、role、元時刻、source manifestを付ける
- 複数会話から導出した候補には、使用した全出典を付ける
- 本人確認後だけ通常ノート、State Note、Event Noteへ反映する
- 初版の抽出はローカル処理と明示ルールに限定し、原本を外部AIへ自動送信しない

Gate:

- すべての候補から元の会話メッセージへ戻れる
- ChatGPT回答だけを根拠に本人の好み、事実、決定を確定しない
- user発言とassistant回答を混同しない
- 現在情報、過去情報、未確認候補を区別できる
- 候補の承認、却下、訂正が原本を変更しない
- 原本と出典がない候補をactiveな記憶へ昇格させない
- Google Takeout候補とChatGPT候補を同じ出典種別として混同しない

### Explicit Non-Goals For The First ChatGPT Export Track

- ChatGPTアカウントへのログイン実装
- ChatGPTセッションCookieや画面スクレイピングによる取得
- OpenAI APIから過去のChatGPT会話を取得すること
- アーカイブ未提供時の会話復元
- ChatGPT Memoryのライブ取得または同期
- エクスポートをChatGPTのサイドバーへ再構築すること
- ChatGPT回答を本人確認済み事実として自動登録すること
- ユーザー発言をすべて現在も有効な事実として扱うこと
- 原本JSONや添付資産の再整形、上書き、削除
- 原本アーカイブの外部AIへの自動送信
- 初版で全アカウントデータ形式へ対応すること
- Google連携、Drive同期、ChatGPT取り込みを一つの認証機能へ統合すること
