# P0-3 independent read-only safety review

Contract: ../plan.md P0-3; core API/ownership: p0-3-typed-core.md.

- Role/model/effort: typed_review, verification, gpt-5.6-terra / high, task-bound. Independent source-preservation falsification is required because accepted YAML forms expanded; parent retains final acceptance and writeback.
- Subject: current source src/core/frontmatter.ts and src/renderer/components/MarkdownEditor.tsx, associated typed-core/UI/disk/App tests. Record as_of and exact SHA256 before/after; core worker is fixing known findings, so report hash-bound results and refresh changed boundaries before final acceptance.
- Ownership: read-only review; isolated temporary probes allowed, no source/test/doc writes in repo, no Vault/Git/production/dependency changes. Do not overwrite others.
- Known active fixes: trailing comments/ranges, clearing list comments, block negative numbers/indentation/separation, null versus empty list, plain apostrophe comments, preserve unsupported typed scalar neighbors, no-separation fields and duplicate keys.
- Focus independently beyond known fixes: quote/escape/token boundaries, wrong scalar typing, malformed documents accepted for mutation, source range deletion/injection, UI list type controls/no-op/draft/readonly and unexpected loss across public APIs. Show minimal repro for actual defects; no speculative redesign.
- Acceptance: dedicated probe assertions plus npx vitest run tests/frontmatter.test.ts tests/frontmatter-properties.test.ts tests/markdown-editor.test.tsx tests/properties-vault.integration.test.ts --maxWorkers=1 --reporter=dot. Parent runs full regression.
- Stop/escalate: data loss, incorrect type, ambiguous accepted syntax, or need for broader parser. Parent/worker fixes cannot silently remove review finding; reviewer rechecks exact revised boundary. Return findings or bounded PASS, hashes, exact tests and untested limits.
