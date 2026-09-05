# Packet 06 — Local Geometry

- Objective: 全量Graph座標を捨て、scene内だけで決定論的に中央配置し、scene内edgeだけを正しく描く最小設計を特定する。
- Context: Canvas bitmapのCSS transformとglobal layout cameraが利用者画面で破綻した。
- Files / sources: observatory.ts、ObservatoryView.tsx、GraphEdgeCanvas.tsx、graph-layout.ts、関連test。
- Ownership: read-onlyのsource調査。product sourceとTSUZUNEを編集しない。
- Do: 公開interface、最小algorithm、座標範囲、edge filter、遷移方式、test seamを提案する。
- Do not: 新規依存、通常Graph変更、意味推論、実装。
- Expected output: ファイル単位の変更案と危険箇所。
- Verification: 589／4175相当でもscene node <= 9、scene edgeだけ、矩形Canvas露出なしを検査可能にする。
