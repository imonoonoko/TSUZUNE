# Calendar Plugin Compatibility Scope

## MVP
- 公式安定版Calendar 1.5.10のmanifest、main.js、styles.cssをexact hashで受け入れる。
- plugin lifecycle: load、view registration/open/close、unload。
- month navigation、daily note open/create、template適用、word-count dots、incomplete-task indicator。
- week number、weekly note open/createと関連設定。
- commands: Open view、Open Weekly Note、Reveal active note。
- settings: Start week on、Words per Dot、Confirm before creating、Show Week Number、weekly folder/template/format。
- Vault create/delete/modify、file-openに追従する。
- keyboard、focus、narrow right pane、dark theme、reduced motion、screen-reader label。
- conformance fixture、API usage inventory、full regression、production update。

## Nice To Have
- README記載のCtrl-click new split、hover preview、CSS variable overrideを同一compatibility targetで証明する。

## Future
- 2.0.0 beta系列。
- Periodic Notes pluginとの別plugin間互換。
- 他のcommunity plugin。

## Out Of Scope
- 任意plugin JavaScriptの実行。
- Obsidian内部・未文書APIの一般互換。
- plugin install marketplace、network update、account、telemetry、cloud。
- active production Vaultへの自動plugin配置。

## Constraints
- One device、local Windows、Markdown正本。
- 既存dirty worktreeを保持する。
- Vault外read/write、delete/move/rename、force overwriteを追加しない。
- 新規dependencyは既存機能で不可能と証明された場合だけ検討する。
- 完了表現はconformance結果に限定し、未比較をmatchedと呼ばない。

