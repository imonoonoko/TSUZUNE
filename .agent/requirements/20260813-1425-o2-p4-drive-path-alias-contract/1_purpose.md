# O2-P4 Drive Path Alias Contract Purpose

## Problem

Local classification migration now has a test-proven rollback path, but Google Drive sync still treats a moved note as an unrelated deletion and creation, and it does not transfer the Path Alias sidecar. A production move would therefore risk remote duplicates and non-portable old links.

## Target User

The sole TSUZUNE owner using one local Windows Vault with optional Google Drive synchronization.

## Current Workaround

Keep classification moves disabled and use MOCs, links, and Properties instead of physical relocation.

## Why Now

`DRIVE_PATH_ALIAS_UNSUPPORTED` is the only open blocker after O2-P3. Closing it is required before production classification apply can even be considered.

## Desired Outcome

Freeze one implementation-ready Drive contract that preserves both:

- the Drive identity of a moved Markdown note; and
- the old-path-to-canonical-path alias map needed by immutable history and old MCP IDs.

## Success Definition

- The three alternatives are evaluated against the current code path.
- The selected design uses existing Drive ownership, OAuth scope, preview/apply, and ledger patterns.
- Conflict, drift, rollback, and restore behavior are explicit.
- The immediate next implementation slice is bounded and does not authorize production migration.
