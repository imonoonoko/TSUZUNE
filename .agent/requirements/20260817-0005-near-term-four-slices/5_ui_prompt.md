# UI prompt

既存の3-pane desktop layoutと色・spacing・button表現を再利用する。

- 左paneの切替は左pane境界付近、右paneの切替は右pane境界付近に置く。
- 折りたたみ時にも、どちらを再表示するbuttonか日本語で分かる。
- iconだけに依存せずaccessible nameを持つ。
- 折りたたみ時は中央paneへ空間を返す。透明な幅だけを残さない。
- animation、tooltip framework、設定画面は追加しない。
- current note、tabs、search/filter、scroll位置を切替のために再初期化しない。
