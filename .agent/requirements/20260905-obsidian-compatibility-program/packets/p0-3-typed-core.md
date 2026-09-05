# P0-3 typed core production packet

Contract: ../plan.md P0-3. Parent owns final integration and all production Vault writes.

- Role/model/effort: typed_core, production/core, gpt-5.6-terra / high (invoked 2026-09-05). Multiple YAML preservation constraints justify this bounded core assignment; not a permanent capability ranking.
- Ownership: src/core/frontmatter.ts and tests/frontmatter-properties.test.ts only. Parent edits UI and disk/App acceptance. Do not revert others, change dependencies, edit other files, use production Vault, perform Git delivery or production update.
- API: FrontmatterAtom {type: 'text' | 'number'; value: string}; FrontmatterProperty = atom | {type:'list'; value: atom[]}. inspectFrontmatterProperty returns {ok:true; property: property|null} or existing failure. setFrontmatterProperty / deleteFrontmatterProperty return FrontmatterEditResult. Existing scalar API remains text-only.
- Decimal grammar: signed decimal integer or fraction, no leading zeros except zero, no exponent/hex/nonfinite values. Lexical strings avoid JS Number rounding. Quoted numeric values stay text. No implicit existing-property type conversion.
- Lists: simple block (indented/indentless) and one-line flow, text/decimal elements; empty list; quoted punctuation and links. Unsupported nested/mapping/anchor/tag syntax refuses safely. Preserve comments and all non-target bytes. Same-value edit is byte-identical.
- TDD: number RED/GREEN first, then list RED/GREEN. Acceptance: npx vitest run tests/frontmatter.test.ts tests/frontmatter-properties.test.ts --maxWorkers=1 --reporter=dot.
- Unseen check owner: parent and separate read-only reviewer; exercise unsupported neighbor syntax, typed lookalikes, comments, key duplication, source range and no-op boundaries.
- Escalate: contract expansion, general YAML parser requirement, lossy writes, ambiguous scalar semantics. Return results, failures, accepted syntax, hashes and remaining limits.
