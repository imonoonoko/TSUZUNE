# Obsidian Plugin Compatibility Platform Assessment

## Conclusion

Obsidian community plugins as a whole do not have a third-party-host conformance specification. The strongest verifiable compatibility claim is therefore:

`exact plugin id + exact version + exact artifact SHA-256 + 100% PASS of the declared public desktop behavior matrix`

Anything using undocumented APIs, unrestricted Node, Vault-external filesystem access, network access, another plugin's internals, or unenumerated behavior is not silently included in the claim. It must be declared unsupported or separately authorized and tested.

## Current Host Boundary

- Candidate discovery is manifest-only and never executes `main.js`.
- The installed runtime is a Calendar 1.5.10-specific host, not a generic Obsidian API implementation.
- Reusable seams are the isolated iframe/session protocol, strict CSP, exact artifact verification, settings/event transport, and allowlisted note actions.
- The current `require()` shim accepts only `obsidian`; settings persistence and IPC are Calendar-specific.

## Wave 1 Recommendation

1. **Tasks**: first production target. It is useful, Markdown-centered, and exercises parsing, rendered queries, settings, metadata events, and revision-safe task updates without requiring unrestricted Node by default.
2. **Dataview**: next research/stress target. It exercises Vault-wide indexing, Markdown processors, metadata/event accuracy, render lifecycle, and optional JavaScript execution. Static footprint and non-JS behavior must be separated before execution.
3. **Advanced Tables or Note Refactor**: bounded editor/file-operation target after the first editor abstraction is defined.
4. **Templater**: held behind an explicit permission-expansion decision because complete behavior includes user scripts, Node/process/filesystem authority, and arbitrary code execution.

## Why Target Selection Is a User Decision

- Tasks gives the best value/safety balance but has a materially larger behavior denominator than a bounded editor plugin.
- Advanced Tables or Note Refactor can reach exact conformance sooner, but may be less valuable to the user.
- Dataview and Templater are high value but cross security and runtime boundaries that cannot be assumed.

## Implementation Shape After Selection

1. Pin an official release artifact by id, version, release tag/commit, and SHA-256.
2. Enumerate manifest, commands, settings, views, events, lifecycle, and every published desktop behavior.
3. Add a fail-closed capability profile and RED Electron conformance tests.
4. Implement only the missing APIs used by the selected target.
5. Extract a shared host API only after two accepted targets require the same behavior.
6. Run focused/full regression, packaged and installed Electron acceptance, production update, and live Vault confirmation.

## Unverified Boundaries

- Generic plugin settings persistence and migrations.
- Full command/view/event/unload semantics.
- Artifact verification TOCTOU hardening.
- Strict parent-message origin validation.
- Multiple-plugin lifecycle and conflict behavior.
- Private or undocumented Obsidian APIs.

