# Packet 03: independent score verification

- **Objective:** Independently check the completed scorecard against frozen ground truth and raw evidence.
- **Ownership:** read-only workflow artifacts and current source where needed for unseen-boundary validation.
- **Acceptance:** recompute match counts/recall; identify each false negative/positive; check cold/incremental timing claims; apply the predeclared decision rule; give PASS/FAIL on the proposed decision.
- **Unseen boundary:** inspect at least one likely alias/wrapper or indirect test path not selected by the parent and state whether it changes the conclusion.
- **Forbidden:** edits, reruns that change criteria, CRG installation/configuration, Vault writes, or product changes.
- **Stop/escalate:** missing raw evidence or a scoring ambiguity that materially changes advance-versus-Held.

