# Obsidian Plugin Compatibility Platform

## Task Contract

- objective: 他のObsidian community pluginをTSUZUNEで無改変実行できる範囲を広げ、選択した固定plugin/versionについて公開desktop挙動を100%証明する。
- deliverables: 現行host/API gap matrix、100%互換の測定契約、Wave 1 target選定、最小の共通runtime設計、target別conformance packet、実装と受入証拠。
- constraints: local Windows／Markdown正本／dirty worktree保全。既存noteの直接上書き、任意Node・filesystem・network権限、未検証pluginの黙示実行、完全互換の誇大表示を禁止する。Calendar 1.5.10の安全境界と既存productionを回帰させない。
- success:
  1. 「100%」を固定plugin/versionの公開desktop挙動matrix全件PASSとして機械判定し、対象外・private API・未証明を分離する。
  2. Wave 1は利用価値とAPI代表性を持つCalendar以外のpluginを選び、無変更artifact、fail-closed loading、TSUZUNEの安全なnote経路で受け入れる。
  3. focused／full regression、packaged／installed Electron acceptance、production updateを通し、利用者が実Vaultで主要動作を確認できる。
- lane: Orchestrated。
- evidence: source/API matrix、公式一次資料、固定artifact hashes、target別Electron acceptance、full test、production receipt、live user confirmation。
- stop: private/undocumented APIなしに公開挙動100%が成立しない、unrestricted NodeまたはVault外writeが必須、既存Markdown安全境界を迂回、target選択が価値を決定的に変える時は実装前に利用者判断へ上げる。

## Current State

- Calendar 1.5.10はtarget-specific sandbox bridgeで受入済み。
- active Vaultのplugin候補は直近確認で0件。target名を推測してproduction Vaultへ入れない。
- 利用者がgeneric互換のHeld programを明示再開したため、観測待ちへ戻さず実装形を比較する。
- 現行host、公式public API、候補、conformance/securityの4調査は完了した。
- 第一候補はTasks。Dataviewは次段のstress target、Templaterは権限拡張判断までHeldとする案を推薦する。
- 固定target/versionが公開挙動の分母と権限境界を決めるため、Wave 1 production targetの利用者判断待ち。

## Work Order

1. 現行Calendar hostとplugin scannerの再利用可能範囲を特定する。
2. 現行Obsidian public API／desktop runtime／配布契約を一次資料で固定する。
3. 実在plugin候補をAPI footprint・利用価値・securityで比較し、Wave 1を推薦する。
4. 100% conformanceとfail-closed compatibility profileを設計する。
5. 利用者判断が必要なら一件に統合し、確定後に最小共通runtimeとtarget adaptersを実装する。
6. 独立review、full regression、installed acceptance、本番反映、TSUZUNE最終書戻し。

## Decision Pressure Test

- strongest counterevidence: Obsidianは第三者host向け完全互換仕様を提供せず、pluginは未文書API、Electron、Node、他pluginへ依存できる。全plugin一律100%という一つのclaimは検証不能。
- do nothing: Calendar限定互換を維持でき安全だが、利用者が明示した拡張目的を満たさない。
- smallest reversible alternative: 固定plugin/versionごとの100% matrixと、実使用APIだけをprofile化する。共通化は2つ以上のtargetで同じAPIが必要と証明された時だけ行う。
- selected direction: 100%の水準は維持し、claimの単位を固定targetへ厳密化する。未対応targetはpartial互換として実行せず、理由を表示する。
