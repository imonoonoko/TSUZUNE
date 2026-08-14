# Query-aware Compact Context Purpose

## Problem
TSUZUNEは回答精度と出典追跡を改善する一方、現在の通常ノート用Context構築は同じ候補数を抱えやすい。文字数上限だけを下げると全ノートを短く切るため、コンテキストは小さくなっても根拠として読みにくい。一方、質問語に一致しない候補を削除すると、略称、同義語、表記揺れ、間接関係を取りこぼす。

さらにMCPの`build_context`は、同じ構造化結果をtext JSONと`structuredContent`の両方へ載せており、wire payloadを約2倍にしている。

## Target User
本番TSUZUNEをCodex／ChatGPT Desktopの個人用長期記憶として使い、回答品質を落とさず、毎回モデルへ渡す文脈を必要最小限にしたい利用者。

## Current Workaround
- `type: moc`の全タイトル索引から候補を選び、必要なノートだけ次の`fetch`または`build_context`で読む。
- MOCがない対象では`search`で候補を探すが、上位数件だけを唯一の到達経路にはしない。
- `max_chars`を手動で下げる。

`max_chars`だけを下げる方法は、同じ候補を細切れにするため根本解決にならない。

## Desired Outcome
MOCの全タイトルと、query無しで到達できる通常候補集合を失わずに、質問文、明示リンク、バックリンク、時間情報、出典を使って本文の展開順を決める。起点、時間安全性、出典追跡、追加取得の導線を保ちつつ、同時に展開する本文とMCP二重搬送を減らす。

## Success Definition
- 固定4問の回答基準4/4、出典追跡3/3、未来情報混入0を維持する。
- query有無でbaseline候補ID集合を変えず、本文を見送った候補も追加取得可能なIDとして残す。
- 同義語、略称、日英表記差、抽象タイトル、橋渡しノートのfixtureでexpected-source reachability 100%とsilent omission 0を維持する。
- 公開済みbenchmarkと同じ固定課題の合計Context文字数33,412文字をbaselineとし、50%以上削減できる最小presetを見つける。達成できなければ既定値を変更しない。
- `build_context`の同一構造化結果に対するJSON-RPC相当wire bytesを45%以上削減する。
- 同じ入力から同じ選定順、同じ省略判断、同じ意味内容を返す。
