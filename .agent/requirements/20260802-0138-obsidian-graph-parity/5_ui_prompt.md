# Obsidian Graph Parity UI Prompt

## Screen: Graph View GP1

### Purpose
力学グラフを閲覧し、Obsidian相当のForce設定を調整・保存する。

### Layout Diagram
```text
+---------------------------------------------------------+
| Local / Vault | Depth / Orphans               [gear]    |
+---------------------------------------------------------+
| Search                                                  |
|                                      +----------------+ |
|             Force graph              | Forces         | |
|                                      | Center    [---] | |
|                                      | Repel     [---] | |
|                                      | Link      [---] | |
|                                      | Distance  [---] | |
|                                      | Restore        | |
|                                      +----------------+ |
+---------------------------------------------------------+
```

### Primary Components
- Graph canvas: 既存のhover、focus、click、pan、zoomを維持する。
- Settings button: panelの開閉状態を伝える。
- Force sliders: labelと現在値を持つ。
- Restore default settings: 4項目だけを既定値へ戻す。

### User Flow
1. グラフを開く。
2. gearを押す。
3. sliderを動かして配置変化を確認する。
4. ノートを開くか、設定をそのまま保存する。

### Design Tone
- Style: 現行TSUZUNEの落ち着いた配色を維持し、配置と操作構造をObsidianへ近づける。
- Density: 設定はコンパクトな右上panelにまとめる。
- Accessibility: keyboard操作、focus可視化、label、button semanticsを維持する。
