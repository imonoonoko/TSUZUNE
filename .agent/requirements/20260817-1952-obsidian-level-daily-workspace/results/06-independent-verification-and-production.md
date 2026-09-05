# Result 06 — Independent verification and production

Status: COMPLETE.

## Independent verification

- Read-only shell/settings audit: PASS; no in-scope correction required.
- The old `.app-header` is absent, Activity Rail app actions remain reachable, and Settings uses the three current persistence groups only.
- 1440／900／720 CSS px captures have no horizontal overflow; the Rail footer and Settings footer remain inside the viewport.
- Escape, Tab／Shift+Tab trapping, focus restoration, and save-busy close suppression passed.
- Existing Settings saves remain three sequential calls rather than one transaction. This is a pre-existing contract and was not expanded in this slice.

## Source and isolated evidence

- `npm test`: 82 test files passed, 1 skipped; 858 tests passed, 1 skipped.
- `npm run build`, `npm run check:mcp`, and `git diff --check`: PASS.
- `npx electron scripts/check-shell-settings-ui.mjs`: PASS at 1440／900／720.
- Fixture Vault: 7 Markdown files; SHA-256 `99261427a78c3246518b4c8812544c5d510840ec5d129ec21413d01e5f9ab047` unchanged.
- `npm run capture:optimization-ui`: PASS against the new shell contract.

## Installed production evidence

- `npm run production:update`: 10/10 checks PASS; status `installed-and-verified`.
- Receipt: `docs/reports/production-update-latest.json`.
- Built and installed executable SHA-256: `94eb01f900cd8bd24a1834a7ceaac97a2ff0fcdd0a4b38f7e3b433b4bd7caebe`.
- Built and installed `app.asar` SHA-256: `ab24ee2b3dd4c006f2528f8f4392ca0df38a512534ecc565e7340003b26fb238`.
- Production profile: 58 files; digest `b957283b290b24de336698f79b61d1d73643d0bc4e2e56909881dc1da8fc26e6` unchanged.
- After Codex restart: MCP 0.6.0, `stale_runtime:false`, `delivery_info:match`.

## Durable boundary

- Updated and read back the Daily Workspace design, the single Obsidian-UI execution record, the TSUZUNE project dashboard, and the development roadmap.
- Confirmed backlinks from the project, design, roadmap, and execution record; no duplicate canonical note was created.
- Post-receipt repository changes are limited to this workflow result and final state. They are documentation evidence only and do not change the verified installed binary.
- Git publication remains unperformed because it was not authorized.
