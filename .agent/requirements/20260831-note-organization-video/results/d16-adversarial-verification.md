# D16 — Adversarial integration verification

## Verdict

Initial verdict was `REVISE before implementation`. The integrated design was corrected before canonical synchronization.

## Required corrections and disposition

1. Schedule host behavior for sleep, Codex exit, missed run, and overlap is unverified. Slice E stays shadow-only until real-host verification.
2. The proposed Hook events do not exist in current `VaultChangeEvent`. Slice D now requires one typed internal event sink wired from watcher, capture readback, and MCP move readback.
3. `preflight_move_entry` has no runtime freshness guard. The organizer must call `runtime_info` immediately before preflight and again immediately before apply.
4. Raw routing now explicitly means an Inbox Raw candidate moving unchanged into `40_情報源`; existing source-note updates remain prohibited.
5. Current readback assurance is `contentRevision`, not an independently implemented byte-for-byte body comparison.
6. `knowledge.md`, guide, protected paths, and notes over 64 KiB are excluded from fetch using inventory metadata. Exception frontmatter tests now include existing YAML, malformed YAML, and field collisions.
7. `list_directory` is not an atomic body snapshot. Per-note revision, move fingerprint, and final re-scan are required.
8. Weekly audit is bounded to eligible Markdown under `10/20/30`, at most 30 bodies, and never auto-merges or deletes.

## Positive evidence

Existing move code already provides re-preflight, collision rejection, revision checking, journal recovery, readback, and protection for `40_情報源` and `50_履歴`.

## Final assessment

`PASS for design completion; NOT READY for write-enabled schedule.` Slice order remains A -> B -> C -> D -> E.
