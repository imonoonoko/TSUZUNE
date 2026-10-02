# Bases functions 実装・検証対応表（2026-10-01）

## 正本と比較境界

公式 [Functions](https://obsidian.md/help/bases/functions) と [Bases syntax](https://obsidian.md/help/bases/syntax) を読取。固定参照は Obsidian 公式 help repository commit `9cf8c2913e56830e75c13f33ba198d7e70b6d9ef`。

| 固定参照 | 取得時刻 UTC / JST | HTTP UTF-8 bytes | SHA-256 |
| --- | --- | ---: | --- |
| [Functions.md](https://raw.githubusercontent.com/obsidianmd/obsidian-help/9cf8c2913e56830e75c13f33ba198d7e70b6d9ef/en/Bases/Functions.md) | 2026-09-30T17:43:33.0186996Z / 2026-10-01 02:43:33 | 18,757 | `70eb34c754cbf0f38c06b82d307605465101f98f9c7c2c331a328c001f2ef32f` |
| [Bases syntax.md](https://raw.githubusercontent.com/obsidianmd/obsidian-help/9cf8c2913e56830e75c13f33ba198d7e70b6d9ef/en/Bases/Bases%20syntax.md) | 2026-09-30T17:43:33.3420009Z / 2026-10-01 02:43:33 | 17,429 | `7fabd5f8fc3dadc45cdac2cac687016e9fdd9bc5e97f6879ef6beb4d26aac8e7` |

HTTP 応答を UTF-8 bytes としてハッシュ化。公式公開文書の取得時点であり、Obsidian 1.13.4 の実機結果との差分比較は **not compared**。参照実行環境のパスが確認できていないため、fixture が一致しても本体との完全同等性を主張しない。

Functions にある API は型別 **68 件**（Global 16 + Any 3 + Date 5 + String 14 + Number 6 + List 13 + Link 2 + File 5 + Object 3 + Regexp 1）。型間で同名のメソッドをまとめると公式メソッド名は **43 名**。Functions の型 field は **20 件**（Date 7 + String 1 + List 1 + File 11）。Syntax に記載される追加 File field `backlinks`, `embeds`, `file` も実装。`this.file` は親から渡された Base 文書のメタデータを使用する。

Syntax の custom summary 例に現れる `list.mean()` も追加実装・単独検証（上の 68 件には含めない）。

## 関数ごとの正常系

以下の全関数は `tests/base-expression.test.ts` の `Bases official function behavior > <case>: <expression>` の表駆動テストで実際の戻り値を検証。登録名を列挙するだけのテストではない。prefix のない case はそのメソッド名。異常系欄は実際に検証した内容のみで、全関数の全引数組合せを網羅したという意味ではない。

| 型・件数 | 対応する公式関数（すべて正常系あり） | 同一名の case 名 / 正常系補足 | 異常系・組合せの追加検証 |
| --- | --- | --- | --- |
| Global 16 | escapeHTML, date, duration, file, html, if, image, icon, link, list, max, min, now, number, today, random | 各関数名。now/today/random は固定 clock/random。html/image/icon/link は cloneable な型付き値。 | date 不正日・文字列、number 不正文字列、duration 不正単位。if の未選択分岐は評価しない。date/duration 算術、file/link 等価比較。 |
| Any 3 | isTruthy, isType, toString | 各関数名。 | map/filter/reduce 内の型確認・値変換。型未一致呼出しを診断。 |
| Date 5 | date, format, time, relative, isEmpty | date.date, format, time, relative, date.isEmpty。 | ISO offset/元の fractional precision 保持、epoch 等価比較、月を含む calendar 加算、date 差は milliseconds。7 field 全項目。 |
| String 14 | contains, containsAll, containsAny, endsWith, isEmpty, lower, replace, repeat, reverse, slice, split, startsWith, title, trim | string.contains/string.containsAll/string.containsAny/string.isEmpty/string.reverse/string.slice、他は関数名。replace.regex/regexg/captures も追加。 | repeat 上限。文字列置換全 occurrence、正規表現の first/global/capture group。split 正規表現 + limit。 |
| Number 6 | abs, ceil, floor, isEmpty, round, toFixed | number.isEmpty、他は関数名。 | 非有限算術結果、round 桁指定、toFixed 表示型。 |
| List 13 | contains, containsAll, containsAny, filter, flat, isEmpty, join, map, reduce, reverse, slice, sort, unique | list.contains/list.containsAll/list.containsAny/list.isEmpty/list.reverse/list.slice、他は関数名。 | nested map/filter/reduce の value/index/acc lexical scope、初期 acc=null、Instruction 上限。 |
| Link 2 | asFile, linksTo | 各関数名。 | 表示名が異なる Link と File の等価比較。asFile 経由の property validation。 |
| File 5 | asLink, hasLink, hasProperty, hasTag, inFolder | 各関数名。 | hasProperty は未対応 nested 値の既存 key も true、壊れた frontmatter は診断。nested tag、frontmatter link、folder と同名 file の区別。 |
| Object 3 | isEmpty, keys, values | object.isEmpty、keys、values。 | constructor/prototype/__proto__ 等の property 操作禁止。 |
| Regexp 1 | matches | matches。 | 不正 regex 構文。文字列 receiver の matches は型エラー。実際に停止しない regex の Worker 強制終了。 |

## 型 field・評価構成

| 対象 | 実装 | 検証 |
| --- | --- | --- |
| Date 7 fields | year, month, day, hour, minute, second, millisecond | expression: `supports all date fields and preserves explicit ISO offsets` |
| String / List length 各1 | length | expression member evaluator（正常 length は下記追加 field テストで直接検証） |
| File 11 fields | name, basename, path, folder, ext, size, properties, tags, links, ctime, mtime | evaluator 既存テスト + advanced: `covers file tags/links/frontmatter links/backlinks/embeds/properties/file and source-context fields`。name は拡張子付き。ctime は snapshot にない場合 null。 |
| Syntax 追加 File 3 fields | backlinks, embeds, file | 同 advanced case。`file().file` も直接検証。 |
| Note property / Formula | scalar / scalar list、宣言された date/datetime のみ Date、formulas readonly、lazy cached dependencies | evaluator malformed/unsupported/missing/null/empty/list、advanced declared dates・unicode quoted refs・circular formulas |
| 複数 view / filter / sort | view 選択、global + view 条件、再帰 AND/OR/NOT、複数 sort、表示 label、列数無制限 | profile + advanced `selects views...` / `uses multiple sort priorities...` |
| group / summary | property 単位 group + overall、custom `values` expression | advanced: custom reduce の overall/group 結果、numeric/boolean/any/date standard cases |
| Standard summaries 14 | Average, Min, Max, Sum, Range, Median, Stddev, Earliest, Latest, Checked, Unchecked, Empty, Filled, Unique | advanced の numeric 7 + boolean/any 5 + dates case（Earliest/Latest/Range） |
| 安全な式評価 | AST interpreter、dynamic call / JS eval / unsafe member 不許可、parse depth・instruction・deadline | expression malformed/unsafe 11 inputs、typed invalid 7 inputs、depth/step/deadline cases |
| Worker | browser Worker request/result、timeout / AbortSignal / stop / terminate | worker-client: success、abort、worker error、clone failure、実際の Node Worker regex timeout |
| GUI native controls | view・列追加削除並替・label・型・再帰条件・名前付き公式・sort・group・summary・custom summary・limit | table-view `offers native controls...` |
| GUI preview/save | source diff + result preview、完了成功 preview 必須、編集で無効化、stale async preview 不許可 | table-view mandatory preview + stale/failed preview cases。初期評価中 stop button。 |
| 型付き表示 | DOMPurify HTML、Lucide icon、Link、Image、Date/list、note cell edit、formula/file readonly | table-view sanitized markup/icon/link/image + readonly/edit callbacks |
| lossless YAML GUI edit | AST ranges による編集、BOM/CRLF、未編集 bytes、未知 root/view/property extensions、コメント保持 | profile exact scalar byte preservation/no-op/field insertion/block+flow/view append+delete/adjacent deletion/optional+list comments |
| 永続化 | 親 App / IPC に source + revision を渡す | 本対応表の core/UI fixture は実Vault保存の受入証明ではない。Main の diff/unknown/comment/revision 検証は親統合の責任範囲。 |

## 検証結果と実行経路の限界

`npx.cmd vitest run tests/base-profile.test.ts tests/base-expression.test.ts tests/base-evaluator.test.ts tests/base-advanced-evaluator.test.ts tests/base-worker-client.test.tsx tests/base-table-view.test.tsx --maxWorkers=1`。

6 files **305 tests PASS**（2026-10-01 02:53 JST）。68 API 全件に正常値の assertion、個別の異常/境界 assertion、他の関数と組み合わせた lexical map/reduce assertion がある。親統合の最終 gate は別途実行する。

Worker timeout テストは実際に uninterruptible regex を Node Worker で走らせ、同じ client lifecycle が期限で terminate することを検証する。Electron の最終 browser Worker bundle・installed runtime・実ノート保存は、この fixture テストだけでは証明しない。HTML fixture のサニタイズは代表的 script/event/unsafe href の除去を検証し、任意 HTML 全入力の網羅や Obsidian と同じ HTML 許可範囲は主張しない。

file/link の解決と file fields は既存の normal-discovery-snapshot の可視ノートだけを対象とする。不可視／曖昧なリンク先は解決しない。新しい Vault 読取権限やファイル列挙経路は追加しない。宣言されていない ISO 文字列は勝手に date にしない。宣言済み Date 値は date-only・local ISO minute precision・fractional precision・Z/offset spelling を元の文字列のまま保持。offset のない値は local time として Moment で解釈し、計算で新しく生成した値だけ millisecond/offset を書式化する。元のノートへの書込は行わない。

## 68 API の異常/境界・組合せの個別対応

全行が `tests/base-expression.test.ts` に対応する。例外のない関数も、空値・null・未解決の File・引数省略・丸め境界など許される入力で実挙動を検証する。空文字列/空リストの方法、containsAll の空の条件が true、containsAny の空の条件が false、map の空リストで callback 未実行等は公式の JavaScript behavior と各型の引数仕様に従う。now/today/random に不正引数の契約はないため、固定 clock/random の返却値と日境界を検証。File/Link 未解決は可視 snapshot 契約により null/false。

composition は当該 API の正常系 expression を singleton List に入れ、`map(value.isType(expectedType)).reduce(acc && value, true)` で型と lexical scope を検証する。型を超える伝播、Date 算術、regex 置換、分岐の短絡、File/Link 同一性等は上の独立 combination ケースでも検証する。全引数の積集合や Obsidian 本体との parity を意味しない。

| API | 個別の異常/境界入力 | 実際の期待結果 | 境界 / 組合せ test 名 |
| --- | --- | --- | --- |
| Global.escapeHTML | `escapeHTML("")` | `""` | `boundary Global.escapeHTML` / `composition Global.escapeHTML` |
| Global.date | `date("2025-02-30")` | 診断（例外） | `boundary Global.date` / `composition Global.date` |
| Global.duration | `duration("invalid")` | 診断（例外） | `boundary Global.duration` / `composition Global.duration` |
| Global.file | `file("missing")` | `null` | `boundary Global.file` / `composition Global.file` |
| Global.html | `html("")` | `{"baseType":"html","value":""}` | `boundary Global.html` / `composition Global.html` |
| Global.if | `if(null, 1 / 0)` | `null` | `boundary Global.if` / `composition Global.if` |
| Global.image | `image("")` | `{"baseType":"image","value":""}` | `boundary Global.image` / `composition Global.image` |
| Global.icon | `icon("")` | `{"baseType":"icon","value":""}` | `boundary Global.icon` / `composition Global.icon` |
| Global.link | `link("")` | `{"baseType":"link","value":""}` | `boundary Global.link` / `composition Global.link` |
| Global.list | `list(null)` | `[null]` | `boundary Global.list` / `composition Global.list` |
| Global.max | `max(0)` | `0` | `boundary Global.max` / `composition Global.max` |
| Global.min | `min(0)` | `0` | `boundary Global.min` / `composition Global.min` |
| Global.now | `now().isEmpty()` | `false` | `boundary Global.now` / `composition Global.now` |
| Global.number | `number("NaN")` | 診断（例外） | `boundary Global.number` / `composition Global.number` |
| Global.today | `today().minute` | `0` | `boundary Global.today` / `composition Global.today` |
| Global.random | `random()` | `0.25` | `boundary Global.random` / `composition Global.random` |
| Any.isTruthy | `null.isTruthy()` | `false` | `boundary Any.isTruthy` / `composition Any.isTruthy` |
| Any.isType | `null.isType("null")` | `true` | `boundary Any.isType` / `composition Any.isType` |
| Any.toString | `"".toString()` | `""` | `boundary Any.toString` / `composition Any.toString` |
| Date.date | `"wrong".date()` | 診断（例外） | `boundary Date.date` / `composition Date.date` |
| Date.format | `"wrong".format("YYYY")` | 診断（例外） | `boundary Date.format` / `composition Date.format` |
| Date.time | `"wrong".time()` | 診断（例外） | `boundary Date.time` / `composition Date.time` |
| Date.relative | `"wrong".relative()` | 診断（例外） | `boundary Date.relative` / `composition Date.relative` |
| Date.isEmpty | `date("1970-01-01").isEmpty()` | `false` | `boundary Date.isEmpty` / `composition Date.isEmpty` |
| String.contains | `"".contains("")` | `true` | `boundary String.contains` / `composition String.contains` |
| String.containsAll | `"".containsAll()` | `true` | `boundary String.containsAll` / `composition String.containsAll` |
| String.containsAny | `"".containsAny()` | `false` | `boundary String.containsAny` / `composition String.containsAny` |
| String.endsWith | `"".endsWith("")` | `true` | `boundary String.endsWith` / `composition String.endsWith` |
| String.isEmpty | `"".isEmpty()` | `true` | `boundary String.isEmpty` / `composition String.isEmpty` |
| String.lower | `"".lower()` | `""` | `boundary String.lower` / `composition String.lower` |
| String.replace | `"".replace(/x/g, "y")` | `""` | `boundary String.replace` / `composition String.replace` |
| String.repeat | `"x".repeat(-1)` | 診断（例外） | `boundary String.repeat` / `composition String.repeat` |
| String.reverse | `"".reverse()` | `""` | `boundary String.reverse` / `composition String.reverse` |
| String.slice | `"abc".slice(-1)` | `"c"` | `boundary String.slice` / `composition String.slice` |
| String.split | `"".split(",")` | `[""]` | `boundary String.split` / `composition String.split` |
| String.startsWith | `"".startsWith("")` | `true` | `boundary String.startsWith` / `composition String.startsWith` |
| String.title | `"".title()` | `""` | `boundary String.title` / `composition String.title` |
| String.trim | `" \t ".trim()` | `""` | `boundary String.trim` / `composition String.trim` |
| Number.abs | `0.abs()` | `0` | `boundary Number.abs` / `composition Number.abs` |
| Number.ceil | `(-0.1).ceil()` | `-0` | `boundary Number.ceil` / `composition Number.ceil` |
| Number.floor | `(-0.1).floor()` | `-1` | `boundary Number.floor` / `composition Number.floor` |
| Number.isEmpty | `0.isEmpty()` | `false` | `boundary Number.isEmpty` / `composition Number.isEmpty` |
| Number.round | `(-2.5).round()` | `-2` | `boundary Number.round` / `composition Number.round` |
| Number.toFixed | `1.toFixed(101)` | 診断（例外） | `boundary Number.toFixed` / `composition Number.toFixed` |
| List.contains | `[].contains(null)` | `false` | `boundary List.contains` / `composition List.contains` |
| List.containsAll | `[].containsAll()` | `true` | `boundary List.containsAll` / `composition List.containsAll` |
| List.containsAny | `[].containsAny()` | `false` | `boundary List.containsAny` / `composition List.containsAny` |
| List.filter | `[1].filter(null)` | `[]` | `boundary List.filter` / `composition List.filter` |
| List.flat | `[].flat()` | `[]` | `boundary List.flat` / `composition List.flat` |
| List.isEmpty | `[].isEmpty()` | `true` | `boundary List.isEmpty` / `composition List.isEmpty` |
| List.join | `[].join(",")` | `""` | `boundary List.join` / `composition List.join` |
| List.map | `[].map(1 / 0)` | `[]` | `boundary List.map` / `composition List.map` |
| List.reduce | `[].reduce(acc + value, null)` | `null` | `boundary List.reduce` / `composition List.reduce` |
| List.reverse | `[].reverse()` | `[]` | `boundary List.reverse` / `composition List.reverse` |
| List.slice | `[].slice(-5, 99)` | `[]` | `boundary List.slice` / `composition List.slice` |
| List.sort | `[].sort()` | `[]` | `boundary List.sort` / `composition List.sort` |
| List.unique | `[].unique()` | `[]` | `boundary List.unique` / `composition List.unique` |
| Link.asFile | `link("missing").asFile()` | `null` | `boundary Link.asFile` / `composition Link.asFile` |
| Link.linksTo | `link("missing").linksTo(file("A"))` | `false` | `boundary Link.linksTo` / `composition Link.linksTo` |
| File.asLink | `file("A").asLink(null)` | `{"baseType":"link","value":"notes/A.md"}` | `boundary File.asLink` / `composition File.asLink` |
| File.hasLink | `file("A").hasLink("missing")` | `false` | `boundary File.hasLink` / `composition File.hasLink` |
| File.hasProperty | `file("A").hasProperty("missing")` | `false` | `boundary File.hasProperty` / `composition File.hasProperty` |
| File.hasTag | `file("A").hasTag()` | `false` | `boundary File.hasTag` / `composition File.hasTag` |
| File.inFolder | `file("A").inFolder("notes/A.md")` | `false` | `boundary File.inFolder` / `composition File.inFolder` |
| Object.isEmpty | `{}.isEmpty()` | `true` | `boundary Object.isEmpty` / `composition Object.isEmpty` |
| Object.keys | `null.keys()` | 診断（例外） | `boundary Object.keys` / `composition Object.keys` |
| Object.values | `null.values()` | 診断（例外） | `boundary Object.values` / `composition Object.values` |
| Regexp.matches | `/x/.matches("")` | `false` | `boundary Regexp.matches` / `composition Regexp.matches` |
