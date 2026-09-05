# Packet 01: frozen ground truth

- **Objective:** Verify, from current source, the exact direct production and test references for the three symbols in `plan.md` before CRG output is scored.
- **Ownership:** Read-only `src/**`, `tests/**`, and this packet's result text returned to the parent.
- **Canonical source:** current working-tree content, including untracked files; `plan.md` is the provisional expected set.
- **Acceptance:** For each symbol, report declaration, every exact-symbol production reference, every exact-symbol test reference, wrappers/aliases that exact text cannot reveal, and a frozen expected file set. Explain corrections with file/line evidence.
- **Unseen boundary:** Check re-exports, renamed imports, wrapper functions, and string/dynamic calls at least once; mark unsupported semantic paths unknown rather than adding guesses.
- **Forbidden:** no file edits, CRG/network execution, product tests, Vault writes, config changes, or relaxation based on later CRG output.
- **Stop/escalate:** ambiguous generated code or a semantic caller that cannot be established statically.

