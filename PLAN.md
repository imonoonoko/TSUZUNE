# TSUZUNE Near-Term Plan

## Temporal Memory Lite

作成日: 2026-07-30
状態: 完了（M0〜M5）
対象: v0.2のCodex・ChatGPTデスクトップ連携を基礎にしたv0.3開発

この文書は、TSUZUNEの長期的な機能一覧ではなく、次に実装する順序と停止条件を決めるための計画である。`docs/v0.1-scope.md`を置き換えず、グラフ、同期、プラグイン、独自DBまで一度に扱わない。

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

次に着手するときは、次のいずれか1トラックだけを選び、独立した困りごと、入力資料、受け入れ条件を別PLANへ固定する。

1. ChatGPT公式エクスポートが提供された場合は、C0 Archive Contract And Source Preservation。
2. Google Takeoutが提供された場合は、G0 Contract And Privacy Boundary。
3. 時間情報の手入力負担を先に解消する場合は、小さなState/Event入力補助。
4. グラフ、同期、プラグイン、SQLiteは、それぞれ必要性を示すdogfood証拠が得られた場合だけ独立して計画する。

ChatGPTアーカイブもGoogle Takeoutも未提供のまま、非公開履歴を推測取得したり、ログイン、Cookie、画面スクレイピングで代替したりしない。

## 16. Decision Rules After Dogfood

- 時間情報の入力が負担なら、先にテンプレートまたは小さな入力補助を検討する。
- 過去時点の検索が役立たなければ、データモデルを拡張しない。
- 履歴が多すぎる場合は、DBより先に検索範囲と表示方法を見直す。
- 自動状態記録が必要になった場合は、書き込み整合性を別PLANで定義する。
- グラフ、同期、プラグイン、SQLiteは、それぞれ独立した困りごとと受け入れ条件が確認された後に別々に計画する。

## 17. Future Track: Google Data Intake And Optional Sync

このトラックはM5完了後に着手する。Temporal Memory Liteへ割り込ませず、Googleアカウントを使わない既存のローカル運用を標準のまま維持する。

Google連携は次の3機能を混同しない。

1. Googleログインによる本人識別
2. 本人が許可したGoogleデータのコピー取り込み
3. TSUZUNE VaultのGoogle Driveバックアップまたは同期

### Confirmed Availability Boundary

2026-07-31時点のGoogle公式仕様を基準に、次を前提とする。

- Google検索履歴は、Google Takeoutの「マイ アクティビティ」からJSONまたはHTMLのコピーとして取り込める。
- Google Data Portability APIには`myactivity.search`と`myactivity.myadcenter`がある。
- 日本はData Portability APIの提供地域に含まれていないため、日本の個人アカウントではTakeoutの手動インポートを第一経路にする。
- `myactivity.myadcenter`が提供するのは、広告を増減した、ブロックした、評価したなどのMy Ad Center操作履歴である。
- Google内部の完全な広告ターゲティングモデル、関心スコア、推定根拠、予測ロジックを取得できる一般公開APIはない。
- 検索履歴はActivity Controls、削除操作、自動削除期間によって欠落し得るため、完全な行動履歴とは表示しない。
- My Ad Center画面のスクレイピングやCookie流用を代替手段にしない。
- 実装着手時には提供地域、OAuth scope、審査要件を公式資料で再確認する。

公式仕様:

- https://support.google.com/accounts/answer/3024190
- https://support.google.com/accounts/answer/14452558?hl=ja
- https://developers.google.com/data-portability/schema-reference/my_activity

### G0. Contract And Privacy Boundary

Work:

- 対応するTakeoutファイル、必須フィールド、文字コード、最大入力サイズをfixtureで固定する
- 原本、抽出候補、本人確認済みプロフィールを別レイヤーにする
- インポート前プレビュー、対象期間、対象サービス、保存先を定義する
- Googleログインなし、ネットワークなしでも既存Vaultが完全に動くことを不変条件にする

Gate:

- どのデータを読み、どのノートを作るかをインポート前に説明できる
- 取り込まないデータと削除方法を説明できる
- Googleの内部広告プロファイルを完全取得できると表示しない
- 健康、宗教、政治、性的指向などのセンシティブ属性を履歴から自動推定しない

### G1. Local Takeout Import

Work:

