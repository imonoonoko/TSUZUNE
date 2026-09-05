# Packet: current-host-audit

- objective: Calendar 1.5.10 hostから複数pluginへ再利用できる実経路とtarget固有部分を分離する。
- sources: `src/main/calendar-plugin-*`, `src/main/obsidian-plugins.ts`, renderer frame, shared contracts, tests and scripts.
- ownership: read-only code tracing and evidence report.
- do not: edit files, execute plugin code, infer unsupported APIs, touch production Vault.
- output: entry/call/data flow, reuse seams, blockers, exact file references, recommended smallest shared boundary.
- verification: every conclusion cites a real caller and test or names it unverified.

