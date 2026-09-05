# Subagent integration

## 採用した証拠

- `history_write_path`: 自動更新、patch、リンク追加、移動の履歴生成経路と、revision・原典保護から分離できる境界を特定した。
- `history_contract_scope`: 公開`include_history`／`history_path`と、内部のknowledge-time selectorを区別した。前者を撤去し、後者を維持した。
- `entry_move_worker`: 移動journalからaudit stageと履歴作成を除き、履歴なしのrollback／commit判定へ変更した。
- `mcp_contract_smoke`: 公開schemaに履歴入力・出力がないことと、通常mutation後も既存履歴件数が増えないことをsmokeへ追加した。
- `history_deadcode_docs` (Boyle): 現行文書を履歴なし契約へ更新し、未配線のHistory Store v2、圧縮・計測コードと専用testを削除した。
- `mcp_history_removal` (Averroes): MCP service testsを履歴非生成契約へ反転し、revision、provenance、原典保護を維持した。
- `history_removal_audit` (Gauss): 現行runtimeに生成・公開経路が残らないことを確認し、READMEのstale claimを指摘した。内部temporal selectorの削除提案は採用しなかった。
- `move_recovery_audit` (Huygens): Drive台帳writerが書込み後に失敗するpartial-commit窓をP1として発見した。

## 親agentの統合判断

- P1は再現testをREDにした後、台帳書込みを「試行した」時点から例外時復元する最小修正を採用した。
- `50_履歴`の検索除外・書込み／移動保護は、既存データを不活性のまま保全するtombstoneとして維持した。
- 既存`50_履歴`の物理削除、代替archive、DB、Hook、daemonは採用していない。
- subagentは本番TSUZUNEへ書き込まず、productionと正本同期はrootの所有範囲に保持した。
