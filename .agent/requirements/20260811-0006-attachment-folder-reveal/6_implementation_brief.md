# Future Implementation Brief — GP0-3b-o

This is a future brief, not current authorization.

1. Run the fixed reference capture once after the hook seam, expected payload, and restart boundary are reviewed. Fail closed on hash mismatch or unverified hook; never retry an unsafe run.
2. Add the smallest RED test for the observed attachment menu item and exact relative path.
3. Reuse existing `WikiGraphView` menu rendering, trusted IPC conventions, Vault path validation, and native shell boundary. Add no new dependency or generic abstraction.
4. Add focused failure tests for missing/unsupported/directory/Vault-outside/symlink and non-empty native error, only where the observed boundary requires them.
5. Re-run typecheck, focused tests, full tests, MCP smoke, diff check, and the sanitized capture/report builder. Apply Ponytail review before any commit.
6. Only after explicit user approval, commit/push, production-update, verify receipt, and write the bounded result back to TSUZUNE. The design checkpoint itself performs none of these actions.

Potential implementation seams are `WikiGraphView`, existing shared/preload/main trusted API layers, and their focused tests. The exact set remains conditional on the reference capture; do not pre-edit them.
