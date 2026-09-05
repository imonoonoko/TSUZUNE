# Packet 17 — Runtime Feasibility

Objective: 現行TSUZUNEの観測宙域データ経路、renderer、dependencies、performance境界をread-onlyで追い、art-first prototypeの最小技術選択肢を出す。

Ownership: repository read-only scout. No file edits.

Do: actual callers/data flow/tests/package dependenciesを確認する。Canvas 2D、WebGL/WebGPU、既存依存の比較は現物根拠で行う。

Do not: 実装、dependency追加、build、本番操作、dirty worktree変更を行わない。

Expected output: reuse/delete/replace map, two feasible prototype shapes, recommendation and risks.

Verification: exact file paths and symbols.
