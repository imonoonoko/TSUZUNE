# D9 Capture Friction

## Observed flow

1. `Ctrl+P`または画面の「操作」。
2. 「受信箱へメモを作成」を選択。
3. 開いた空メモへそのまま入力。

既存command paletteは検索、Enter、Escape、初期focus、focus trapを持ち、create flowは保存、folder確保、collision回避、作成、readback、editor表示を行う。

## Decision

追加コードなし。shortcut、専用画面、tray、background captureを作る根拠はない。

## Reopen only when

- commandが実利用で見つからない
- 作成後のfocusが失われる
- 作成失敗、衝突、外部変更の説明が不明瞭
- 実際のcapture手順が遅い

これらの一つを具体的に再現できた場合だけ、最小のpublic-behavior testから再開する。
