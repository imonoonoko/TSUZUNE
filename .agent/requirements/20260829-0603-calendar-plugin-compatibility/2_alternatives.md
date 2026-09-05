# Calendar Plugin Compatibility Alternatives

## Codebase Findings
- `src/main/obsidian-plugins.ts` はmanifest候補と`main.js`存在だけをread-only検出し、コードを読込・実行しない。
- `src/renderer/components/DailyCalendar.tsx` は既存Daily Noteを開くnative限定実装である。
- note open、template、workspace tab、settings、command paletteは既存経路があり、adapterのhost actionとして再利用できる。

## Options

### Option A: Native parityを拡張
Effort: Medium
Value: Medium

上流と同じ機能をTSUZUNEコードで再実装する。

Benefits:
- 最も安全でReactへ自然に統合できる。
- 第三者JavaScriptを実行しない。

Tradeoffs:
- plugin互換ではなく再実装であり、未改変artifactを動かす要件を満たさない。

### Option B: Calendar 1.5.10限定compatibility host
Effort: Large
Value: High

公式artifactのid、version、SHA-256を固定し、必要最小のObsidian API shimとTSUZUNE adapterだけを実装する。

Benefits:
- 実物で互換性を判定できる。
- API範囲とtrust boundaryをCalendar一件へ閉じられる。
- 既存note、template、tab、settings経路を再利用できる。

Tradeoffs:
- DOM view、events、settings UI、daily/weekly note adapterが必要。
- 上流の未文書挙動は対象外境界を明記する必要がある。

### Option C: 汎用Obsidian plugin runtime
Effort: Very Large
Value: Unbounded

任意`main.js`を実行する広いAPI shimとplugin managerを作る。

Tradeoffs:
- security、API drift、未文書API、保守範囲が急増する。
- Calendar一件の目的を超える。

### Option D: 現状維持
Effort: None
Value: Low

native Calendarだけを使い、互換とは呼ばない。

## Recommendation
Option B。対象plugin、stable version、artifact hash、公開挙動を固定し、generic runtimeを作らず実物compatibilityを証明する。

