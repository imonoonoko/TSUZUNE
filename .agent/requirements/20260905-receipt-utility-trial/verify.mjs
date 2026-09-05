import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const folder = resolve(import.meta.dirname, '../../../work/receipt-utility-trial-20260905')
const json = async (path) => JSON.parse(await readFile(join(folder, path), 'utf8'))
const x = await json('packets/x.json'), y = await json('packets/y.json')
const { records } = await json('sources.json')
assert.equal(x.instructions, y.instructions)
assert.equal(x.cases.length, 3)
assert.equal(y.cases.length, 3)
for (let i = 0; i < 3; i++) {
  const base = x.cases[i], full = y.cases[i]
  const { usage_receipt: usage, state_lineage: lineage, ...context } = full.context
  assert.deepEqual({ ...full, context }, base)
  const includedIds = context.included.map((entry) => entry.path)
  assert.deepEqual(usage.context_included.note_ids, includedIds)
  assert.deepEqual(usage.context_candidates.note_ids, [...new Set([...includedIds, ...context.omitted_ids])])
  for (const key of ['search_candidates', 'evidence_cited', 'decision_or_action', 'outcome_verified']) assert.equal(usage[key].status, 'not_observable')
  const seed = context.included.find((entry) => entry.path === context.seed_id)
  assert.equal(lineage.subject.revision, seed.revision)
  for (const key of ['current_states', 'explicit_sources', 'supersession', 'conflicts', 'freshness']) assert.equal(lineage[key].status, 'unknown')
  assert.equal(lineage.decision_records.status, 'not_observable')
  assert.ok(context.included.every((entry) => !entry.truncated && !entry.content_omitted))
}
for (const record of records) assert.equal(await readFile(join(folder, 'vault', record.id), 'utf8'), record.text)
// Semantic negative control: prose supersession exists, but is not falsely upgraded to structured evidence.
assert.ok(x.cases[1].context.markdown.includes('supersedes current use of:'))
assert.equal(y.cases[1].context.state_lineage.supersession.status, 'unknown')
const result = { status: 'PASS', identical_common_payload: true, fetched_text_preserved: true, duplicate_included_ids_checked: true, not_observable_not_false: true, prose_supersession_not_inferred: true, untruncated_inputs: true }
await writeFile(join(folder, 'verification.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
