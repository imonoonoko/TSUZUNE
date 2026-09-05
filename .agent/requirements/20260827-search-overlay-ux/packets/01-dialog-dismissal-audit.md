# Packet 01: dialog dismissal audit

- **Objective:** Identify every current transient dialog and determine whether true-backdrop dismissal is safe and consistent with its existing close path.
- **Ownership:** Read-only `src/renderer` dialog components, App dialog blocks, and related tests.
- **Do:** Trace backdrop, Escape, close/cancel, focus return, dirty and saving guards. Recommend exact minimal edits and public-behavior tests.
- **Do not:** Edit files, introduce a shared modal component, change persistence, or write TSUZUNE.
- **Stop:** Escalate any dialog where backdrop close would bypass an unsaved-data or in-progress-operation guard.
