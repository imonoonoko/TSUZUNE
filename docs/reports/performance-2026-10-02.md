# ノート操作の軽量化 — 2026-10-02

利用者は全体の反応とメモリ使用量の改善を選択した。ノート切替・snapshot更新から呼ばれる未リンク言及検索と、分割画面の補助表示を対象に、実行経路と変更前の回帰検査で不要な処理を確認した。

## 変更

- 未リンク言及検索では、対象名・aliasの文字列が存在しないノートのMarkdown解析を省く。候補がある本文のコード・リンク・コメント・frontmatter除外、曖昧名とsource rangeは従来どおり。
- 分割ペインはGraphとバックリンクビューを開く場合だけGraphを作る。添付・Base・Properties表示では作らず、切替時には保持していたGraphを空にする。
- 新しいcache、DB、依存、設定、機能制限は追加しない。

## 検証

同じNodeプロセス条件、疎な合成Markdown、warm process、各3回の中央値。500件は約2 MB、2,000件は約8 MBの本文。通常のGC設定で測定した。

| ノート数 | 変更前 | 変更後 | 結果件数 |
| --- | ---: | ---: | ---: |
| 500 | 362.6 ms | 15.1 ms | 10 |
| 2,000 | 2,696.3 ms | 37.2 ms | 40 |

変更前後の結果JSONのSHA-256は両サイズとも一致した。本文の意味とsource rangeを保ったまま、対象処理の時間を約96〜99%削減した。境界は`work/performance-20261002/baseline.json`、`optimized.json`と`measure.mjs`。これは合成データの単体測定であり、実Vault全体の操作時間を証明しない。

変更前は無関係な本文の解析と補助ペインでの不要なGraph構築を回帰検査で確認。変更後は関連21件PASS、元checkout全体1,806 PASS／1 SKIP、typecheck、check:mcp PASS。候補と本番gateの結果は最新receiptと同作業の最終証拠を参照する。

実Electronでも本番installed binaryと候補のbuilt sourceへそれぞれfresh isolated profileと同じ500件fixtureを用意し、UIから3回ノートを切り替えた。中央値は376.5 ms→160.1 ms（約57%短縮）。本文不変、500件読込と隔離rootを確認した。証拠は`work/performance-20261002/baseline-ui.json`、`candidate-ui.json`、`ui-smoke.mjs`。hidden windowのDOM clickから切替完了までの観測であり、物理入力や実Vaultの一般的な改善率ではない。各runtimeは独立process、同時起動によるhost競合を含む。検査harness初期試行はCDPでDOM要素を値として返す待機条件が原因でtimeoutし、booleanへ修正した。製品の初期画面は正常だった。

このfixtureのrenderer heapはGC後11,887,060 bytes→11,893,456 bytesでほぼ同じ。heap capacityも一致。常駐メモリ削減の成功とは扱わない。

処理後のheap差分はGCの影響が大きく、今回の測定から常駐メモリ削減率は算出しない。GC traceの追加試行はstdout混在のためallocation検証に採用しない。不要Graphの生成・保持と一時的な解析処理は減るが、アプリ全体のRSS／private memory削減は未確認。起動中の本番process working set合計約737 MBは観測値であり、条件を揃えた変更前後比較ではない。

## 配布境界

最新installed-and-verified receipt（2026-10-01T17:39:55.789Z）のexact archiveを照合した。1,738 files、digest `f65af91f6e3db3dc9122c8c5ed4f001eae9b44a1234eece8f61b6a44c6bf8422`、installed app.asar hash一致。今回変更する既存3ファイルの変更前内容もarchiveと一致する。

配布候補はこの保存版へ今回の2実装・2test・本reportと状態／索引の所有差分だけを追加する`work/performance-20261002/source-isolated`。元checkoutの未配布変更を昇格しない。候補を検証し、fingerprint対象文書を確定してから`npm run production:update`を実行する。本番アプリの保存・終了待ちでは強制終了しない。packaged／installed smoke、EXE／app.asar hash、通常profile不変、MCP登録はgateで検証する。通常Vaultでの体感と常駐メモリ比較は利用者操作と区別する。


## 追加検証・GitHub統合

2026-10-02の利用者指示で検証・追加最適化・GitHub更新を採用。直前の本番source archive（1,740 files、digest f5cf3ff2f4126a1f53f37289d8e7881f973f537f918dbecb9e1d6f391823db71）をhash照合し、origin/main db973b2へ統合した。公開済みwebsiteはorigin/mainを維持し、未配布Quick MemoやAndroidのroot変更を昇格しない。

extractNoteLinksはCommonMark treeを除外range計算でも共有し、リンク記号のない本文を解析前に返す。既存react-markdown配下のmicromark-util-decode-string 2.0.1を直接依存として宣言し、同じMarkdown文字参照処理をstructural linksと移動で再利用した。新しいpackageはインストールしない。移動先だけを書き換え、fragmentの元bytesを保つ。

同じ疎なfixtureのgetBacklinks中央値は500件187.96→19.04 ms、2,000件664.33→43.11 ms。結果hashは両サイズ一致。warm Node、3試行、500件10結果／2,000件40結果。process high-water RSSは約81.8→72.7 MiB／99.3→82.5 MiBだがElectronの常駐RAM比較ではない。証拠はwork/performance-20261002/github-review/{baseline,optimized}-links.jsonとmeasure-links.mjs。

500件fresh isolated profileの実Electronで3回のDOMクリック切替は、直前installed中央値112.3 ms→候補31.4 ms。fixture本文不変、通常Vaultを開かない。GC後renderer heapは11,363,680→11,339,916 bytesでほぼ同じ。fixture親processと子processのみのOS memory snapshotはworking set合計448,716,800→427,073,536 bytes、private bytes332,660,736→308,498,432 bytes。process数は各4。共有pageの重複計上、単一snapshot、候補runtimeとinstalledの違いを含むため一般的な削減率を保証しない。最終installed観測は同作業のexcluded証拠に残す。

独立reviewで3件を修正：非active補助ペインの50_履歴探索除外、Live Previewの別block参照定義と先勝ち順序、entityを含むMarkdownリンクの解析・移動。脚注を含むLive Preview blockは編集可能なsource表示を保持する。全体Previewでは脚注を表示できる。移動fragmentの空白・括弧文字参照も回帰検査する。

変更前のparse回数回帰3件はFAIL、変更後PASS。最終typecheck／全体tests／MCP、packaged／installed smoke、EXE／app.asar一致、通常profile不変、MCP登録の成否は本sourceに対応する最新production receiptへ記録する。sourceに入れる文書はgate前に確定し、gate後の結果・PR・remote main照合はexcluded receiptと最終Vault campaign記録へ保存する。
