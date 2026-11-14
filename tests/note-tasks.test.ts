import { expect, it } from 'vitest'
import { readNoteTasks, toggleNoteTask } from '../src/core/note-tasks'

it('finds real Markdown tasks including nested lists and excludes examples and metadata', () => {
  const source = '\uFEFF---\r\nexample: |\r\n  - [ ] metadata\r\n---\r\n# Tasks\r\n- [ ] Same\r\n  * [ ] Same\r\n+ [X] Done\r\n\r\n```md\r\n- [ ] code\r\n```\r\n\r\n    - [ ] indented code\r\n\r\n<!--\r\n- [ ] comment\r\n-->\r\n'
  const tasks = readNoteTasks(source)
  expect(tasks.map(task => [task.title, task.done])).toEqual([['Same', false], ['Same', false], ['Done', true]])
  expect(source.slice(tasks[1].from, tasks[1].to)).toBe('* [ ] Same')
  expect(toggleNoteTask(source, tasks[1])).toBe(source.replace('* [ ] Same', '* [x] Same'))
  expect(toggleNoteTask(source, tasks[2])).toBe(source.replace('+ [X] Done', '+ [ ] Done'))
})

it('ignores tasks in nested fenced code and unclosed frontmatter', () => {
  expect(readNoteTasks('- parent\n  ```md\n  - [ ] sample\n  ```\n  - [ ] real').map(task => task.title)).toEqual(['real'])
  expect(readNoteTasks('---\ntitle: bad\n- [ ] not a task')).toEqual([])
})

it('retains BOM offsets without frontmatter', () => {
  const source = '\uFEFF# A\r\n前文\r\n\r\n- [ ] 同じ項目\r\n  * [ ] 同じ項目\r\n'
  const tasks = readNoteTasks(source)
  expect(tasks).toHaveLength(2)
  expect(toggleNoteTask(source, tasks[1])).toBe(source.replace('* [ ]', '* [x]'))
})

it('rejects a stale row instead of finding another task with the same title', () => {
  const source = '- [ ] Same\n- [ ] Same\n'
  const task = readNoteTasks(source)[1]
  expect(() => toggleNoteTask('prefix\n' + source, task)).toThrow('再読込')
  expect(() => toggleNoteTask(source.replaceAll('[ ]', '[x]'), task)).toThrow('再読込')
})