- ユーザーが選択したTakeoutアーカイブだけをローカルで解析する
- 最初はGoogle検索履歴とMy Ad Center操作履歴だけを対象にする
- 元レコードの時刻、サービス、タイトル、URL、取り込み日時を出典として保持する
- 重複を安定した識別子または内容ハッシュで検出する
- 作成予定ノートと除外予定レコードを確認してから書き込む

Suggested flow:

```text
Google Takeout archive
        |
        v
local parser
        |
        +--> immutable source records
        |
        v
interest / habit candidates
        |
        v
user review
        |
        v
approved Markdown notes
```

Gate:

- 同じアーカイブを再取り込みしても同じ原本ノートを重複作成しない
- malformedレコードがあっても既存Vaultを変更しない
- 抽出した関心へ出典と対象期間を付ける
- 検索1回を恒久的な好みとして確定しない
- 原本と候補を削除しても既存の通常ノートへ影響しない

### G2. Optional Google Sign-In And Manual Drive Backup

Work:

- システムブラウザを使うOAuth 2.0 / OpenID ConnectとPKCEを採用する
- ログインはDrive接続時だけ要求し、アプリ起動条件にしない
- 最初のDrive機能は明示操作によるバックアップと復元だけにする
- 必要最小限の`openid email profile`と`drive.file`を基本候補にする
- 初版では`drive`や`drive.readonly`などの広いDrive権限を要求しない
- 更新トークンをVault、Markdown、ログ、Gitへ保存せず、Windowsの資格情報保護へ保存する
- ログアウト、権限取消、ローカルデータ維持を実装する

Gate:

- 未ログイン、オフライン、認証失敗時もローカル編集が動く
- バックアップ前に対象、容量、宛先、暗号化状態を確認できる
- 復元前に現在Vaultの退避コピーを作る
- Google接続解除後もローカルVaultを読める

### Data Portability API Reconsideration Gate

日本向けData Portability API連携は、次をすべて満たすまで実装しない。

- Google公式の提供地域一覧に日本が含まれる
- 対象resource groupと出力schemaを再確認できる
- sensitiveまたはrestricted scopeの審査とセキュリティ要件を満たせる
- 手動Takeout取り込みより明確な実利用上の利点が確認される

### G3. Bidirectional Drive Sync

手動バックアップのdogfoodで必要性が確認された場合だけ着手する。

Work:

- ファイルハッシュ、同期世代、削除記録、Drive変更トークンを持つ
- 同時編集では無言のlast-write-winsを行わず、両方を競合コピーとして残す
- 同期前スナップショットと復旧経路を用意する
- 常駐同期ではなく、起動時と明示操作を初期方式にする

Gate:

- ローカルのみ変更、Driveのみ変更、同時変更、削除競合をfixtureで再現できる
- 通信中断や認証切れでMarkdownを失わない
- 同じ同期操作を再実行しても内容が壊れない
- 同期対象外フォルダと秘密情報をアップロードしない

### G4. Local Personalization Candidates

Takeout原本からTSUZUNE独自のパーソナライズ候補を作る。Googleの広告プロファイルを複製したものとは呼ばない。

候補例:

- 継続的に調べている分野
- 一時的なプロジェクト調査
- 繰り返し参照する製品、人物、場所
- 時間とともに増減した関心

Rules:

- 候補には根拠レコード、期間、件数、最終観測日を付ける
- 一時的な調査と長期的な好みを区別する
- AIの推測は候補止まりにし、承認前は通常プロフィールへ混ぜない
- 検索語、URL、位置、広告操作履歴を外部AIへ自動送信しない
- 原本を要約で上書きせず、解釈だけを版管理する

Gate:

- 候補から根拠レコードへ戻れる
- 誤った候補を却下または訂正できる
- 新しい履歴で関心が変わっても古い解釈を履歴として確認できる
- Googleデータなしのユーザー体験を劣化させない

### Explicit Non-Goals For The First Google Track

- Googleアカウント必須化
- Google内部の完全な広告プロファイル取得
- 検索履歴を完全な行動記録として扱うこと
- My Ad CenterやMy Activityの画面スクレイピング
- Gmail本文、Google Photos、位置履歴の初版取り込み
- バックグラウンドでの無確認な常時収集
- 取り込み直後の自動プロフィール確定
- 外部AIへの原履歴の自動送信
- 独自クラウド、複数人共有、モバイル同期

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
