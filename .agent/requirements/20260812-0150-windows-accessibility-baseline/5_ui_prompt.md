# Windows Accessibility Baseline UI Prompt

## Screen: Graph view

### Purpose

Graphを読む、nodeを開く、表示を操作するための既存UIを、pointerなしでも到達可能にする。

### Layout Diagram

```text
+--------------------------------------------------+
| [縮小] [全体表示] [拡大] [設定]                  |
|                                                  |
|                  Graph canvas                    |
|       [focusable node]   [focusable node]        |
+--------------------------------------------------+
```

### Accessibility Expectations

- toolbar、canvas、nodeのfocus順は理解可能である。
- focusは2px outline以上で視認でき、hoverだけに依存しない。
- node名と現在ノート状態はscreen reader向けにも区別できる。
- 実Windowsの観測未実施状態はUI実装済みと同一視しない。
