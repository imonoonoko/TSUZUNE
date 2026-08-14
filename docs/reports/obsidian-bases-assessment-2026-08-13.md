# Obsidian Bases Assessment for TSUZUNE

Date: 2026-08-13 JST
Reference: Obsidian Desktop 1.13.4 public behavior and current official documentation
Result: adopt the data model and compatibility direction; hold implementation until a real query is observed

## 結論

Obsidian Basesは「ノートとは別のデータベース」ではありません。MarkdownのYAML frontmatterとファイル属性を原本にし、`.base` YAMLがfilter、formula、property表示、複数viewを定義する投影層です。

これは「Markdownを正本にし、app-owned databaseへ閉じ込めない」というTSUZUNEの製品原則に強く一致します。TSUZUNEのO3 Structured Viewsは独自database機能として設計せず、Obsidian 1.13.4の`.base`形式を互換候補にするのが自然です。

ただし、今すぐ実装はしません。O1 7-day dogfoodで実際に繰り返す一覧・filter・編集作業が観測されたとき、1個の固定 `.base` fixtureとread-only tableから開始します。

## Basesの実体

- `.base`はvalid YAML。Markdownへ`![[File.base#View]]`で埋め込むことも、`base` code blockとして直接記述することもできる。
- 原本データはMarkdown frontmatterのnote propertiesと、path／folder／mtime／size／links／tags等のfile properties。
- formula propertiesは`.base`内で計算され、Markdownへ保存されない。
- 1つのBaseは複数viewを持てる。公式viewはtable、cards、list、mapで、pluginが追加viewを登録できる。
- filterは全view共通とview固有に分かれ、`and`／`or`／`not`を再帰的に組める。sortは複数、groupは現時点で1 property。
- tableはproperty cell編集、keyboard操作、undo／redo、summaryに対応する。結果はclipboardまたはCSVへ出せる。
- CLIは`.base`一覧、view一覧、item作成、queryを提供し、query結果をJSON／CSV／TSV／Markdown／pathで返せる。

## TSUZUNEに既にある土台

- Markdownとfrontmatterが正本で、壊れたfrontmatterもノートを不可視にせずwarningとして扱う。
- scalar／list frontmatterをGraph検索で扱う。
- tags、file path、mtime、links、backlinks、Temporal metadataを既に抽出している。
- revision check、atomic write、history、AI write policyがあり、property編集にも再利用できる。
- `PLAN.md`にはO3 Structured Viewsとしてtable／card／listが既に予約されている。

不足しているのは、汎用typed property model、`.base` parser／serializer、filter・formula evaluator、view renderer、property cell editorです。現行のfrontmatter parserはTemporal／MOC等の限定用途に十分ですが、Obsidian Properties全型とround-trip編集を保証するものではありません。

## 採用する方向

1. 独自の「TSUZUNE database」形式は作らない。
2. 互換対象を開始時点のObsidian 1.13.4 `.base` syntaxへ固定する。
3. 未対応keyやviewを削除せず保持し、表示時は明示的にunsupportedとする。
4. 最初のsliceはread-only table、1 fixture、1 real workflowだけにする。
5. property編集は別sliceとし、既存revision／atomic-write／history境界を再利用する。
6. cards／list、formula、summary、CLI、plugin viewは利用価値が確認された順に追加する。

## 最初の受入候補

O1 dogfoodで例えば「activeなTSUZUNE project notesをstatusとupdated順に確認したい」が反復した場合、次の最小契約を固定します。

- Markdown 5〜10件と`.base` 1件の匿名fixture。
- `file.inFolder()`、`file.ext`、scalar property比較、`and`だけ。
- table 1 view、`file.name`＋2 properties、ascending／descending sort。
- Markdown／`.base`のwrite 0、unknown syntax保持、malformed YAMLはfail-closed。
- Obsidian 1.13.4と同じincluded file IDs、列順、sort順を比較。

このsliceにcards、formula、summary、group、inline embed、cell編集、new file、CSV、CLI、plugin APIを混ぜません。

## リスクと穴

- Basesのsyntaxは1.9.1／1.9.2でbreaking changeを経験しているため、「最新版追従」ではなく固定version契約が必要。
- filter／formulaは独自type systemと多数のfunctionを持ち、完全互換は小機能ではない。
- filter無しBaseはVault全fileを対象にする。公式developer guideも数千entryを前提にDOM再利用・off-screen非描画を求めている。
- `file.backlinks`はperformance heavyで、いくつかのfile propertiesはVault変更時に自動refreshされないと公式syntaxに明記されている。
- property型は同じproperty名へVault全体で適用される。TSUZUNE側で型推論だけを行うとObsidianとの型差が起き得る。
- viewの便利さが手動frontmatter整備を日課に変えるなら、TSUZUNEの「tool recedes」「manual sortingを必須化しない」原則に反する。

## 優先度判断

製品適合度は高いですが、現在のO2-P4Aより先ではありません。O1 dogfoodの観測対象には加えます。反復するstructured-view需要が確認された場合、O3の最初のsliceとして選ぶ価値があります。

## 公式資料

- [Introduction to Bases](https://obsidian.md/help/bases)
- [Create a base](https://obsidian.md/help/bases/create-base)
- [Views](https://obsidian.md/help/bases/views)
- [Bases syntax](https://obsidian.md/help/bases/syntax)
- [Table view](https://obsidian.md/help/bases/views/table)
- [Cards view](https://obsidian.md/help/bases/views/cards)
- [Properties](https://obsidian.md/help/properties)
- [Obsidian CLI](https://obsidian.md/help/cli)
- [Build a Bases view](https://docs.obsidian.md/plugins/guides/bases-view)
- [Obsidian 1.13.4 public changelog](https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/)
