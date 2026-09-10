---
title: TSUZUNE Bases 最小slice設計
created: 2026-09-08
updated: 2026-09-08
status: source-implemented
lane: Planned
scope: project:tsuzune
owner: CEO-01
---

# TSUZUNE Bases 最小slice設計

2026-09-09の追加slice: 利用者の「設計開始」と続く「開始」により、A6の候補一覧から開く操作を[chooser-design.md](chooser-design.md)で設計し、source実装・検証した。[実装・受入](implementation.md)が変更・検証境界を所有し、本番反映と最終同期は対応receipt・Vault実施記録で確認する。以下のdiscovery対象外／Held／Researchは最初のtable sliceの境界であり、今回選択された候補一覧部分には新設計を適用する。formula・他view・編集等の扱いは変えない。現在の実行状態は[PLAN.md Current Decision](../../../PLAN.md#current-decision)を参照する。

## 1. 目的と判断

利用者が明示選択したObsidian Basesの最小読み取り専用表ビューを、TSUZUNEのMarkdown正本と既存のProperties境界を保って実装する。

判断:

- Basesは独自データベースではなく、MarkdownのPropertiesとファイル属性を表へ投影する機能として扱う。
- 対象versionはObsidian 1.13.4の.base syntaxに固定する。最新版追従や全互換を完了条件にしない。
- 最初のsliceは、1つの.baseと1つのtable viewを読み取り、既存snapshotから行を作るところまでとする。
- .md、.base、設定、履歴、Registryはこのsliceから書き換えない。
- readBase、固定profile parser、純粋 evaluator、read-only table UI、workspace接続はsource実装済み。本番反映は対応するproduction receiptと隔離installed受入で判定する。
- 生のfilter式をJavaScriptとして実行しない。固定profileの構文だけを専用parserで解釈し、eval、Function、任意のplugin関数は使わない。

## 1.1 設計開始時点の採用決定

2026-09-08に呼出し経路と永続境界を固定し、利用者の「開始」によりtable sliceを実装へ移した。明示的な機能選択を再開条件とし、7日観測へ戻さない。

### 呼出し経路

1. command paletteまたは将来の同じ入口から、利用者がVault相対の`.base`パスを明示する。
2. rendererは`window.tsuzune.readBase(path)`を呼び、既存のread-only IPCでbytesと`modifiedAt`を受け取る。
3. `parseBaseProfile(content)`で固定profileだけを検証する。失敗時は行を作らず、diagnosticをそのまま表へ渡す。
4. 既存の`searchNotes`（通常探索からuserIgnoreFiltersを除いた集合）をBases入力に再利用する。settings読込完了後だけ評価し、`vault: snapshot`の契約を変更しない。
5. `evaluateBase(profile, baseNotes)`をrendererから呼ぶ。評価結果はメモリ上の表示状態だけに置き、IPC、Markdown、workspace保存へ書き戻さない。
6. `BaseTableView`は評価結果を読み取り専用で表示し、`file.name`／行pathの操作だけ既存の`openNote`へ渡す。

### 永続・復元契約

- workspace tabへ`{ kind: 'base', path: string }`を追加し、`.base`の相対pathだけを保存する。view名、query結果、row、診断、snapshotは保存しない。
- 保存時はworkspaceの既存のdebounced checkpointを再利用する。新しい保存API、DB、cacheは追加しない。
- 復元時は`.base`タブをpathで再生成し、active tabなら`readBase → parse → evaluate`を再実行する。missingでもタブとpathを保持し、タブ内で診断と再読込を表示する。通常workspaceのmissing通知・checkpoint抑制には加えない。
- `.base`が存在するがmalformed／unsupportedの場合はタブを残し、表の代わりにdiagnosticと再読込操作を表示する。修正後のbytesを再読込すればよい。
- parserで選択したviewは固定profileの単一table viewとし、workspaceにview identifierを持たせない。将来複数viewを採る時に別versionの保存形式を設計する。

### UIと競合境界

- 入力は既存command paletteから`Baseを開く`を選び、Vault相対pathを入力する最小ダイアログとする。`.base`一覧の自動探索・候補キャッシュは作らない。
- 表はHTMLの`table`、`caption`、`thead`、`tbody`を使い、セル編集・一括適用・削除・移動・renameの入口を持たせない。既存のProperties一覧と同じく、ノート遷移だけを許可する。
- `readBase`の前後mtime/size保護に加え、renderer側ではvault generationとpathが現在値と一致する場合だけ結果をcommitする。古い非同期結果は破棄する。
- malformed／unsupported／missingは色だけで示さず、見出し、本文、`role="status"`または`role="alert"`で理由を読めるようにする。

### 実装ファイルの責務

- `src/shared/workspace-state.ts`: `base` tabの保存形式と相対`.base` path検証。
- `src/renderer/components/WorkspaceTabBar.tsx`: Base tabのラベル。
- `src/renderer/App.tsx`: explicit open、可視snapshot作成、async load、restore、note遷移、診断状態。
- `src/renderer/components/BaseTableView.tsx`: 読み取り専用表と診断表示。既存の`base-evaluator`と`BaseProfile`を直接再利用する。
- `src/renderer/styles.css`: 表示に必要な最小CSSだけを追加する。
- `tests/workspace-state.test.ts`、`tests/app.safety.test.tsx`: serialization、diagnostic、行遷移、書込み経路なし、settings／snapshot世代とclose-reopen競合を検証する。

この順序では、`.base`をVault全件から走査する責務、table以外のview、formula、編集、結果の永続化を追加しない。自動探索が必要になった時だけ、現在の明示path入力を置き換える小さな設計変更として再評価する。

## 2. 成果物と範囲

### 対象

- 既存のVault snapshotに含まれるMarkdownノート。
- ノートから既に取得できるpath、file.name、file.folder、file.ext等のファイル属性。
- 既存のfrontmatter解析境界で安全に読めるscalar Properties。
- 利用者が明示的に選んだ1つの.baseと、その中の1つのtable view。
- 既存workspace内の読み取り専用表タブ。

### 対象外

- app-owned database、cache、daemon、Hook、外部packageの追加。
- .baseの新規作成、編集、埋め込み、保存、別形式への変換。
- Markdown本文またはfrontmatterの編集、Property型の変更、複数ノート更新。
- cards、list、map、kanban、group、summary、CSV出力、clipboard操作。
- formula evaluator、plugin view、CLI、community plugin runtime。
- 全Vaultのraw file scan、attachmentsの行化、保護された50_履歴の参照。
- Obsidianの全型・全演算子・round-trip互換。

## 3. 入力とデータ境界

### 3.1 Snapshot

v0.1は、Appの通常探索で使うノート集合を入力にする。現行実装では、vault:snapshotのnotesから50_履歴を除いたnormalDiscoveryNotesがこの集合にあたる。Basesへ渡すsnapshotは、ObsidianのBasesと同じくuserIgnoreFilters適用後の可視ノートを呼出し側で作る。結果には scope: normal-discovery-snapshot を付け、Vault全件と名乗らない。

- userIgnoreFiltersは、通常設定UIで保存し再起動した後も`.obsidian/app.json`へ残り、Obsidian 1.13.4 Basesの行から除外対象を消すことを隔離fixtureで確認した。`app.vault.getMarkdownFiles()`自体は変わらないため、TSUZUNEではBasesへ渡すsnapshotだけに適用する。
- attachments、.base自身、directoryは行にしない。
- 本文を再解析して別の知識索引を作らない。既存snapshotにないファイルをBases専用に発見しない。
- noteの行IDは正規化済みpathとし、pathが衝突する場合はfail-closedする。

### 3.2 .base

- YAMLとして読み取る。
- `VaultService.readBase`、`vault:readBase` IPC、preload APIで`.base`を読み取る。MarkdownのreadNoteを流用せず、相対path・拡張子・symlink境界を検証するread-only経路とし、任意ファイルread APIには広げない。
- v0.1はfile.ext == "md"を含むBaseだけを受け付ける。Basesの既定はVault内の全fileでattachmentも行になり得るため、この条件なしのBaseは未対応として停止する。
- 未知のkeyや未対応viewを削除せず、読み取り結果でunsupportedとして示す。
- malformed YAML、型が違うkey、必須情報の欠落は表を部分表示せず、設定エラーとして停止する。
- .baseは明示path入力で選択する。workspace復元は保存済みpathを再読込し、自動全件走査や候補キャッシュは行わない。
- readBaseの結果にはpath、content、modifiedAtを含め、評価中にmtimeが変わった場合は結果を破棄して再読込を促す。

.baseはfrontmatter parserで代用できない。現行parserはMarkdownのtop-level scalar Properties向けで、Basesのnested YAML、view-level filters、quoted expressionを完全には読めない。Step 1ではnote Propertiesのscalar読取だけ既存parserへ委譲し、.baseは固定profile専用のparserを別に設計する。依存追加の要否はfixtureを読める最小実装を比較してから決める。

### 3.3 Properties

初期実装は、既存frontmatter parserが安全に返せるscalar値だけを使う。

- text、number、checkboxの比較を型ごとに行う。
- list、nested object、flow mapping、alias、anchorは自動変換しない。listは列ではunsupportedのまま、公式の`property.contains(value)` filterだけtyped atomへ照合する。
- `file.mtime`／`file.ctime`はObsidian側のdate value wrapperをUnix millisecond numberへ正規化して比較する。固定profileでは`date("YYYY-MM-DD HH:mm:ss")`のリテラルを受け付け、動的なdate arithmeticは対象外とする。
- missing property、null、空値は空欄として表示し、scalar equality filterには一致させない。
- textの"1"とnumberの1は同値にしない。混在値を一つの型へ寄せない。
- unsupported／malformedのPropertyは列に出せても、filter条件には使わない。frontmatterがmalformedなノートも行自体は隠さず、該当Propertyを診断付きの空欄として扱う。

ファイル属性の対応を先に固定する。

- Obsidian 1.13.4のMarkdownではfile.nameとfile.basenameは拡張子を除くbasenameを返す。拡張子込みの名前はfile.fullnameだが、固定profileではまだ対応しない。現在のNoteDocument.nameは後者なので、file.name／file.basenameへ直接流用できる。
- file.pathは正規化済みpath、file.folderはdirname、file.extはmd、file.sizeはsize、file.mtimeはmodifiedAt、file.ctimeはcreatedAtを使う。値がない属性はmissingとする。Obsidian 1.13.4で`file.mtime > date(...)`、`number(file.mtime) > number(date(...))`、`file.mtime.date() > date(...)`のincluded IDsが一致したため、このnumber正規化を固定する。

## 4. 固定するsyntax profile

Obsidian 1.13.4で確認した構造のうち、次だけを初期profileとする。

    filters:
      and:
        - file.inFolder("10_プロジェクト")
        - file.ext == "md"
        - status == "active"
    views:
      - type: table
        name: Active projects
        order:
          - file.name
          - status
          - updated
        sort:
          - property: updated
            direction: DESC

上記は形の例であり、実装時にはObsidian 1.13.4の実fixtureで正確なkey名・演算子・値型を確定する。

許可する意味:

- viewは選択済みのtableを1つ。複数view、table以外、暗黙に先頭viewを選ぶ動作は未対応として停止する。
- filter atomはfile.inFolder、file.ext、scalar Propertyの比較。
- global filtersと選択viewのfiltersは、公式挙動に合わせて入力順のandへ連結する。filter結合はandだけとし、短絡評価する。
- 列は.baseの指定順。初期受入ではfile.nameと2つまでのscalar Propertyを使う。
- sortは1つの列、昇順または降順。値が欠ける行の位置はObsidian 1.13.4とfixtureで合わせる。
- sortが2件以上、limit、groupBy、summaries、propertiesの表示変換を含むviewはunsupportedとして停止する。

初期profileにないor、not、複数group、formula、summary、view追加は解析結果にunsupportedを残し、黙って無視しない。

## 5. 評価パイプライン

実装時の処理は、既存snapshotを受ける純粋な段階へ分ける。

1. .baseを読み、version profileに従って構文を検証する。
2. snapshotの各Markdownノートから固定したファイル属性と安全に読めるPropertyを作る。
3. globalとviewのand filterを順に評価する。比較できない値はfalseとし、暗黙の文字列化・数値化をしない。
4. 許可された列だけを入力順に投影する。
5. 指定されたsortを型付きで適用する。同値の行は元のpath順で決定的にする。
6. 表と診断を返す。診断には、対象件数、除外件数、未対応key、解析停止理由を含める。

この段階でファイル書込み、履歴生成、revision更新、workspace状態へのquery結果保存は行わない。

## 6. UI契約

既存workspaceへbase-tableのsingleton tab kindを追加する場合の表示契約を先に固定する。

- 同一pathのBase tabは1つ。タブ名はBase名、表の見出しはview名を表示する。
- 上部にBase path、view、対象scope、行数、診断を表示する。
- 表のセルはすべて読み取り専用。行またはfile.nameから既存ノートタブを開ける。
- unsupported、malformed、空値は色だけで表現せず、状態名とARIAで伝える。
- .baseの再読込は明示操作にし、入力が変わったときだけ既存snapshotを再利用して再評価する。
- 編集、型変更、一括適用、削除、移動、renameの入口は置かない。
- 表示遅延が出ても、測定なしでcache、worker、別runtimeを追加しない。

## 7. 安全境界

- malformedな.baseはfail-closedし、既存ノートを表示から消すことで安全を作らない。
- unsupportedな構文は理由とpathを表示し、部分的な推測評価をしない。
- 入力pathはVault相対pathとして検証し、.base拡張子、symlink traversal、50_履歴などの保護範囲を拒否する。
- .baseまたはMarkdownの既存bytesを読み取り前後で比較し、変更がないことを受入条件にする。
- 保護領域、raw source、会話ログ、認証情報は入力候補から除外する。
- 既存のrevision、atomic write、履歴、AI write policyは将来のProperty編集sliceで再利用し、Bases表の初期sliceには持ち込まない。

## 8. 実装順序とゲート

### Gate 0 — 採用条件（利用者の明示選択により成立）

当初は7日観測を候補の再開条件としたが、2026-09-08の利用者による実装開始の明示選択を優先する。以下のfixtureと可視範囲を検証条件として維持する。

完了条件:

- 利用者が繰り返している具体的な表作業が1件ある。
- 5〜10件の匿名Markdown fixtureと1つの.baseで期待行・列・sortを記述できる。
- Propertiesの可視範囲とBasesのexcluded files範囲の差を、実測または未確認として記録できる。

### Step 1 — readBase入力境界（実装済み）

`VaultService.readBase`、`vault:readBase` IPC、preload API、`BaseDocument`型を追加した。.base拡張子、Vault相対path、symlink traversal、50_履歴を検証し、path・content・modifiedAtだけを返す。読み込み前後のmtime/sizeが変わった場合は`FILE_CHANGED`で破棄する。Markdown readNoteや任意file readは迂回しない。focused testと全体test、typecheckが通過している。

### Step 2 — parser／validator（実装済み）

note Propertiesは既存frontmatter parserを再利用する。.baseは新しい依存を追加せず、固定profile専用parser（`src/core/base-profile.ts`）で読み取る。任意のYAMLや式実行へ拡張せず、許可profile以外をunsupportedまたはmalformedへ分類する。fixtureは`tests/fixtures/bases/projects.base`に置き、focused testで境界を固定した。

受入:

- validなfixtureを構造化して返す。
- 未知key、view、演算子を失わず診断できる。
- malformed入力で例外や部分的な行生成を起こさない。
- readBaseが相対path、拡張子、symlink、保護範囲を検証し、Markdown readNoteや任意file readを迂回しない。

### Step 3 — filter／sort evaluator（source実装済み、paired parity部分確認済み）

snapshotを入力する純粋関数として実装する。比較の型、missing、null、stable sortをfocused testで固定する。

`src/core/base-evaluator.ts` に純粋な `evaluateBase` を追加した。`normal-discovery-snapshot` のNoteDocumentだけを受け、file属性と既存frontmatterのscalar Propertyを型付きセルへ変換し、global／view filter、公式の文字列／list `contains` filter、日付リテラルをミリ秒へ正規化した比較、値優先のstable sort、path衝突fail-closed、diagnosticを返す。`file.path` も固定profileの参照対象に追加した。Obsidian 1.13.4とのpaired fixtureでincluded IDs、列順、sort順、同値sortを確認し、excluded scopeは設定UI／再起動fixtureで、mtime／ctimeはdate比較fixtureで確認済みとする。

受入:

- Obsidian 1.13.4とincluded path IDs、列順、sort順が一致する。
- filterやProperty値の評価でノート本文を変更しない。
- unsupported値を推測で含めない。
- file.name、file.basename、同値sort、mtime／ctimeのdate wrapperとnumber比較はpaired fixtureで確認済み。

### Step 4 — read-only table（source実装・focused受入済み）

既存workspace、ノート遷移、復元契約を再利用した。新しい保存IPC、DB、永続query結果は追加していない。実装済みの経路は次の通り。

1. shared／rendererのworkspace tab unionへ`base`を追加し、`.base` pathを保存・復元できるようにする。
2. command paletteから明示pathを受け取る最小ダイアログを追加し、`readBase`の結果を固定profile parserへ渡す。
3. userIgnoreFilters適用済みの既存`searchNotes`を`evaluateBase`へ渡す。
4. `BaseTableView`でcolumns、rows、diagnostics、reloadを表示し、file.name／pathから既存note tabを開く。
5. workspace restoreと非同期世代チェックを接続し、missing／malformed／unsupportedを表の代わりに明示する。

受入:

- 表の開閉、ノート遷移、再起動復元が成立する。
- unsupported／malformedの診断が画面で確認できる。
- 書込み操作を発火できない。

### Step 5 — paired fixture（必須）

固定したObsidian 1.13.4環境で同じfixtureを開き、次を比較する。

- included file IDs
- row count
- column order
- sort order
- missing／nullの表示位置
- malformed／unsupported時の停止境界
- 同値sortのtie-break。未確認の間はpath順をTSUZUNEの決定的fallbackとし、完全互換の主張に含めない。

TSUZUNE側のfixture成功だけでは本番動作や利用者受入の証明にしない。

2026-09-08に、`work/p0-4-properties-runtime/runtime/Obsidian.exe`（ProductVersion 1.13.4.0）を隔離userData／隔離fixture Vaultで起動し、同じ `projects.base` を開いて比較した。実機は `10_プロジェクト/Beta.md`、`SameA.md`、`SameB.md`、`Alpha.md` の4行を返し、列順は `file.name`、`status`、`updated`、sort順は updated DESC の後に同値をpath順（SameA→SameB）とした。DOMのhrefは4つの相対pathと一致し、file.name表示は拡張子なしだった。TSUZUNE evaluatorは同じ4 path、列順、sort順を返し、file.nameを拡張子なしへ補正済みである。別の隔離alternate fixtureでは、値・empty・missing・nullのsort順とblank表示も実機で確認した。Settings UIで`90_excluded/`を追加すると`.obsidian/app.json`へ保存され、再起動後もBasesは`Visible.md`だけを返したが、`app.vault.getMarkdownFiles()`は両Markdownを保持した。date比較fixtureでは、古い`Old.md`を除き新しい`New.md`だけが、直接date比較・`number()`比較・`.date()`比較の全てで返った。公式の文字列／list contains (`file.ext.contains`, `tags.contains`, `status.contains`) は期待行だけを返し、infix `file.ext contains "md"` とglobal `contains(...)` は0行だった。重複YAMLは`query` error、未知のview typeは`view` errorで停止した。実機のmtime／ctimeはネイティブDateではなくdate value wrapper（constructor `t`、`icon`／`date`／`time`）だが、公式`number(date)`相当のUnix millisecondへ正規化してsource evaluatorで比較する。証拠は [`paired-fixture-evidence.json`](paired-fixture-evidence.json) に保存した。完全互換や本番反映は主張しない。

実装を完了扱いにする境界は、sourceのfocused test、typecheck、npm test、npm run check:mcpの合格後にnpm run production:updateを実行し、隔離データでinstalled smokeを通した時点とする。実Vaultは自動smokeの入力にせず、Production Vaultを開いたことやfixture成功だけで利用者受入を主張しない。

## 9. 停止条件

次のいずれかならBasesの実装を止め、設計と観測だけを残す。

- 利用者が選択を取り消した、または採用済みのread-only sliceを超える。
- .baseの対象範囲がPropertiesの可視snapshotと衝突し、境界を明示できない。
- 固定profile parser、任意式の非実行境界を実装前に確定できない。
- Obsidian 1.13.4のfixtureでincluded IDsまたはsort順を決定的に合わせられない。
- parserがunknown／malformedを保持したまま安全に停止できない。
- read-only表に書込み経路が混ざる。
- 表示遅延が確認されても、原因測定なしにcache／worker／databaseを足す必要がある。

## 10. 未確定事項（Research）

- `.base`の自動発見・候補一覧を追加する価値。現在の最小sliceは明示path入力で固定し、自動探索は未採用。
- date arithmetic、`containsAll`／`containsAny`、file.tagsなど、今回の固定profileを超える関数。
- malformed／unsupported時のsource診断と実機診断の対応。missing／nullのsort・blank表示はalternate fixtureで確認済み。
- list、date、datetime、tagsを将来どのsliceで扱うか。
- duplicate property key、anchor、alias、flow YAMLの検出境界。
- 数千ノートでの再評価時間と、測定後に必要となる最小最適化。
- table viewのcopy/export、cell edit、formulaを採用する価値。

## 11. 完了・次・Held・Research

- 完了: 公式Bases仕様と既存TSUZUNEのProperties／snapshot境界の調査、`.base` read-only入力境界（Vault、IPC、preload、型、保護範囲）、固定profile parser／validator、unknown／malformed停止境界、snapshotのfile属性・scalar Property評価、global／view filter、文字列／list contains、date literalとmtime／ctimeのmillisecond比較、stable sort、path衝突fail-closedのsource focused test、excluded filesの通常設定UI／再起動fixture。
- 完了: Step 4の表、明示path入力、path単位singleton、pathだけのworkspace保存・復元、missing／malformed診断、再読込、既存note遷移、設定完了待ちとsnapshot変更後の再評価。sourceテストで競合と非書込みを確認した。
- 次: 全体gate後の本番更新と隔離installed受入。更新後の結果はfingerprint対象外のreceiptとVault実施記録へ保存し、sourceを再変更しない。
- Held: .base自動 discovery、cell edit、formula、他view。今回のread-only sliceには含めない。
- Research: `.base`自動発見・候補一覧、date arithmetic／高度な関数、YAML完全性、規模性能、複数viewをworkspaceへ保存するversion設計。

## 12. 設計レビュー（2026-09-08）

以下は設計時の指摘と解消結果。P1はすべてsourceとfocused testで解消済み。

### P1 — 解消済み

1. **readBaseの変更競合契約がsourceと一致していない。** 計画はmtime／sizeの読み込み前後検査を定めているが、`src/main/vault.ts`の`readBase`はstat後にreadFileしてそのまま返している。readNoteにある二度目のstat相当をreadBaseにも追加し、読み込み中変更を`FILE_CHANGED`として捨てるfocused testを置く。
2. **workspace復元のmissing契約が未定義である。** 現在の`applyWorkspaceSnapshot`は、note／attachment以外のpathをnoteとして解決し、見つからなければtab自体を落とす。`base`をunionへ追加するだけでは、Vault snapshotに`.base`がないため復元できない。base tabを保持したまま`loading／ready／missing／diagnostic`を表示するのか、missing bannerとcheckpoint抑制をどう組み合わせるのかを実装前に固定する。
3. **設定とsnapshotの世代が評価契約に入っていない。** 初期化はsettingsとopenLastVaultを並行して行い、`userIgnoreFilters`は後からstateへ反映される。復元直後のBase評価が空の除外設定を使わないよう、resolved settingsを入力にするか、filter signatureを含むrequest tokenで古い結果を破棄する。外部Markdown変更と除外設定変更後も、同じBase tabを再評価する経路を明記する。

### P2 — 実装前に明文化する項目

- `file.size／mtime／ctime.contains`はparserが受け付ける一方、evaluatorは文字列以外を黙ってfalseにする。文字列file propertyだけへ構文を狭めるか、unsupported diagnosticを返す。
- `date("YYYY-MM-DD HH:mm:ss")`の`Date.parse`は実行環境のtimezoneに依存する。固定profileをホスト時刻として受け入れるのか、timezone付き入力に制限するのかを決める。
- UI契約の「singleton」を、同一`.base` pathの重複tab禁止として明記する。workspace V1へ新しいtab kindを追加する場合は、旧版へ戻した時の保存データ互換を採用するか、version bumpするかを決める。
- 受入に、旧workspaceの復元、missing／malformed復元、readBase競合、settings変更後の再評価、外部snapshot更新後の再評価を追加する。

解消証拠:

- readBaseはread前後にstatし、mtime／size不一致でFILE_CHANGEDを返す。`tests/vault.atomic.test.ts`でread中の変更を注入して確認した。通常readNoteは今回変更しない。
- base tabはsnapshotに行がなくてもpathを保持し、missingはタブ内で通知する。query結果はcheckpointへ保存しない。
- settingsが解決してからeffectで読込・評価し、cleanup、vault generation、snapshot同一性で古い結果を破棄する。設定／外部snapshot更新、閉じて再度開く競合を`tests/app.safety.test.tsx`のBases 5シナリオで確認した。
- 数値file属性のcontainsはunsupported。date literalは厳密な`YYYY-MM-DD HH:mm:ss`をホストローカル時刻として解釈し、存在しない日時を拒否する。
- singletonは同一pathの重複禁止。workspace V1を維持し、新版は既存tabを復元する。旧版へ戻す場合、旧版が理解しないbase tabは失われ得るため、旧版とのround-tripは保証しない。
- App統合テストで表の列／行、note遷移、read-only、path入力、復元診断も確認する。部品だけを複製する専用testは追加しない。

本番更新前にPLAN.mdとPROJECT_STATUS.mdへ今回のsource実装と受入境界を反映する。更新後の本番証拠はreceiptおよび最終Vault実施記録を参照する。旧receiptのexact source archiveを検証し、現行との差分がBasesの採用範囲に限られることを確認した。Git公開は今回対象外。

## 13. 本番受入後のレビュー修正（2026-09-08）

初回の全体gateと本番反映、隔離installedの表・sort・除外・診断復旧・note遷移・再起動復元・非書込みを確認した（当時1194 PASS／1 SKIP）。上の「次」は初回gate前の状態であり、その結果はreceiptとVault実施記録を参照する。

追加レビューで、重複frontmatterキーの末尾がnullの時に空値へフォールバックし、診断が消える問題を再現した。null許容をNON_SCALAR_PROPERTYだけへ限定し、DUPLICATE_PROPERTYはMALFORMED_PROPERTY診断へ統一した。列表示とfilterの双方を回帰テストで確認した。同時にProperties一覧を除外設定適用済みのsearchNotesから集計するよう修正し、設定変更後の追従を確認した。対象2ファイルの全16 testsとtypecheckはPASS。

今回の完了境界は修正版のproduction gateと隔離installed再検証。最終結果は最新receiptと既存Vault実施記録へ保存する。型管理・Bases追加機能・Git公開は今回の修正に含めない。

## Evidence

- [Obsidian Bases](https://obsidian.md/help/bases)
- [Bases syntax](https://obsidian.md/help/bases/syntax)
- [Bases views](https://obsidian.md/help/bases/views)
- [Table view](https://obsidian.md/help/bases/views/table)
- [Create a base](https://obsidian.md/help/bases/create-base)
- [Obsidian CLI](https://obsidian.md/help/cli)
- [Obsidian 1.13.4 changelog](https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/)
- [TSUZUNE Bases assessment](../../../docs/reports/obsidian-bases-assessment-2026-08-13.md)
- [Properties/global management design](../20260908-properties-global-management-design/plan.md)
- [Compatibility ledger](../20260905-obsidian-compatibility-program/compatibility-ledger.md)
- [TSUZUNE project plan](../../../PLAN.md)
