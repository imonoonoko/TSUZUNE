// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { preparePdfContent, waitForPdfReady } from '../src/renderer/pdf-export'
afterEach(() => { document.body.innerHTML=''; vi.useRealTimers() })
describe('PDF preview readiness', () => {
  it('waits until diagram and image loading have both finished', async () => {
    vi.useFakeTimers()
    const root=document.createElement('section'); root.innerHTML='<details class="callout"><summary>Hidden</summary><div class="mermaid-diagram" role="status">描画中</div><span class="vault-image-status">読込中</span></details>'; document.body.append(root)
    let complete=false; const result=waitForPdfReady(root,{timeoutMs:1000}).then(()=>{complete=true})
    expect(root.querySelector('details')!.open).toBe(true)
    await vi.advanceTimersByTimeAsync(100); expect(complete).toBe(false)
    root.querySelector('.mermaid-diagram')!.removeAttribute('role')
    await vi.advanceTimersByTimeAsync(100); expect(complete).toBe(false)
    root.querySelector('.vault-image-status')!.remove()
    await vi.advanceTimersByTimeAsync(100); await result; expect(complete).toBe(true)
  })
  it('rejects a stuck renderer or aborted export before invoking native printing', async () => {
    vi.useFakeTimers()
    const root=document.createElement('section');root.innerHTML='<div class="mermaid-diagram" role="status"></div>'
    const result=expect(waitForPdfReady(root,{timeoutMs:100})).rejects.toThrow(/準備/)
    await vi.advanceTimersByTimeAsync(100); await result
    const controller=new AbortController(); const aborted=waitForPdfReady(root,{signal:controller.signal})
    const check=expect(aborted).rejects.toThrow(/中止/);controller.abort();await check
  })
  it('waits for image decode and rejects broken images', async () => {
    const root=document.createElement('section');const img=document.createElement('img');root.append(img)
    Object.defineProperty(img,'complete',{value:true});Object.defineProperty(img,'naturalWidth',{value:40});img.decode=vi.fn(async()=>{})
    await waitForPdfReady(root);expect(img.decode).toHaveBeenCalledOnce()
    const broken=document.createElement('img');root.append(broken)
    await expect(waitForPdfReady(root)).rejects.toThrow(/画像/)
  })
  it('opens callouts and removes local link destinations without losing text or external links', () => {
    const root=document.createElement('section');root.innerHTML='<details class="callout"><summary>Title</summary>Body</details><a href="file:///secret.md">Local</a><a href="https://example.com">Web</a>'
    preparePdfContent(root)
    expect(root.querySelector('details')!.open).toBe(true)
    expect(root.querySelector('a')!.outerHTML).toBe('<a>Local</a>')
    expect(root.querySelectorAll('a')[1].href).toBe('https://example.com/')
  })
})
