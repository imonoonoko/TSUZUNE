# D15 — TSUZUNE情報モデル設計結果

- 動画のProjects / Ideas / Resources / Contextを新設せず、`10_プロジェクト` / `20_分野` / `30_知識` / `40_情報源`へ責務対応させる。
- Inboxのfieldなしnoteをpendingとみなし、例外だけ`organize_status: needs_review`、常設guideだけ`ignore`を持つ。
- 成功状態はdestination pathで表し、`organized`、処理日時、attempt、run ID、Processed / Archive / Historyを作らない。
- Rawは本文を変えず40へmoveし、派生noteは後続sliceで`derived_from`により原典へ戻す。
- AIの入口は既存`ホーム -> 今やること/各地図 -> atomic note -> source`。巨大MyContextと日次MOC再生成は採用しない。
- merge、duplicate、contradiction、multiple responsibilityはsourceをInboxへ保持したまま人間判断へ返す。

