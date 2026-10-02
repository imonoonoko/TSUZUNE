import {mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {VaultMcpService} from '../src/mcp/service'
import {responseLength} from '../src/mcp/note-sections'

let root:string, service:VaultMcpService
const content='\uFEFF---\r\naliases: [別名]\r\n---\r\n前置き 😀\r\n# 親\r\n本文  空白\r\n## 重複\r\n最初の意見\r\n### 子\r\n<!-- コメント -->\r\n## 重複\r\n後の意見\r\nSetext\r\n------\r\n最後 😀\r\n'
beforeEach(async()=>{
  root=await mkdtemp(join(tmpdir(),'note-sections-'))
  await mkdir(join(root,'hidden')); await mkdir(join(root,'50_履歴'))
  await writeFile(join(root,'ノート.md'),content)
  await writeFile(join(root,'hidden','秘密.md'),'秘密')
  await writeFile(join(root,'50_履歴','旧.md'),'旧')
  await writeFile(join(root,'設定.json'),JSON.stringify({lastVaultPath:root,userIgnoreFilters:['hidden']}))
  service=new VaultMcpService({settingsPath:join(root,'設定.json')})
})
afterEach(async()=>{await rm(root,{recursive:true,force:true})})

async function fingerprint(directory:string):Promise<unknown> {
  return Promise.all((await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)).map(async entry=>{
    const path=join(directory,entry.name),info=await stat(path)
    return [entry.name,info.mtimeMs,entry.isDirectory()?await fingerprint(path):(await readFile(path)).toString('hex')]
  }))
}
it('lists hierarchy, duplicate slugs and Setext; exact slices retain BOM/CRLF/comments and child sections',async()=>{
  const listed=await service.listNoteSections('ノート.md')
  expect(listed.sections.map(item=>[item.heading,item.slug])).toEqual([
    ['',''],['親','親'],['重複','重複'],['子','子'],['重複','重複-1'],['Setext','setext']
  ])
  expect(listed.sections[2].start_character).toBe(content.indexOf('## 重複'))
  expect(listed.sections[4].start_character).toBe(content.lastIndexOf('## 重複'))
  for(const item of listed.sections) {
    const fetched=await service.fetchNoteSection('ノート.md',item.section_id,listed.revision)
    expect(fetched.text).toBe(content.slice(item.start_character,item.end_character))
    expect(fetched.source_reference.start_line).toBe(content.slice(0,item.start_character).split('\n').length)
  }
  const parent=listed.sections.find(item=>item.heading==='親')!
  expect((await service.fetchNoteSection('ノート.md',parent.section_id,listed.revision)).text).toContain('後の意見')
  expect(listed.sections.find(item=>item.heading==='子')!.parent_section_id).toBe(listed.sections[2].section_id)
})
it('binds pagination to note, Vault, section and revision and rejects all invalid reads without mutation',async()=>{
  const before=await fingerprint(root)
  const page=await service.listNoteSections('ノート.md',{limit:1})
  const next=await service.listNoteSections('ノート.md',{limit:1,after:page.next_after})
  expect(next.sections[0].heading).toBe('親')
  for(const id of ['../out.md','hidden/秘密.md','50_履歴/旧.md','missing.md']) await expect(service.listNoteSections(id)).rejects.toThrow()
  await expect(service.fetchNoteSection('ノート.md','preamble','stale')).rejects.toThrow(/Revision/)
  await expect(service.fetchNoteSection('ノート.md','unknown',page.revision)).rejects.toThrow(/Unknown/)
  await expect(service.listNoteSections('ノート.md',{after:'invalid'})).rejects.toThrow(/cursor/)
  expect(await fingerprint(root)).toEqual(before)
  await writeFile(join(root,'ノート.md'),content+'changed')
  await expect(service.listNoteSections('ノート.md',{after:page.next_after})).rejects.toThrow(/changed/)
  await expect(service.fetchNoteSection('ノート.md','preamble',page.revision)).rejects.toThrow(/Revision/)
})
it('pages headingless raw text, preserves surrogate and CRLF boundaries, and bounds serialized responses',async()=>{
  const text='😀 原文\r\n'.repeat(2000)
  await writeFile(join(root,'長文.md'),text)
  const list=await service.listNoteSections('長文.md')
  expect(list.sections).toHaveLength(1)
  let after:string|undefined,joined=''
  do {
    const page=await service.fetchNoteSection('長文.md','preamble',list.revision,{max_characters:2000,after})
    expect(responseLength(page)).toBeLessThanOrEqual(2000)
    expect(page.text.endsWith('\r')).toBe(false)
    expect(/[\uD800-\uDBFF]$/.test(page.text)).toBe(false)
    joined+=page.text;after=page.next_after
  } while(after)
  expect(joined).toBe(text)
})
it('keeps identifiers and coordinates for huge labels and exposes omitted section locators',async()=>{
  await writeFile(join(root,'巨大.md'),'# '+'見出し'.repeat(10000)+'\n原文\n## 末尾\n秘密の根拠\n')
  const list=await service.listNoteSections('巨大.md',{max_characters:1000})
  expect(responseLength(list)).toBeLessThanOrEqual(1000)
  expect(list.sections[0].heading_omitted).toBe(true)
  expect(list.sections[0].section_id,JSON.stringify(list)).toBe('heading-0')
  const context=await service.buildContext('巨大.md',5000,{query:'原文'})
  expect(context.source_references.representation).toBe('source_locators')
  expect(context.source_references.sections.some(item=>item.heading==='末尾')).toBe(true)
  expect(context.markdown.length+responseLength(context.source_references)).toBeLessThanOrEqual(5000)
})
it('maps raw search excerpts through Unicode case expansion, and distinguishes title-only fallback',async()=>{
  const source='# 索引\r\nİ 前置き 😀   NEEDLE\r\n本文\r\n'
  await writeFile(join(root,'索引.md'),source)
  const result=(await service.search('needle')).results[0]
  expect(result.excerpt_kind).toBe('body_match')
  expect(result.raw_excerpt).toBe(source.slice(result.source_reference.start_character,result.source_reference.end_character))
  expect(result.raw_excerpt).toContain('NEEDLE')
  expect(result.metadata.revision).toBe((await service.listNoteSections(result.id)).revision)
  await writeFile(join(root,'タイトル限定.md'),'本文だけ')
  expect((await service.search('タイトル限定')).results[0].excerpt_kind).toBe('fallback_preview')
})
it('rejects a cursor after switching Vault even when the bytes match',async()=>{
  const page=await service.listNoteSections('ノート.md',{limit:1})
  const second=join(root,'second');await mkdir(second);await writeFile(join(second,'ノート.md'),content)
  const other=new VaultMcpService({explicitVaultPath:second,settingsPath:join(root,'missing.json')})
  await expect(other.listNoteSections('ノート.md',{after:page.next_after})).rejects.toThrow(/changed/)
})

