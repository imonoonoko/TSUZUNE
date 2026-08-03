import { describe, expect, it } from 'vitest'
import {
  matchesGraphQuery,
  type GraphSearchDocument
} from '../src/core/graph-query'

const document: GraphSearchDocument = {
  path: 'Projects/TSUZUNE Design.md',
  name: 'TSUZUNE Design',
  content: `---
status: Active
duration: 4
empty:
---
# Intro
mix water
mix flour

Paragraph dog here.

Paragraph cat here.

## Tasks
- [ ] call Alice
- [x] email Bob

Graph view roadmap
The whisky analogy belongs in the archive.`,
  tags: ['#project/tsuzune', '#design']
}

describe('Obsidian graph search query', () => {
  it('combines implicit AND, OR, parentheses, and negation', () => {
    expect(matchesGraphQuery(document, 'TSUZUNE graph')).toBe(true)
    expect(matchesGraphQuery(document, 'TSUZUNE missing')).toBe(false)
    expect(matchesGraphQuery(document, 'missing OR whisky')).toBe(true)
    expect(matchesGraphQuery(document, 'TSUZUNE (missing OR graph)')).toBe(true)
    expect(matchesGraphQuery(document, 'TSUZUNE -archive')).toBe(false)
    expect(matchesGraphQuery(document, 'TSUZUNE -(missing archive)')).toBe(true)
  })

  it('supports phrases and the file, path, content, and tag operators', () => {
    expect(matchesGraphQuery(document, '"whisky analogy"')).toBe(true)
    expect(matchesGraphQuery(document, 'file:"TSUZUNE Design"')).toBe(true)
    expect(matchesGraphQuery(document, 'path:"Projects/TSUZUNE"')).toBe(true)
    expect(matchesGraphQuery(document, 'content:(roadmap whisky)')).toBe(true)
    expect(matchesGraphQuery(document, 'tag:#project/tsuzune')).toBe(true)
    expect(matchesGraphQuery(document, 'tag:#project')).toBe(true)
    expect(matchesGraphQuery(document, 'tag:(#missing OR #design)')).toBe(true)
  })

  it('uses indexed Markdown tags, ignores code-fence lookalikes, and matches tag hierarchies', () => {
    const taggedDocument: GraphSearchDocument = {
      path: 'Tags.md',
      name: 'Tags',
      content: ['#visible', '```', '#hidden', '```'].join('\n'),
      tags: ['#visible', '#project/active']
    }

    expect(matchesGraphQuery(taggedDocument, 'tag:#visible')).toBe(true)
    expect(matchesGraphQuery(taggedDocument, 'tag:#hidden')).toBe(false)
    expect(matchesGraphQuery(taggedDocument, 'content:#hidden')).toBe(true)
    expect(matchesGraphQuery(taggedDocument, 'tag:#project')).toBe(true)
  })

  it('supports JavaScript regular expressions and case controls', () => {
    expect(matchesGraphQuery(document, 'path:/projects\\/tsuzune/i')).toBe(true)
    expect(matchesGraphQuery(document, 'match-case:TSUZUNE')).toBe(true)
    expect(matchesGraphQuery(document, 'match-case:"tsuzune design"')).toBe(false)
    expect(matchesGraphQuery(document, 'ignore-case:"tsuzune design"')).toBe(true)
  })

  it('keeps line, block, section, and task matches within the same Markdown unit', () => {
    expect(matchesGraphQuery(document, 'line:(mix flour)')).toBe(true)
    expect(matchesGraphQuery(document, 'line:(water flour)')).toBe(false)
    expect(matchesGraphQuery(document, 'block:(mix flour)')).toBe(true)
    expect(matchesGraphQuery(document, 'block:(dog cat)')).toBe(false)
    expect(matchesGraphQuery(document, 'section:(dog cat)')).toBe(true)
    expect(matchesGraphQuery(document, 'task:(call Alice)')).toBe(true)
    expect(matchesGraphQuery(document, 'task:(call Bob)')).toBe(false)
    expect(matchesGraphQuery(document, 'task-todo:call')).toBe(true)
    expect(matchesGraphQuery(document, 'task-done:email')).toBe(true)
  })

  it('uses the full file for lines and keeps nested headings inside their parent section', () => {
    const nestedSections: GraphSearchDocument = {
      path: 'Nested.md',
      name: 'Nested',
      content: [
        '---',
        'status: Active',
        '---',
        '# Parent',
        'parent body',
        '## Child',
        'child body',
        '# Sibling',
        'sibling body'
      ].join('\n')
    }

    expect(matchesGraphQuery(nestedSections, 'line:(status Active)')).toBe(true)
    expect(matchesGraphQuery(nestedSections, 'block:(status Active)')).toBe(true)
    expect(matchesGraphQuery(nestedSections, 'section:(Parent child)')).toBe(true)
    expect(matchesGraphQuery(nestedSections, 'section:(Child sibling)')).toBe(false)
  })

  it('treats ordered task items and their continuation lines as individual task and block units', () => {
    const tasks: GraphSearchDocument = {
      path: 'Tasks.md',
      name: 'Tasks',
      content: [
        '1. [ ] prepare release',
        '   continuation evidence',
        '2. [x] publish release',
        '   completion evidence'
      ].join('\n')
    }

    expect(matchesGraphQuery(tasks, 'task-todo:(prepare evidence)')).toBe(true)
    expect(matchesGraphQuery(tasks, 'task-done:(publish completion)')).toBe(true)
    expect(matchesGraphQuery(tasks, 'task:(prepare completion)')).toBe(false)
    expect(matchesGraphQuery(tasks, 'block:(prepare evidence)')).toBe(true)
    expect(matchesGraphQuery(tasks, 'block:(continuation publish)')).toBe(false)
  })

  it('matches scalar frontmatter properties and null values', () => {
    expect(matchesGraphQuery(document, '[status]')).toBe(true)
    expect(matchesGraphQuery(document, '[missing]')).toBe(false)
    expect(matchesGraphQuery(document, '[status:Active]')).toBe(true)
    expect(matchesGraphQuery(document, '[status:Draft OR Active]')).toBe(true)
    expect(matchesGraphQuery(document, '[duration:<5]')).toBe(true)
    expect(matchesGraphQuery(document, '[duration:>5]')).toBe(false)
    expect(matchesGraphQuery(document, '[empty:null]')).toBe(true)
  })

  it('matches each frontmatter array element without joining separate values', () => {
    const properties: GraphSearchDocument = {
      path: 'Properties.md',
      name: 'Properties',
      content: [
        '---',
        'topics: [red fox, blue whale]',
        'owners:',
        '  - Alice Smith',
        '  - Bob Jones',
        '---',
        'Property examples'
      ].join('\n')
    }

    expect(matchesGraphQuery(properties, '[topics:"blue whale"]')).toBe(true)
    expect(matchesGraphQuery(properties, '[topics:(red whale)]')).toBe(false)
    expect(matchesGraphQuery(properties, '[owners:"Alice Smith"]')).toBe(true)
    expect(matchesGraphQuery(properties, '[owners:(Alice Jones)]')).toBe(false)
  })

  it('keeps valid in-progress input searchable while invalid regex stays closed', () => {
    expect(matchesGraphQuery(document, '"whisky')).toBe(true)
    expect(matchesGraphQuery(document, 'whisky OR')).toBe(true)
    expect(matchesGraphQuery(document, '(TSUZUNE')).toBe(true)
    expect(matchesGraphQuery(document, '/whis')).toBe(true)
    expect(matchesGraphQuery(document, '[status:Act')).toBe(true)
    expect(matchesGraphQuery(document, '/(?/')).toBe(false)
  })

  it('requires file or path operators to match binary attachment names', () => {
    const attachment: GraphSearchDocument = {
      path: 'attachments/sunset.png',
      name: 'sunset.png',
      kind: 'attachment'
    }

    expect(matchesGraphQuery(attachment, 'sunset')).toBe(false)
    expect(matchesGraphQuery(attachment, 'file:sunset')).toBe(true)
    expect(matchesGraphQuery(attachment, 'path:attachments')).toBe(true)
  })

  it('treats an empty query as visible and malformed queries as no match', () => {
    expect(matchesGraphQuery(document, '')).toBe(true)
    expect(matchesGraphQuery(document, '(')).toBe(false)
    expect(matchesGraphQuery(document, '/[/')).toBe(false)
  })
})
