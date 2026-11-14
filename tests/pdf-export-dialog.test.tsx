// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PdfExportDialog from '../src/renderer/components/PdfExportDialog'

const exportNotePdf = vi.fn()
const mermaidRender = vi.hoisted(() => vi.fn())
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: mermaidRender } }))
beforeEach(() => {
  Object.defineProperty(window, 'tsuzune', { configurable:true, value:{exportNotePdf} })
  exportNotePdf.mockReset()
  mermaidRender.mockReset()
})
afterEach(cleanup)
function mount(extraContent = '') {
  const props = {
    snapshot: {
      content: [
        '未保存の本文',
        '[[内部]]',
        '[外部](https://example.com)',
        '![遠隔画像](https://example.com/asset.png)',
        '![[audio.mp3]]',
        '![[clip.webm]]',
        '![[reference.pdf#page=2]]',
        extraContent
      ].join('\n\n'),
      notePath: '研究.md',
      attachments: ['audio.mp3', 'clip.webm', 'reference.pdf'].map(name => ({
        name,
        path: name,
        modifiedAt: 0,
        createdAt: null,
        size: 128
      })),
      notes: []
    },
    onClose: vi.fn(),
    onSaved: vi.fn()
  }
  render(<PdfExportDialog {...props} />)
  return props
}
describe('note PDF export dialog', () => {
  it('exports ready snapshot with paper/orientation and displays successful destination', async () => {
    exportNotePdf.mockResolvedValue({ok:true,value:{canceled:false,path:'C:/out/研究.pdf'}})
    const props = mount()
    fireEvent.change(screen.getByLabelText('用紙'), {target:{value:'Letter'}})
    fireEvent.change(screen.getByLabelText('向き'), {target:{value:'landscape'}})
    fireEvent.click(screen.getByRole('button',{name:'保存先を選んで書き出す'}))
    await waitFor(() => expect(exportNotePdf).toHaveBeenCalledWith({suggestedName:'研究.pdf',pageSize:'Letter',landscape:true}))
    expect(props.onSaved).toHaveBeenCalledWith('C:/out/研究.pdf')
    const root = document.querySelector('.pdf-export-root')!
    expect(root.parentElement).toBe(document.body)
    expect(root.textContent).toContain('未保存の本文')
    expect(root.querySelector('a')?.getAttribute('href')).toBeNull()
    expect(root.querySelector('a[href]')?.getAttribute('href')).toBe('https://example.com')
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('遠隔画像')
    expect(root.textContent).toContain('audio.mp3')
    expect(root.textContent).toContain('clip.webm')
    expect(root.textContent).toContain('reference.pdf')
    expect(root.querySelector('audio, video, iframe, button')).toBeNull()
  })
  it('keeps options after native cancellation and shows failure without closing', async () => {
    exportNotePdf.mockResolvedValueOnce({ok:true,value:{canceled:true}}).mockResolvedValueOnce({ok:false,error:{message:'保存できません',code:'IO_ERROR'}})
    const props = mount()
    const save = screen.getByRole('button',{name:'保存先を選んで書き出す'})
    fireEvent.click(save)
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
    expect(props.onSaved).not.toHaveBeenCalled()
    fireEvent.click(save)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','保存できません')
    expect(props.onClose).not.toHaveBeenCalled()
  })
  it('prepares math and a diagram inside a folded callout before requesting the native PDF', async () => {
    let finishDiagram!: (value: { svg: string }) => void
    mermaidRender.mockImplementation(() => new Promise(resolve => { finishDiagram = resolve }))
    exportNotePdf.mockResolvedValue({ok:true,value:{canceled:true}})
    mount([
      '> [!note]- 展開して出力',
      '> 本文の数式は $x^2$。',
      '>',
      '> ```mermaid',
      '> flowchart LR',
      '>   A[出力]',
      '> ```'
    ].join('\n'))
    const root = document.querySelector('.pdf-export-root')!
    const callout = root.querySelector<HTMLDetailsElement>('details.callout')
    expect(callout?.open).toBe(true)
    expect(callout?.querySelector('.katex math')).not.toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'保存先を選んで書き出す'}))
    await waitFor(() => expect(mermaidRender).toHaveBeenCalledTimes(1))
    expect(exportNotePdf).not.toHaveBeenCalled()

    await act(async () => finishDiagram({svg:'<svg viewBox="0 0 100 100"><text>出力</text></svg>'}))
    await waitFor(() => expect(exportNotePdf).toHaveBeenCalledTimes(1))
    expect(callout?.querySelector('.mermaid-diagram > svg text')?.textContent).toBe('出力')
    expect(callout?.querySelector('.mermaid-diagram button')).toBeNull()
  })
  it('prevents duplicate submission and dismissal during printing, and traps focus', async () => {
    let finish!: (value:unknown)=>void
    exportNotePdf.mockImplementation(() => new Promise(resolve => {finish=resolve}))
    const props = mount()
    const dialog = screen.getByRole('dialog'), close = within(dialog).getByRole('button',{name:'キャンセル'}), save=within(dialog).getByRole('button',{name:'保存先を選んで書き出す'})
    close.focus(); fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true}); expect(document.activeElement).toBe(save)
    fireEvent.click(save); fireEvent.click(save)
    fireEvent.keyDown(dialog,{key:'Escape'})
    await waitFor(() => expect(exportNotePdf).toHaveBeenCalledTimes(1))
    expect(props.onClose).not.toHaveBeenCalled()
    await act(async () => finish({ok:true,value:{canceled:true}}))
    fireEvent.keyDown(dialog,{key:'Escape'}); expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
