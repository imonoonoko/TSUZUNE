# MCP原文到達の実行境界

採用: 2026-10-01。利用者の自然文検証→節取得→原文参照→再現失敗のみ修正の計画を実装する。

成功条件: (1)ツール名・回答本文を自然文へ埋め込まず対象と原文へ到達、(2)ID・revision・節・UTF-16/行範囲と取得不足を提示、(3)既存読取・保存と無書込契約を維持。

対象: list_note_sections、fetch_note_section、検索の原文抜粋とrevision、Contextのsource locator、共通カタログ、固定12シナリオ、利用文書、自動検証、実Codex、隔離した本番反映。対象外: Appを開く導線、検索エンジン・DB・永続cache、新AI・Hook、書込権限拡張、ChatGPT、Git公開。

元の並行変更を保持し、receipt acdeb38117215fa4b601f7a0a62712d9c5ba55e2149aa9909bd3c8a726b23b42 のexact archiveを複製した work/mcp-evidence/source-isolated だけで実装。本番候補はこのarchiveと今回の差分だけ。元treeへの反映は所有pathがbaselineと一致するときに限る。隔離検査で既存登録MCP artifactを変えず、本番アプリを強制終了しない。

手順: 変更前MCP固定と同じ依頼のbaseline → 節取得/参照/カタログ → focused regressions/typecheck → 実Codex後比較 → 最終typecheck/npm test/check:mcp/文書/workflow → 文書確定 → production:update → 新processの登録/正常profile/runtime/delivery → Desktop再接続確認 → 同campaign実施記録へ最終境界を一度統合。

実Codexの指定: gpt-6.1-sol/high。通常設定を無視し、合成fixtureと必須MCP接続で実行。指定モデルが拒否されたらモデル変更せず保留。回答・呼出し履歴・原文・保存を検査し終了コードだけでPASSにしない。結果と残る確認は docs/reports/mcp-evidence-2026-10-01.md に集約する。

利用者の入力不能／左一覧での名前変更報告を優先して調査した。遅延作成通知が既知revisionでも外部競合になる実不具合を修正し、window focusからwebContents focusを戻す処理を追加する。元のfocus喪失は未再現で、更新後の利用者確認を必要とする。main/index.ts、App.tsx、app.safety.test.tsxの所有hunkだけを今回の隔離候補へ追加し、元Appの並行UI変更は保持する。固定12件の実Codex受入は完了、最終検査・本番gate・再接続は別層として残す。
