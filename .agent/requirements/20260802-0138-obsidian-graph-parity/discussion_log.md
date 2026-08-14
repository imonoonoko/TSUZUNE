# Obsidian Graph Parity Discussion Log

## Intake And Scope - 2026-08-02 01:38

### User Input
> グラフビューを極限までObsidianと同じにしたい。PLAN.mdを更新してから開発開始。

### Codex Proposal Or Question
Obsidian公式Graph view／Search仕様を互換契約とし、比較Vault、力学レイアウト、表示、Filters／Groups、操作、time-lapseの順に縦切り実装する。

### Decisions
- Accepted: Graph parityをPersonal Google Intakeより先に進める。
- Accepted: Markdownを正本のまま維持する。
- Accepted: 最初の実装は4つのForce設定、設定保存、力学配置とする。
- Rejected: 固定リングSVGへ見た目だけ追加して互換扱いする。
- Open: 公式文書にないslider範囲、group重複色、node pinは実機比較で決める。

### Rationale
動的な物理座標の一致ではなく、公式機能、設定効果、表示対象、操作結果を先に一致させる方が検証可能である。

---

## GP1 Verification - 2026-08-02 02:00

### Decisions
- Accepted: `d3-force`の決定的なsettled layoutを採用する。
- Accepted: Local Graphだけ現在ノートを中心へ固定し、Vault全体Graphは自由配置にする。
- Accepted: slider中は画面だけ更新し、pointer up／key up／blurで設定を1回保存する。
- Accepted: GP1はSVG edge＋HTML button nodeを維持し、CanvasはGP2で別sliceとして評価する。

### Verification
- 4つのForceが期待方向へ作用するpure testを追加した。
- 旧`settings.json`補完、NaN／Infinity拒否、0〜100 clamp、保存復元を確認した。
- trusted IPC、保存失敗通知、gesture単位の重複保存防止を確認した。
- 29 files／220 tests、typecheck、MCP smoke、production buildがPASSした。
- 実ElectronでCenter 50→100の配置変化、設定保存、比較VaultのMarkdown不変を確認した。

### Remaining
- Obsidian実機とのside-by-side captureはGP2以降も継続する。
- 真のfit-to-bounds、Display設定、Canvas＋アクセシブルDOM層はGP2で実装する。

---
