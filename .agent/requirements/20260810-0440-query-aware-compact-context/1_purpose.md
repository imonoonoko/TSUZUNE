# Query-aware Compact Context Purpose

## Problem
TSUZUNEは回答精度と出典追跡を改善する一方、現在のContext構築は質問に不要な関連ノートも同じ候補数だけ抱えやすい。文字数上限だけを下げると、候補を減らさず全ノートを短く切るため、コンテキストは小さくなっても根拠として読みにくい。

さらにMCPの`build_context`は、同じ構造化結果をtext JSONと`structuredContent`の両方へ載せており、wire payloadを約2倍にしている。

## Target User
本番TSUZUNEをCodex／ChatGPT Desktopの個人用長期記憶として使い、回答品質を落とさず、毎回モデルへ渡す文脈を必要最小限にしたい利用者。

## Current Workaround
- `search`で少数候補を探し、起点を1件に絞ってから`build_context`する。
- `max_chars`を手動で下げる。
- Homeや巨大MOCを起点にせず、対象project／knowledge noteを直接選ぶ。

`max_chars`だけを下げる方法は、同じ候補を細切れにするため根本解決にならない。

## Desired Outcome
質問文、明示リンク、バックリンク、時間情報、出典を使って、回答に必要な少数の根拠だけを決定的に選ぶ。起点、時間安全性、出典追跡を保ちつつ、無関係候補とMCP二重搬送を減らす。

## Success Definition
- 固定4問の回答基準4/4、出典追跡3/3、未来情報混入0を維持する。
- 公開済みbenchmarkと同じ固定課題の合計Context文字数33,412文字をbaselineとし、50%以上削減できる最小presetを見つける。達成できなければ既定値を変更しない。
- `build_context`の同一構造化結果に対するJSON-RPC相当wire bytesを45%以上削減する。
- 同じ入力から同じ選定順、同じ省略判断、同じ意味内容を返す。
