import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const valueOf = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

const rolloutPath = valueOf('--rollout')
const recordsDir = valueOf('--records') ?? 'work/context-profiler/records'
const taskId = valueOf('--task')

if (!rolloutPath) {
  console.error('Usage: node scripts/measure-codex-rollout-usage.mjs --rollout <rollout.jsonl> [--records <dir>] [--task <id>]')
  process.exit(2)
}

const tokenEvents = fs
  .readFileSync(rolloutPath, 'utf8')
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((event) => event.type === 'event_msg' && event.payload?.type === 'token_count' && event.payload.info?.total_token_usage)
  .map((event) => ({
    timestamp: Date.parse(event.timestamp),
    usage: event.payload.info.total_token_usage,
    modelContextWindow: event.payload.info.model_context_window,
  }))

const fields = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']
for (let index = 1; index < tokenEvents.length; index += 1) {
  for (const field of fields) {
    if (tokenEvents[index].usage[field] < tokenEvents[index - 1].usage[field]) {
      throw new Error(`Non-monotonic ${field} at token event ${index}`)
    }
  }
}

const records = fs
  .readdirSync(recordsDir)
  .filter((name) => /^(?:CP0-T\d+|CP1-[AB]-[0-9]{2})\.json$/u.test(name))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(recordsDir, name), 'utf8')))
  .filter((record) => !taskId || record.task_id === taskId)

if (records.length === 0) throw new Error(taskId ? `Task record not found: ${taskId}` : 'No task records found')

const results = records.map((record) => {
  const start = Date.parse(record.started_at)
  const end = Date.parse(record.ended_at)
  const before = tokenEvents.filter((event) => event.timestamp < start).at(-1)
  const final = tokenEvents.filter((event) => event.timestamp <= end).at(-1)
  if (!before || !final) throw new Error(`${record.task_id}: token boundary not found`)

  const delta = Object.fromEntries(fields.map((field) => [field, final.usage[field] - before.usage[field]]))
  const measured = {
    input_tokens: delta.input_tokens,
    prompt_cache_tokens: delta.cached_input_tokens,
    output_tokens: delta.output_tokens,
    reasoning_tokens: delta.reasoning_output_tokens,
    total_tokens: delta.total_tokens,
  }
  const expected = record.usage
  const matchesRecord = expected.status === 'observed'
    && expected.input_tokens === measured.input_tokens
    && expected.prompt_cache_tokens === measured.prompt_cache_tokens
    && expected.output_tokens === measured.output_tokens
    && expected.reasoning_tokens === measured.reasoning_tokens

  return {
    task_id: record.task_id,
    token_events: tokenEvents.filter((event) => event.timestamp >= start && event.timestamp <= end).length,
    ...measured,
    cached_input_ratio: measured.input_tokens === 0 ? null : measured.prompt_cache_tokens / measured.input_tokens,
    matches_record: matchesRecord,
  }
})

const totals = results.reduce(
  (sum, result) => {
    for (const field of ['input_tokens', 'prompt_cache_tokens', 'output_tokens', 'reasoning_tokens', 'total_tokens']) {
      sum[field] += result[field]
    }
    sum.token_events += result.token_events
    return sum
  },
  { input_tokens: 0, prompt_cache_tokens: 0, output_tokens: 0, reasoning_tokens: 0, total_tokens: 0, token_events: 0 },
)

const output = {
  schema_version: 1,
  source: path.basename(rolloutPath),
  model_context_window: tokenEvents.at(-1)?.modelContextWindow ?? null,
  task_count: results.length,
  all_records_match: results.every((result) => result.matches_record),
  totals: {
    ...totals,
    cached_input_ratio: totals.input_tokens === 0 ? null : totals.prompt_cache_tokens / totals.input_tokens,
  },
  tasks: results,
}

console.log(JSON.stringify(output, null, 2))
if (!output.all_records_match) process.exitCode = 1
