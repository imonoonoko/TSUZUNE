# CP1-B-01: Obsidian 1.13.4 Excluded files reference

Date: 2026-08-12
Result: **fail with reusable partial evidence** — reference-only monitoring sample 1/3.

## Fixed source and isolation

- Product: Obsidian Desktop `1.13.4`.
- Local installer SHA-256: `8C761AAA40310D339B6936092E91E99A9886DAF1FD655F4C8D59E9F7FA46E7A0`.
- Local `obsidian.asar` SHA-256: `51218495AD940A8515B202D380BDE638BE6570A198E121F7CA6D484A8A158917`.
- Source fixture: `fixtures/obsidian-graph-parity-vault`; before/after tree SHA-256 was `C3A8A3C63F3EE766D448D9FEA049B7A441C3A93E2A83EF05A9B439AE2F63182B` and unchanged.
- Every capture used a fresh temporary Vault copy and a fresh `--user-data-dir` under `%TEMP%`; both paths were checked in the running 1.13.4 instance. They were removed after capture. The production TSUZUNE Vault and production Obsidian profile were not opened, scanned, or modified.

## Observed contract

In Japanese UI, open **設定 → ファイルとリンク → 除外ファイル**. This is a chevron row, not a `管理` button. Its description says excluded files are hidden or made less likely to appear in places such as Quick Switcher, link suggestions, and Graph view.

The empty management view contains the heading `除外ファイル`, the empty-state text `除外は追加されていません。`, and a plus control labeled `除外を追加...`. The extractor's `buttons` array is empty because the control is a clickable `div`, not a `button`. The add flow, populated-row shape, and remove flow were not captured. Exact DOM text, geometry, and the fixed-version/profile evidence are in `excluded-files-manage-ui.json`.

## Smallest observable effect

The anonymous fixture initially produced graph nodes including `80_excluded/Hidden.md`. Setting isolated-Vault `userIgnoreFilters` to `["80_excluded/"]` removed that node from the running Graph renderer; the remaining graph included the expected unresolved `Missing Note` node. The source fixture remained byte-identical. The full before/after node lists are in `excluded-files-graph-effect.json`.

`app.vault.getMarkdownFiles()` remained unchanged in the same live process, so this sample does **not** claim exclusion from the raw Vault file enumeration. The setting was observable in runtime config, but this run did not establish restart persistence; profile-file persistence was not observed. Because frozen success condition B2 required persistence, the overall task result is **fail**, while the UI and Graph observations remain reusable partial evidence.

## Boundaries and verification

- Start HEAD: `5266131f6e2c38afc39b46fe9083c9e1fef39577`; start status SHA-256: `9d72fc07fdbf2bddab56c11b8e46c518c1761f509e65409c012c2dfdfb6e9885`.
- End status SHA-256 before report/record: `aa6f5c420e7f193d277113aec26d8289fd1622fc430e58be4b4f7ef80a35f28d`; the delta was only this task's allowed card/evidence assets at that point.
- No TSUZUNE product source, tests, package manifest, settings, Git refs, commits, remotes, releases, installed app, production profile, or production Vault changed.
- Capture retries: 5 exploratory isolated runs (four navigation/API-shape corrections and one non-authoritative file-enumeration probe). No reference conclusion uses them; the three bounded final assets are the evidence.

## Assets

- `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-manage-ui.json`
- `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-graph-effect.json`
- `docs/reports/assets/cp1-b-01-obsidian-1.13.4/excluded-files-effect.json`

Rollout use is recorded in `work/context-profiler/records/CP1-B-01.json` and validated by the shared measurement script.
