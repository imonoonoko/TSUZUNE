---
title: TSUZUNE A6 Bases候補一覧から開く設計
created: 2026-09-09
updated: 2026-09-09
status: design-complete
scope: project:tsuzune
owner: CEO-01
---

# A6 — Basesを一覧から選んで開く

## 1. 目的・作業境界

Vaultにある`.base`の場所を覚えなくても、既存の読み取り専用表を開けるようにする。2026-09-09の「設計開始」により、候補索引の優先順位1位・A6の候補一覧部分を設計対象に選択した。本資料は設計成果であり、製品実装・本番反映・利用者受入の証拠ではない。進行状態の所有先は[PLAN.md Current Decision](../../../PLAN.md#current-decision)。

成功条件:

1. パス入力なしで候補を絞り、マウスとキーボードで既存のBase表を開く流れが定義されている。
2. 列挙・除外・保護・Vault切替・保存失敗・欠落の扱いが、現行sourceと区別して定義されている。
3. 変更責務と実装時の受入条件が対応し、設計資料・索引・Vaultの参照導線が検証されている。

対象外: `.base`作成・編集、formula／他view／group等のparser拡張、セル編集、Markdown本文の別索引、全Vault本文取得、MCP API追加、新DB・cache・daemon・Hook・外部依存、設定項目の新設、Git公開。従来の表・Properties評価・workspace保存形式を再設計しない。

## 2. 現行の根拠と選択

| 現行source（2026-09-09確認） | この設計への含意 |
|---|---|
| `App.tsx:2568-2612,3497-3501,3619-3621,3928-3937`はBase入口を既に持つ | railとCtrl+Pの「Baseを開く」を同じ候補画面へ接続する |
| `BasePathDialog.tsx:29-38,85-99`は相対path入力のみ | 一覧を既定にし、入力は同じ画面の補助操作に残す |
| `vault.ts:628-745`のscanと`types.ts:74-82`のsnapshotはMarkdown／添付中心 | `.base`列挙をsnapshotへ混ぜず、専用の読み取り専用APIを一つ追加する |
| `vault.ts:884-923`のreadBaseは保護・拡張子・symlink検査と読込前後mtime／size検査を持つ | 候補一覧は読込成功を保証せず、選択後の既存readBaseを維持する |
| `App.tsx:3697-3732`はmissing／error／構文診断と古い表結果の破棄を持つ | 候補の取得に本文解析を持たせず、この表ロードへ渡す |
| `App.tsx:556-569,977-1015,2568-2606`は操作ロックとflushSaveを持つ | 保存中・IME・保存失敗を越えてタブへ進まない。現在のvoid戻り値は成功判定できないため、局所的にbooleanへ変える |

最小案は「画面を開いた時と明示的な一覧更新時に、ファイル名だけを列挙する」。常時watch・キャッシュ・新しい検索索引は追加しない。既存scanをそのまま呼ぶとMarkdown本文読込や作成日時・bookmark処理まで動くので、候補取得からは呼ばない。

何もしない案は既存のパス入力を使い続けることで、技術的には成立するが、今回選択されたパス入力不要という目的を満たさない。snapshot拡張は常時探索への波及が大きい。汎用file picker／走査frameworkの新設より、VaultService内の小さな専用走査と既存のpath／除外predicateを選ぶ。名前・更新時刻・サイズの追加metadataは、今回の操作に使わないため返さない。

## 3. 画面と操作

railまたはCtrl+P → **Baseを開く** → 候補一覧 → 選択して**開く** → 既存Baseタブ、の一経路にする。新しい常設sidebarやコマンドは作らない。

```text
Baseを開く
[名前またはフォルダーで絞り込む                    ]

  projects.base
  views/projects.base

  projects.base
  archive/projects.base

2件                         [一覧を更新]
▸ パスを入力して開く
                              [キャンセル] [開く]
```

- 主ラベルは拡張子付きファイル名、副ラベルはVault相対の全path。長いpathは折返し等で全文を確認でき、同名でも区別できる。絶対path、本文、preview、mtimeは表示しない。
- 初期表示は全候補を相対path順。比較は小文字化したpathの辞書順、同値は元のpathで安定化する。原ファイル名とUnicode表記を保持し、検索用の正規化で実pathを書き換えない。
- 検索は既存command paletteと同じNFKC・小文字化・空白区切りAND部分一致を、相対pathへ適用する。入力だけで再走査しない。空queryは全件へ戻す。新しいfuzzy rankingは作らない。
- 初期先頭を選択し、query変更時は絞込後の先頭へ移る。更新後は以前の選択pathが残れば維持し、なければ先頭へ。選択0件なら「開く」を無効化する。
- 候補クリックは選択、ダブルクリックまたは「開く」で確定。入力欄にfocusを置いた上下キーで候補移動、Enterで選択確定。IME変換中のEnter・Escape・上下キーは候補操作にしない。
- `dialog`、label付き検索`combobox`、`listbox`／`option`、`aria-activedescendant`、`aria-selected`を既存command paletteに沿わせる。上下移動時は選択行を可視域へscrollする。Tab／Shift+Tabは操作可能な要素内を循環し、focusを目視できる。
- 初期focusは検索欄。Escape／キャンセル／背景クリックは候補取得中も閉じられる。キャンセル時は起動元へfocusを戻す。Ctrl+P経由は破棄されたpalette内部ではなく、その前のfocusをAppから渡す。開く成功時はBaseタブへfocusを移し、キャンセル用のfocus復帰と競合させない。
- 補助の「パスを入力して開く」を展開した時は、既存のpath入力検証を使い、検索候補の選択を解除する。入力モードでは「開く」とEnterの対象を入力pathだけに固定する。補助を閉じると一覧の選択へ戻る。取得エラーでも入力モードは利用できる。
- 手入力によるuserIgnoreFilters対象の明示openは現行どおり可能。除外は発見の抑制でありアクセス拒否へ変えない。dotで始まるpath segmentは現行`validateRelativePath`が拒否するため、手入力でも拒否する。`50_履歴`、Vault外、symlink、非.baseの拒否も入力方式を問わず維持する。

### 表示状態

| 状態 | 表示と操作 |
|---|---|
| 初回取得中／一覧更新中 | 「Baseを探しています」。古い候補は選択不能にし、キャンセルと手入力は残す。一覧更新は多重実行しない |
| 対象0件 | 「一覧に表示できるBaseがありません」。除外設定の対象は一覧に出ない旨、更新とパス入力の案内を示す。作成ボタンは追加しない |
| 絞込0件 | 「一致するBaseがありません」。queryを消せる。VaultにBaseがないとは断定しない |
| 列挙失敗 | 「一覧を取得できませんでした」と既存errorMessage。部分結果を完全な一覧として出さず、再試行は「一覧を更新」から行う |
| 開く前の保存失敗・操作不可 | ダイアログと入力・選択を保持し、保存失敗／競合を知らせる。既存ノートの内容とタブは保持する |
| タブへ移動後の欠落・読込競合・構文未対応 | 既存Baseタブのmissing／error／diagnosticを表示し、「再読込」で回復する。一覧へ自動送還しない |

## 4. 列挙APIと対象の契約

設計上の追加API:

```ts
// renderer / preload
listBases(expectedVaultPath: string): Promise<Result<string[]>>
// main: trusted IPC "vault:listBases"
// SettingsStoreのuserIgnoreFiltersを読み、VaultServiceへ渡す。
// VaultService内部
listBases(expectedVaultPath: string, userIgnoreFilters: readonly string[]): Promise<string[]>
```

`expectedVaultPath`は現在のsnapshotのrootPathであり、開くVaultを指定する権限ではない。既存の選択済みVaultと一致するかのguardだけに使う。空文字・非文字列は既存workspace入力と同様に`INVALID_PATH`とする。結果は`/`区切りのVault相対pathのみ。rendererから除外規則・任意glob・探索root・拡張子の指定を受けない。trusted IPCと既存Result包装を使い、MCPには公開しない。

1. `requireRoot`、expected root一致、`rootRevision`を開始時に取得する。設定読込を含むIPC待ち時間の跨ぎはexpected rootとrenderer世代でも検査する。
2. `.base`を探すためdirectory entryを再帰列挙する。Markdown／添付／.base本文のread、frontmatter評価、scanの副作用は発生させない。
3. dotで始まるfile／directory、symlink／junction、`50_履歴`のsubtreeには入らず候補にも出さない。通常のWindows hidden属性だけを理由とする追加ルールは作らない。
4. directoryへの進入前と候補採用前に、既存lstat相当のsymlink traversal guardを適用する。ただし既存helperはroot自体を検査しないため、**捕捉したroot自身も非linkのdirectoryであることをlstatで検査する**。root／childへの各進入前と最終root／revision照合時にroot自体を再検査し、選択後にrootがjunctionへ差し替わった場合も結果を返さず失敗する。捕捉したrootへpathを固定し、awaitの後にroot変更を検査する。これは新しい列挙経路の境界であり、既存scan／readBaseの全面改修を含まない。一般的なOS全競合の原子的snapshot保証は主張しない。
5. 通常fileで拡張子が大小文字無視の`.base`なら、`validateRelativePath`で利用可能な相対pathを確認し、不適合は候補から除く。正規化済み相対pathに既存`createExcludedFileMatcher`を適用し、除外一致なら返さない。`40_情報源`内の通常BaseはreadBaseが許すため候補になり得る。書込み権限は追加しない。
6. userIgnoreFiltersは現行と同じprefix／正規表現解釈を保持し、Baseの完全な相対pathへ適用する。directory名に正規表現が一致したというだけでsubtree全体を除外して意味を変えない。隠し領域・履歴・リンク以外は名前を探索する必要がある。
7. 同じpathを重ねて返さない。異なる実entryが大小文字無視で衝突する場合は、既存singletonで区別できないため`INVALID_PATH`で全結果を拒否する。どちらかを勝手に選ばない。
8. 最後にroot自体の非link検査とrootPath／rootRevision一致を検査して返す。Vault未選択は`NO_VAULT`、expected rootまたは処理中root／revision不一致は既存workspaceと同じ`FILE_CHANGED`、検査できない境界は`INVALID_PATH`、権限不足は`ACCESS_DENIED`、消失は`NOT_FOUND`、その他は既存の`UNKNOWN`へ写す。これは新APIのerror契約であり、既存scanが世代不一致に使う`NO_VAULT`は変更しない。列挙中のI/O失敗を部分成功として扱わず、一覧失敗として更新可能にする。

一覧は取得時点で見えた候補であり、存在予約やreadBaseの認可証明ではない。名前の変化を継続追跡せず、外部で作成・renameしたBaseは「一覧を更新」か次回openで反映する。本文変更は一覧で検知せず、開いた時のreadBaseが現在bytesを検証する。

## 5. 設定・非同期・保存境界

- AppのsettingsとVault初期化が完了してから取得する。要求ごとにdialog session／request番号、rootPath、vault generation、除外設定のsignatureを捕捉し、現在値に一致する結果だけcommitする。閉じる・開き直す・更新・Vault切替・設定変更後の古い成功／失敗は捨てる。永続の世代台帳は作らず、既存refsとeffect cleanupを使う。
- Vault切替を始めたらchooserを閉じ、候補と選択を破棄する。切替キャンセル後も自動openしない。`readBase`自体にはrootRevision guardがないという現行境界を保持し、Appの既存Base effectによる結果破棄を維持する。
- 除外設定が変われば既存候補・一覧の選択を直ちに無効化して、新しい設定で一度取得する。結果commit時と**一覧モードでの選択確定時**にも現在のrenderer matcherを適用する。古い一覧の除外漏れを、そのまま開く対象にしない。手入力モードのpathにはuserIgnoreFiltersを適用せず、現行のpath検証とreadBaseの保護だけを適用する。設定変更で手入力pathを消さない。OS上の設定file外部変更を新たに常時監視する契約ではない。
- 選択pathを`openBasePath`へ渡し、`beginOperation → flushSave → 同一pathの既存tabをactivate／新tab作成`を維持する。openBasePathはbooleanを返し、`false`ならchooserを保持、`true`の時だけ閉じる。例外も選択を保持して表示する。
- 開く確定後のflushSave中は他のopen／cancelを無効化する。確定時に捕捉したroot／generationがflushSave後も同じか検査してからタブを変更する。操作不可・世代不一致はfalseとし、選択内容を別Vaultへ転用しない。読込完了を待つための二重readBaseは追加しない。
- 一覧取得・検索・cancelは`.base`、Markdown、workspace、settings、履歴へ書き込まない。選択確定に伴う**既存の未保存ノート保存とworkspace checkpointは従来どおり発生し得る**。これをBaseファイルの編集や一覧の永続化と取り違えない。
- Baseは大小文字無視のpath単位singletonを維持する。workspaceには既存の`{kind:'base',path}`だけを保存し、候補・query・選択・診断を保存しない。旧workspace復元とmissing tabの既存契約を保持する。
- directory entryは一回の走査で順に列挙し、path境界のlstat検査には階層分の処理が加わる。検索は得られた候補数に比例する。最初は全候補をscroll表示し、件数を黙って打ち切らない。実測で待ち時間・描画が問題になった場合に限り最適化を別途判断する。時間・件数上限を性能保証として捏造しない。

## 6. 実装時の責務と順序

| 順 | 変更責務 | 最小変更先 |
|---|---|---|
| 1 | 読み取り専用列挙とroot／除外／保護境界 | `src/main/vault.ts`。既存path・error・除外helperを利用する。scanの意味を変える共通化は先行させない |
| 2 | trusted channelと型付き接続 | `src/main/ipc.ts`、`src/preload/index.ts`、`src/shared/types.ts` |
| 3 | 一覧・query・選択・入力補助・keyboard／focus | `src/renderer/components/BasePathDialog.tsx`、必要な`styles.css`。名称変更や汎用picker化は不要 |
| 4 | 取得世代とopen成功／失敗の接続 | `src/renderer/App.tsx`。既存表ロード、parser、evaluator、workspace schemaを保持 |
| 5 | 対応fixtureと既存回帰、最終docs、production gate | 既存`tests/vault.integration.test.ts`等とApp統合testを拡張する。下表で意味のある境界をまとめて検証 |

受入対応が必要な最小範囲に限ってtest helperのAPI mockを足す。全mockの再構築、全dialogの共通化、新しいtest frameworkを追加しない。

## 7. 実装受入条件（未実行）

| ID | ケースと期待 | 対象・証拠 |
|---|---|---|
| A6-01 | root／subfolder／日本語／空白／`.BASE`／同名別folderをpath保持で列挙。順序は固定。同一path singletonと検索正規化が実pathを変えない | Vault fixture＋App |
| A6-02 | dot領域、50_履歴、symlink／junction、Vault外は候補0。40_情報源の通常Baseは候補可。prefix／regex除外が一致し、不正regexの既存扱いを保持 | Vault fixture。static link、child進入前差替え、捕捉後のroot junction差替えを検査 |
| A6-03 | 非.base本文を読まず、scan／creation-times／bookmark reconciliationを呼ばない。clean状態の一覧取得・絞込・cancelでVaultとprofileのbytes不変 | 既存filesystem spy＋前後hash |
| A6-04 | VaultなしはNO_VAULT、expected root／世代不一致はFILE_CHANGED。不正引数・走査途中の消失・権限不足・大小文字衝突を所定のerrorで全体失敗にする。部分結果を成功表示せず、修正後の明示更新で回復 | Vault race／App error fixture |
| A6-05 | Vault A→B、A→B→A、取得中close→reopen、遅い旧request、除外設定変更で古い候補・errorを採用しない | 遅延Promiseを使う既存App統合pattern＋Vault rootRevision |
| A6-06 | Ctrl+Pとrailの両入口からpath入力なしで開く。絞込・0件・再取得・同名区別・選択維持を確認 | App統合。新規作成後は更新で出現、削除後は更新で消える |
| A6-07 | 上下・Enter・Tab循環・Escape・focus復帰と成功後focus。日本語IME確定で誤open／誤closeしない | 部品またはApp統合＋隔離installedで実操作 |
| A6-08 | dirtyノートの正常flush後に一回だけ開く。競合・保存失敗・busy・IME中はタブを変えず入力／選択を保持。flush後のVault世代不一致も拒否 | 既存save conflict fixture＋App |
| A6-09 | 選択後の消失／read中変更／malformed／unsupportedは既存タブ診断。修復後再読込で回復。二重クリックで二重tabを作らない | App＋既存readBase atomic fixture |
| A6-10 | 手入力の現行path検証（dot segment拒否を含む）、userIgnoreFilters対象の明示open、input/listの確定対象を保持。workspaceはpathだけ、再起動復元と既存Base表・note遷移が退行しない | App／workspace回帰＋隔離installed |

実装時は変更のfocused tests後、repo必須の`npm run typecheck`、`npm test`、`npm run check:mcp`を通す。fingerprint対象の最終docsを確定後に`npm run production:update`を実施し、packaged／installed smoke、exact exe／app.asar hash、通常profile不変、MCP登録とfreshnessを既存契約で受け入れる。installed自動受入は隔離Vault／profileのみを使い、実Vaultを開かない。A6-06〜10の主要操作をinstalledにも当てる。dirty sourceの本番境界はその時点のreceiptとarchiveから照合し、全source昇格を設計だけで許可しない。

## 8. 設計時の検証と残る境界

本資料のsource trace、独立review、索引整合・リンク・差分検査の結果は`work/a6-base-chooser-design-20260909/verification.json`と同work itemの最終Vault実施記録へ残す。受入表は実装後に検証する約束であり、設計時のPASSへ読み替えない。

製品コード・binary・利用者profileは今回変更しない。設計資料によるsource fingerprint差分だけを解消する再インストールは不要。実装後の使い勝手、実Vaultでの待ち時間、利用者確認は未検証。次の一手は本資料の順1からの実装であり、今回の「設計開始」の完了後に自動着手しない。

## 関連資料

- 後続の実装: [実装・受入](implementation.md)。2026-09-09の「開始」により着手した。第8節は設計完了時点の証拠として保持する。

- 既存表の契約: [Bases plan](plan.md)。同資料のdiscovery対象外は旧table sliceの境界として保持し、今回選択された候補一覧部分だけを本資料で追加する。
- 候補の範囲と順位: [未実装案の整理](../../../docs/reports/tsuzune-unimplemented-ideas-2026-09-09.md)。A6のformula／他view等はHeld／Researchのまま。
- 見た目とfocusの既存規約: [DESIGN.md](../../../DESIGN.md)。
- 元の本番受入: Vault `30_知識/TSUZUNE-Bases読み取り専用表・本番受入-2026-09-08.md`。
- 今回の設計証拠: Vault `30_知識/TSUZUNE-A6-Bases候補一覧-設計実施記録-2026-09-09.md`。
