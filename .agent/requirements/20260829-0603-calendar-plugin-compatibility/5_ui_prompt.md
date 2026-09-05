# Calendar Plugin Compatibility UI Prompt

## Screen: Right Context Calendar

### Purpose
公式Calendar viewの操作をTSUZUNEの右context内で、Night Workshop design systemと既存sidebar操作に合わせて使えるようにする。

### Layout Diagram
```text
+--------------------------------+
|  ‹       2026年8月       ›     |
| W  日  月  火  水  木  金  土 |
| 31  1   2   3   4   5   6   7 |
|        •   ◦                   |
| ...                            |
+--------------------------------+
| Calendar status / error        |
+--------------------------------+
```

### Primary Components
- Month header: previous、next、current month。focusable button。
- Day cell: day、today、selected、note existence、word/task indicator。
- Week cell: optional week number and weekly note action。
- Status: artifact unsupported、load/create errorを短く表示。
- Settings category: upstream設定をexisting controlsで編集。

### User Flow
1. TSUZUNEが固定artifactを検証しcompatibility hostをloadする。
2. Calendar viewがright contextへ表示される。
3. 日付またはweekを選び、既存noteを開くか確認後に作る。
4. SettingsまたはCommand Paletteから表示・設定・revealを操作する。

### Design Tone
- Style: 既存Night Workshop、Obsidianに近いcompact density。
- Color: 既存tokenのみ。accentはtoday、selected、focusに限定。
- Density: 右sidebarで読み取れるcompact grid。

### Implementation Prompt
公式Calendar 1.5.10のDOMとclassを可能な範囲で保持し、TSUZUNE theme tokenをCSS variableへbridgeする。標準button semantics、visible focus、full Japanese accessible name、reduced motion、720px全体幅を満たす。独自装飾や別cardを増やさない。