it('recognizes a first ATX heading behind BOM without changing its source position',async()=>{
  await writeFile(join(root,'BOM.md'),'\uFEFF# 見出し\r\n本文\r\n')
  const list=await service.listNoteSections('BOM.md')
  expect(list.sections[0].section_id).toBe('heading-0')
  expect(list.sections[0].heading).toBe('見出し')
  expect((await service.fetchNoteSection('BOM.md','heading-0',list.revision)).text).toBe('\uFEFF# 見出し\r\n本文\r\n')
})
it('counts omitted references inside a 1000-character Context budget for both entrypoints',async()=>{
  for(const result of [await service.buildContext('ノート.md',1000),await service.buildContextSet(['ノート.md'],1000)]) {
    expect(result.markdown.length+responseLength(result.source_references)).toBeLessThanOrEqual(1000)
    expect(result.source_references.omitted_references).toBeGreaterThan(0)
  }
})
it('includes omitted label counts and cursors in the exact listing budget',async()=>{
  await writeFile(join(root,'ラベル.md'),Array.from({length:20},(_,i)=>'# '+i+'長'.repeat(170)+'\n本文\n').join(''))
  const unbounded=await service.listNoteSections('ラベル.md',{limit:10})
  const budget=responseLength(unbounded)-1
  const bounded=await service.listNoteSections('ラベル.md',{limit:20,max_characters:budget})
  expect(responseLength(bounded)).toBeLessThanOrEqual(budget)
  expect(bounded.sections).toHaveLength(9)
  expect(bounded.omitted_heading_labels).toBe(9)
})
