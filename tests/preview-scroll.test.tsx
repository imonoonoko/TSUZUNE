// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MarkdownPreview from '../src/renderer/components/MarkdownPreview'
import PaneLayout from '../src/renderer/components/PaneLayout'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('ends the loading status when the image read rejects', async () => {
  vi.stubGlobal('tsuzune',{readVaultImage:vi.fn().mockRejectedValue(new Error('read failed'))})
  render(<MarkdownPreview content="![[image.png]]" notePath="Note.md" onWikiLink={()=>{}}
    attachments={[{path:'image.png',name:'image.png',size:1,modifiedAt:1,createdAt:1}]} />)
  await waitFor(()=>expect(screen.queryByRole('status')).toBeNull())
  expect(screen.getByText('image.png')).toBeTruthy()
})

it('keeps loaded image nodes and reads once across pane scroll updates', async () => {
  const readVaultImage=vi.fn(async () => ({ok:true as const,value:'data:image/png;base64,eA=='}))
  vi.stubGlobal('tsuzune',{readVaultImage})
  function Harness(): React.JSX.Element {
    const [scroll,setScroll]=React.useState({top:0,left:0})
    return <PaneLayout layout={{kind:'pane',paneId:'p'}} activePaneId="p" getScroll={()=>scroll}
      onLayoutChange={()=>{}} onActivePaneChange={()=>{}} onPaneScroll={(_,s)=>setScroll(s)}
      renderPane={()=> <MarkdownPreview content={'# Start\n\n![[image.png]]\n\nEnd'} notePath="Note.md"
        attachments={[{path:'image.png',name:'image.png',size:1,modifiedAt:1,createdAt:1}]}
        onWikiLink={()=>{}} onNavigate={()=>{}} />} />
  }
  render(<Harness />)
  const image=await screen.findByRole('img')
  const preview=screen.getByRole('article')
  for(let i=1;i<=8;i++) { preview.scrollTop=i*100; fireEvent.scroll(preview) }
  await waitFor(()=>expect(screen.getByRole('img')).toBe(image))
  expect(readVaultImage).toHaveBeenCalledTimes(1)
  expect(preview.scrollTop).toBe(800)
  expect(screen.queryByRole('status')).toBeNull()
})

it('keeps link preview focus while callbacks change, and uses the latest callback', async () => {
  const first=vi.fn(),next=vi.fn()
  const props={content:'[[Target]]',notePath:'Note.md',attachments:[],notes:[{path:'Target.md',name:'Target',content:'# Target\nBody',size:14,modifiedAt:1}]}
  const {rerender}=render(<MarkdownPreview {...props} onWikiLink={first} />)
  const link=screen.getByRole('link',{name:'Target'});act(()=>link.focus())
  expect(screen.getByRole('button',{name:'開く'})).toBeTruthy()
  rerender(<MarkdownPreview {...props} onWikiLink={next} />)
  expect(screen.getByRole('link',{name:'Target'})).toBe(link)
  expect(document.activeElement).toBe(link)
  fireEvent.click(link)
  expect(next).toHaveBeenCalledWith('Target')
  expect(first).not.toHaveBeenCalled()
})
