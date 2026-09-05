# Packet 03 — 動的宇宙と現行グラフの技術設計

- ID: COSMOS-01
- objective: 現行TSUZUNEのGraph stackを壊さず、観測宙域MVPからLiving Cosmosへ進める最小で可逆な構造を調査する。
- context: `4_requirements.md`、`6_implementation_brief.md`、現行graph関連sourceとpackage。
- sources: working treeをread-only調査。外部参照は使用中ライブラリの公式documentation・sourceを優先する。
- ownership: `results/03-dynamic-graph-system.md` のみ。
- do: 描画層、simulation state、seed、scene scheduler、edge/node occlusion、性能上限、通常Graphとの分離、段階的導入を具体化する。
- do not: コード変更、新依存の追加、DB/daemon/LLM/vector化、既存Graph挙動の変更、本番Vault書込み。
- output: 推奨component境界、data flow、決定論、性能budget、MVP/Future/Reject/Experiment、故障モードと検証案。
- verification: 現行file/関数へ根拠を結び、推測は推測と明記する。
