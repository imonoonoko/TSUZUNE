// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PdfReader from '../src/renderer/components/PdfReader'

const fake = vi.hoisted(() => ({ viewers: [] as any[], ports: [] as any[], tasks: [] as any[], pages: 5, resolveDestroy: null as (() => void) | null, defer: false }))
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'worker.mjs' }))
vi.mock('pdfjs-dist/web/pdf_viewer.css?inline', () => ({ default: '' }))
vi.mock('pdfjs-dist', () => ({
  AnnotationMode: { DISABLE: 0 }, PDFWorker: { create: () => ({ destroy: vi.fn() }) },
  getDocument: () => { const task = { promise: Promise.resolve({ numPages: fake.pages }), destroy: vi.fn(() => fake.defer ? new Promise<void>(resolve => { fake.resolveDestroy = resolve }) : Promise.resolve()) }; fake.tasks.push(task); return task }
}))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class { listeners = new Map(); on(name: string, listener: Function) { this.listeners.set(name, listener) } dispatch(name: string, data: any) { this.listeners.get(name)?.(data) } },
  PDFLinkService: class { setViewer() {} setDocument() {} }, PDFFindController: class {},
  PDFViewer: class {
    pagesCount = 0; page = 1
    constructor(public options: any) { fake.viewers.push(this) }
    get currentPageNumber() { return this.page }
    set currentPageNumber(value: number) { if (value === this.page) return; this.page = value; this.options.eventBus.dispatch('pagechanging', { pageNumber: value }) }
    setDocument(doc: any) { if (doc) { this.pagesCount = doc.numPages; this.options.eventBus.dispatch('pagesinit', {}) } }
  }
}))
beforeEach(() => {
  fake.viewers = []; fake.ports = []; fake.tasks = []; fake.pages = 5; fake.defer = false; fake.resolveDestroy = null
  vi.stubGlobal('Worker', class { terminate = vi.fn(); constructor() { fake.ports.push(this) } })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('tsuzune', { readVaultPdf: vi.fn(async () => ({ ok: true, value: new Uint8Array([1]) })), copyText: vi.fn(async () => ({ ok: true, value: null })) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('offers only read-only paging in compact cards and clamps the page input', async () => {
  render(<PdfReader path="paper.pdf" compact />)
  await waitFor(() => expect(screen.getByLabelText('PDF総ページ数').textContent).toBe('/ 5'))
  expect((screen.getByRole('button', { name: '前ページ' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByLabelText('PDF内を検索')).toBeNull()
  expect(screen.queryByRole('button', { name: 'ページリンクをコピー' })).toBeNull()
  expect(screen.queryByRole('button', { name: '外部アプリで開く' })).toBeNull()
  const input = screen.getByLabelText('PDFページ')
  fireEvent.change(input, { target: { value: '99' } }); fireEvent.blur(input)
  expect((input as HTMLInputElement).value).toBe('5')
  expect((screen.getByRole('button', { name: '次ページ' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '前ページ' }))
  expect((input as HTMLInputElement).value).toBe('4')
})
it('discards a PDF read after unmounting for a Vault switch', async () => {
  let resolve!: (result: unknown) => void
  vi.mocked(window.tsuzune.readVaultPdf).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const view = render(<PdfReader path="paper.pdf" compact />)
  view.unmount()
  resolve({ ok: true, value: new Uint8Array([1]) })
  await waitFor(() => expect(fake.ports[0].terminate).toHaveBeenCalledOnce())
  expect(fake.tasks).toHaveLength(0)
})
it('loads the same attachment path again when its expected Vault changes', async () => {
  const read = vi.mocked(window.tsuzune.readVaultPdf)
  const view = render(<PdfReader path="paper.pdf" expectedRoot="vault-one" />)
  await waitFor(() => expect(read).toHaveBeenLastCalledWith('paper.pdf', 'vault-one'))
  view.rerender(<PdfReader path="paper.pdf" expectedRoot="vault-two" />)
  await waitFor(() => expect(read).toHaveBeenLastCalledWith('paper.pdf', 'vault-two'))
  expect(read).toHaveBeenCalledTimes(2)
})
it('refits a compact PDF after its card is resized while retaining the current page', async () => {
  let resize!: () => void
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect = disconnect })
  const view = render(<PdfReader path="paper.pdf" compact />)
  await waitFor(() => expect(screen.getByLabelText('PDF総ページ数').textContent).toBe('/ 5'))
  fireEvent.click(screen.getByRole('button', { name: '次ページ' }))
  fake.viewers[0].currentScaleValue = 'old-card-width'
  expect(resize).toBeTypeOf('function')
  resize()
  expect(fake.viewers[0].currentScaleValue).toBe('page-width')
  expect((screen.getByLabelText('PDFページ') as HTMLInputElement).value).toBe('2')
  view.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
it('resets current page on PDF switch and copies the page actually shown after clamping', async () => {
  const result = render(<PdfReader path="a.pdf" page={5} />)
  await waitFor(() => expect((screen.getByLabelText('PDFページ') as HTMLInputElement).value).toBe('5'))
  fake.pages = 1
  result.rerender(<PdfReader path="b.pdf" page={99} />)
  await waitFor(() => expect(screen.getByLabelText('PDF総ページ数').textContent).toBe('/ 1'))
  expect((screen.getByLabelText('PDFページ') as HTMLInputElement).value).toBe('1')
  fireEvent.click(screen.getByRole('button', { name: 'ページリンクをコピー' }))
  await waitFor(() => expect(window.tsuzune.copyText).toHaveBeenCalledWith('[b.pdf · p.1](/b.pdf#page=1)'))
})
it('waits for document cleanup and aborts the viewer before terminating its worker', async () => {
  fake.defer = true
  const result = render(<PdfReader path="a.pdf" />)
  await waitFor(() => expect(screen.getByLabelText('PDF総ページ数').textContent).toBe('/ 5'))
  result.unmount()
  expect(fake.tasks[0].destroy).toHaveBeenCalledTimes(1)
  expect(fake.ports[0].terminate).not.toHaveBeenCalled()
  expect(fake.viewers[0].options.abortSignal.aborted).toBe(true)
  fake.resolveDestroy!()
  await waitFor(() => expect(fake.ports[0].terminate).toHaveBeenCalledTimes(1))
})
it('copies selected text with its starting page and search fragment', async () => {
  render(<PdfReader path="paper.pdf" />)
  await waitFor(() => expect(screen.getByLabelText('PDF総ページ数').textContent).toBe('/ 5'))
  const page = document.createElement('div'); page.dataset.pageNumber = '2'; page.textContent = '選択した文'
  document.querySelector('.pdfViewer')!.append(page)
  const range = document.createRange(); range.selectNodeContents(page)
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  fireEvent(document, new Event('selectionchange'))
  fireEvent.click(screen.getByRole('button', { name: '選択文を引用' }))
  await waitFor(() => expect(window.tsuzune.copyText).toHaveBeenCalledWith('> 選択した文\n\n[paper.pdf · p.2](/paper.pdf#page=2&search=' + encodeURIComponent('選択した文') + ')'))
})
