# 単一起点Contextの解析対象と保持方法 — 2026-11-09

実Vaultの単一起点Contextで、上限を増やさず再要求を約86%短縮した。出力の意味・順序・警告・出典revisionは変更しない。Vaultノートと設定は変更していない。

## 変更

- 通常のバックリンク候補として従来から無条件に不採用となる `50_履歴/AI更新/` だけ、そのバックリンク用リンク構文解析を省略する。それ以外の履歴は引き続き解析する。全ノートはリンク先解決と時間情報のsnapshotに残す。同名ノートの曖昧さ、時間情報、出典参照、警告を維持する。履歴のState/Eventが実際に選択された場合などに必要な処理まで一律に止める変更ではない。
- LRUの全走査による入れ替わりをやめ、容量内で保持済みの構文を優先する。missで容量を超える時はその場で解析して返し、未変更の保持済み構文を追い出さない。毎要求の最新snapshotで、削除・除外・本文変更があった保持項目を解放してから、新しい構文を受け入れる。保持は全件ではなく容量内の部分集合で、最近使ったものへの入れ替えを保証するものではない。
- 上限は従来の **2,048パス／本文8,000,000 UTF-16文字／50,000リンク出現**を据置。本文とパスの完全一致、返却オブジェクトの複製、Vault切替時の破棄、各snapshotでのリンク解決は維持する。新しいDB・依存・永続cacheは追加しない。

## 実Vault比較

同じ実Vaultを新旧public serviceで読むAB/BA対比較。各操作cold 4組、反復10組。中央値、単位ms。

|操作|空のcache 旧→新|反復 旧→新|反復の短縮率|
|---|---:|---:|---:|
|単一起点：TSUZUNEシステム設計|3,024.1→1,011.2|2,731.6→394.1|85.6%|
|単一起点：ONOKO共通デザイン原則|2,969.6→888.8|3,128.7→414.6|86.7%|
|2起点Context Set（対照）|2,127.4→2,110.4|1,470.3→1,387.2|5.7%|

Node v24.19.0、i7-13700F。各要求は実ファイル読取、snapshot、解決、文脈整形、revision生成を含む。MCP通信・tool host・モデル・UIは含めない。Dateだけを固定し、実時間はperformance.nowで測る。OSのcacheはflushしていないため、coldは空の構文cacheを意味する。計測中に別のtest/buildは実行していない。

旧版は2026-11-09T10:55:36.514Zの検証済み配布archive `work/production-source-2pOjXz`。全2,185ファイルのdigestが旧本番receiptと一致することを確認した。開始時の配布sourceも同digestと一致。比較bundleの42 source入力は、今回の4実装ファイル以外でhashが一致する。生データと対応証拠はroot `work/context-single-improvement/` の `real-vault/results.json`、`real-vault/measure.mjs`、`source-boundary.json`。

全42組で完全JSONが一致し、別の8診断呼出しも同じ出力digestと一致した。Markdown、採用・省略、順序、警告、lineage、source references、revisionを含む。一つのVault・2起点の実測であり、他のVaultや過去の試行と混ぜて同じ短縮率を主張しない。対照のContext Setは再利用数に変化がなく、小さい時間差の因果的改善は主張しない。

## 上限と解析数

|単一起点の2回目|旧|新|
|---|---:|---:|
|バックリンク解析対象|2,821ノート|1,041ノート|
|構文抽出の呼出し|2,823|1,043|
|cache hit / miss|2 / 2,821|1,043 / 0|
|保持ノート数|628|1,041|
|保持本文UTF-16文字|7,988,510|5,852,241|
|保持リンク出現|14,032|8,366|

旧版は800万文字枠でLRUが一周するため、件数枠だけ増やしても解決しなかった。新しい解析対象は3つの枠に収まり、全件を再利用できた。8件の旧AI更新以外の履歴も残すため、Context Setの1,033ノートとは異なる。

2,048件を超える場合も、保持済みの未変更構文をmissで捨てない。2,060ノートの自動testでは、2回目のparser呼出しが旧2,060回から32回未満になり、出力は一致した。文字数枠・リンク出現枠の超過、snapshotから消えた項目・変更項目の解放もtestで検証する。実Vaultの全件保持は対象削減の効果であり、2,048枠自体を解消したとは扱わない。heap全体のpeakは未測定。

## 正しさ・データ保護・本番境界

追加の回帰testは、旧AI更新履歴の構文省略、別履歴のバックリンク、同名の曖昧さ、履歴を参照する出典、時間State/Event、壊れたmetadataの警告、includeHistory、valid-time／knowledge-timeを含むfull-snapshot版との一致を確認する。既存testで同mtime・同サイズの本文変更、最新revision、alias、追加・削除・移動、除外設定、Vault切替、single/set間の共用を確認する。更新testは全て隔離fixtureで行い、実Vaultでは編集しない。関連6ファイル194test成功。

実Vaultの `.md`・`.canvas`・`.base` と `.tsuzune` 内ファイル、合計2,899件のpath・内容hash・サイズ・mtimeが計測前後で一致した。settings.jsonの内容hashも一致し、保護対象へのwrite試行は0。OSのatime、OneDrive内部や全profileの不変をこの計測の証拠とはしない。

親が変更・計測・統合を担当し、read-only補助が意味論と計測artifactを独立照合した。指定profileはluna_scout、実行model/effortはnot_observable。補助は実VaultやMCPへアクセスせず、計測を再実行していない。最小構成reviewで追加依存・汎用設定・永続データを増やしていないことを確認した。

この資料はproduction snapshot前に確定する。typecheck、全test、check:mcp、packaged/installed隔離smoke、EXE/asar一致、通常profile不変、MCP登録更新の最終結果はexcluded `docs/reports/production-update-latest.json` とroot `work/context-single-improvement/` に残す。現行MCPプロセスの再起動後の反映確認とは区別する。本人の「ノートを変更せず」に従い、実施記録やMOCを含めVaultへは書き込まない。

## 再起動後のMCP確認とGitHub抽出（2026-11-10追記）

上記は計測・本番更新時の境界。Codex再起動後、active tsuzune-localで `stale_runtime=false`、`delivery_info.status=match` を確認した。process_started_atは2026-11-09T14:46:37.671Z、build_updated_atは2026-11-09T12:28:43.221Z。現在時点の2起点を各2回生成し、root as_of、lineage freshness.as_of、MarkdownのGenerated／As ofだけを揃えると、前回検証済み完全JSONのhashと4回とも一致した。起点原文・revision・参照範囲も照合した。既存の時間メタデータ警告と文字予算による省略は維持されている。この確認は読取APIのみで、速度の再計測ではない。証拠はroot `work/context-single-improvement/mcp-restart-observation.json`。

今回のGitHub反映では、既存mainの `da658654c21cb01e9bbc7c30c4655c942ee5180a`（PR #37）へ、この改善の実装4ファイル・test1ファイル・本資料だけを抽出する。実Vaultの実測は上記の本番source比較であり、他の未公開機能を含まないGitHub tree上で測り直した値ではない。GitHub反映だけのための本番再インストール・release公開は行わない。

2026-11-10の本人指示で、GitHubマージとMCP確認・実測値を含む実施記録保存が承認された。保存は同じcampaignの既存記録へ統合し、計測中のノート不変と、計測完了後の明示的な記録更新を区別する。
