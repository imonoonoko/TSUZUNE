# Public repository readiness — 2026-08-15

## Conclusion

The repository is public and PR #1 has been merged into the default branch with merge commit `4854bdd7ac92c4546958c98a41fc7c9c312c39fe`. The current v0.5 README, implementation, public updater configuration, and dependency fixes are on `main`. TSUZUNE v0.5.0 is published as a public GitHub Release. No tracked credential file or private-key material was found in the current tree or filename history.

## Changes made

- Enabled GitHub secret scanning, push protection, Dependabot alerts and security updates, and private vulnerability reporting.
- Updated the GitHub description and topics to match the current product.
- Added `SECURITY.md` with the private reporting route.
- Changed the Electron updater feed from private to public GitHub Releases and fixed its regression checks.
- Updated transitive lockfile resolutions for `fast-uri`, `hono`, `js-yaml`, `brace-expansion`, and `nanoid`; the full `npm audit` changed from 5 findings to 0.
- Replaced personal absolute paths in tracked handoff and report documents with portable placeholders.

## Evidence

- Repository visibility: `PUBLIC`; default branch: `main`.
- PR #1: merged at 2026-08-14T20:11:24Z using merge commit `4854bdd7ac92c4546958c98a41fc7c9c312c39fe`.
- GitHub after merge: 0 open pull requests, 0 open issues, and 0 open Dependabot alerts.
- Merge-time branch cleanup is enabled, and the merged remote head branch was deleted.
- Secret filename scan: only the intentionally empty `.env.example` matched; no credential JSON, key, certificate, or password database was tracked or found in filename history.
- Content matches for OAuth token names were implementation fields and explicit test placeholders, not live values.
- Full dependency audit: 0 known vulnerabilities after the lockfile refresh.

## Public v0.5.0 Release

- Release: https://github.com/imonoonoko/TSUZUNE/releases/tag/v0.5.0
- Tag target: `03296eef18e8b633f8161a8e05b8ec72303b36f8`
- Assets: `TSUZUNE-Setup-0.5.0.exe`, its blockmap, and `latest.yml`; all three return HTTP 200 without GitHub authentication.
- Installer: 103,607,215 bytes; SHA-256 `01a3ee9002f4d29bc4fc9c0df0e7ad00fb84f64f5964cfa7be14dbeb967bd6c7`.
- Release state: published, non-draft, non-prerelease, and marked latest.
- Signing: `NotSigned`; the README and release notes warn about the possible Windows SmartScreen unknown-publisher prompt.

## Validation

- `npm run typecheck`: PASS.
- `npx vitest run tests/release-config.test.ts --maxWorkers=1`: 1 file / 5 tests PASS.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run test:production`: 65 files / 655 tests PASS using the repository's configured 2 workers.
- `npm run check:mcp`: PASS, 6 read tools / 7 write tools.
- `npm run build`: PASS.
- `npm run pack:win` and `npm run check:installer`: PASS; generated feed is `public GitHub release` and the custom icon is present.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: PASS.

An earlier 6 GiB single-worker full-suite attempt exhausted the Node heap. It did not report a test assertion failure. The repository's production command then completed the same 65 files / 655 tests with 2 workers.

## Remaining public boundary

- Do not describe the project as open source unless an explicit license is chosen. Public visibility currently grants no open-source license; the README says so.
- Personal paths remain recoverable from existing Git history. They are not credentials; rewriting published history only for those paths is not proportionate and was not performed.
- Branch protection and CI were not introduced because they would change the solo-maintainer workflow and there are currently no required checks to enforce.
