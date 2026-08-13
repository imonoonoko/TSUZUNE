# X1-CP0 Context Profiler Baseline Purpose

## Problem

TSUZUNEのContext文字数やMCP応答bytesだけを減らしても、Codexが追加検索、再読、再推論、失敗、手戻りを増やせば、成功タスク当たりの実コストは下がらない。現時点では、TSUZUNE開発で最も繰り返されている無駄が何かを示すtask横断の実測がない。

## Target User

ローカルWindows上でTSUZUNEを開発し、Codexを外部AIとして使う本人。

## Desired Outcome

CP0-A完了後に自然発生する次のeligibleなTSUZUNE開発10 taskについて、成功条件、時間、tool call、検索、source読取、同一revision・rangeの再読、再試行を同じ規則で採点し、最初に比較するボトルネックを一つだけ選べる状態にする。

## North Star

**Cost per Successful Task**を改善する。token、文字数、tool callの単独削減を成功とみなさない。

## Success Definition

- CP0-T01〜T10の予約枠、eligible／ineligible条件、連続採取規則、card templateがレビュー可能である。
- 各taskは実際の依頼後、substantiveな探索・読取・実装より前に目的、開始revision、1〜3件の成功条件、停止条件、write境界を固定する。
- 一つのtask record schemaと数え方で、第三者がtask transcriptから再採点できる。
- hostが正確に公開しないusageは`not_observable`のまま扱い、推定tokenや推定費用を作らない。
- Raw transcript、個人本文、秘密、認証情報、task別usage値をGitまたはTSUZUNEへ複製しない。
- CP0-Aでは製品コード、本番アプリ、本番Vaultの測定対象本文／fixtureを変更しない。既存のproject／roadmap／current-work noteへの測定契約と状態の同期だけは、sample外の運用記録として許可する。
