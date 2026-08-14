# Windows Accessibility Baseline Scope

## MVP

- Graph viewを開き、toolbarとnodeへTabで到達する。
- nodeをkeyboardで開き、`+`／`-`／`0`／矢印のGraph操作を確認する。
- visible focus、名前、現在ノート状態を確認する。
- 720px幅相当とWindows 100%／200%で、主要操作が隠れず到達できるかを確認する。
- 実Windows keyboard、screen reader、High Contrastを別々の証拠としてPASS／SKIP／FAILに記録する。

## Nice To Have

- 編集、file tree、dialogへの同じ観測手順の拡張。

## Future

- 確認済み障害だけのUI修正。
- Graph nodeのより深いtree semanticsまたはcanvas以外の代替表現。

## Out Of Scope

- Graphのcamera、force、context menu parity。
- 新しいtheme、plugin、telemetry、常駐アクセシビリティ監視。
- DOM回帰だけを実OS受入として表現すること。

## Constraints

- 対象はWindowsのローカルTSUZUNEのみ。
- 実OS、screen reader、High Contrast、物理DPIの未実測はSKIPとして残す。
- 実測前に製品コードを変更しない。
