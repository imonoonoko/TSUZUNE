import React, { useEffect, useMemo, useRef, useState } from 'react'
import './CanvasView.css'
import type { CanvasData, CanvasEdge, CanvasNode } from '../../shared/canvas'
import { canvasAlign, canvasDistribute, canvasFit, canvasResize, canvasTranslate, canvasZoomAt, type CanvasViewTransform } from '../canvas-geometry'
import { renderCanvasPng } from '../canvas-png'

export interface CanvasViewProps {
  data: CanvasData
  disabled: boolean
  status: string
  filePaths: string[]
  onChange: (data: CanvasData) => void
  onOpenFile: (path: string) => void
  onSave: () => void
  renderFile?: (path: string, subpath?: string, nodeId?: string) => React.ReactNode
  renderText?: (text: string, nodeId?: string) => React.ReactNode
  readOnly?: boolean
  onExportPng?: (png: string) => Promise<{ canceled: true } | { canceled: false; path: string }>
}

const id = () => globalThis.crypto?.randomUUID?.() ?? `canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export default function CanvasView({ data, disabled, status, filePaths, onChange, onOpenFile, onSave, renderFile, renderText, readOnly = false, onExportPng }: CanvasViewProps) {
  const rootRef = useRef<HTMLDivElement>(null), boardRef = useRef<HTMLDivElement>(null), worldRef = useRef<HTMLDivElement>(null)
  const [selection, setSelected] = useState<string[]>([]), [view, setView] = useState<CanvasViewTransform>({ x: 40, y: 40, zoom: 1 })
  const selected = selection.filter(id => data.nodes.some(node => node.id === id))
  const [edgeFrom, setEdgeFrom] = useState(''), [edgeTo, setEdgeTo] = useState('')
  const [undo, setUndo] = useState<CanvasData[]>([]), [redo, setRedo] = useState<CanvasData[]>([])
  const [notice, setNotice] = useState('')
  const [pngRange, setPngRange] = useState<'all' | 'viewport'>('all'), [pngScale, setPngScale] = useState<1 | 2>(1), [includeContent, setIncludeContent] = useState(true), [exporting, setExporting] = useState(false)
  const [previewSizes, setPreviewSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [panStart, setPanStart] = useState<{ x: number; y: number; viewX: number; viewY: number } | null>(null)
  const canEdit = !disabled && !readOnly
  const atNodeLimit = data.nodes.length >= 500
  const cancelGesture = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelGesture.current?.(), [])
  const watchPointer = (pointerId: number, move: (event: PointerEvent) => void, finish: (event: PointerEvent) => void, clear: () => void): void => {
    cancelGesture.current?.()
    const onMove = (event: PointerEvent): void => { if (event.pointerId === pointerId) move(event) }
    const onUp = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return
      cleanup()
      finish(event)
    }
    const onCancel = (event: PointerEvent): void => { if (event.pointerId === pointerId) cancel() }
    const cleanup = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', cancel)
      cancelGesture.current = null
    }
    const cancel = (): void => { cleanup(); clear() }
    cancelGesture.current = cancel
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', cancel)
  }
  const extents = useMemo(() => {
    if (!data.nodes.length) return { minX: 0, minY: 0, width: 1200, height: 800 }
    const minX = Math.min(...data.nodes.map(n => n.x)), minY = Math.min(...data.nodes.map(n => n.y))
    const maxX = Math.max(...data.nodes.map(n => n.x + n.width)), maxY = Math.max(...data.nodes.map(n => n.y + n.height))
    return { minX, minY, width: Math.max(1200, maxX - minX + 160), height: Math.max(800, maxY - minY + 160) }
  }, [data.nodes])
  const origin = { x: 80 - extents.minX, y: 80 - extents.minY }
  const push = (next: CanvasData) => { setUndo(history => [...history.slice(-99), data]); setRedo([]); onChange(next) }
  const changeNode = (nodeId: string, patch: Partial<CanvasNode>) => push({ ...data, nodes: data.nodes.map(node => node.id === nodeId ? { ...node, ...patch } as CanvasNode : node) })
  const add = (node: CanvasNode) => { if (!canEdit || atNodeLimit) return; push({ ...data, nodes: [...data.nodes, node] }); setSelected([node.id]) }
  const undoOnce = () => { const previous = undo.at(-1); if (!previous || !canEdit) return; setUndo(undo.slice(0, -1)); setRedo(items => [...items, data]); onChange(previous) }
  const redoOnce = () => { const next = redo.at(-1); if (!next || !canEdit) return; setRedo(redo.slice(0, -1)); setUndo(items => [...items, data]); onChange(next) }
  const point = (event: { clientX: number; clientY: number }) => { const rect = boardRef.current?.getBoundingClientRect(); return { x: (event.clientX - (rect?.left ?? 0) - view.x) / view.zoom - origin.x, y: (event.clientY - (rect?.top ?? 0) - view.y) / view.zoom - origin.y } }
  const startMove = (event: React.PointerEvent, node: CanvasNode) => {
    if (!canEdit || event.button !== 0 || (event.target as HTMLElement).closest('textarea,button,a,input,select,[role="button"]')) return
    event.preventDefault()
    const start = point(event), initial = data.nodes
    const modifier = event.shiftKey || event.ctrlKey || event.metaKey
    const wasSelected = selected.includes(node.id)
    const ids = modifier ? (wasSelected ? [node.id] : [...selected, node.id]) : wasSelected ? selected : [node.id]
    if (modifier) setSelected(wasSelected ? selected.filter(id => id !== node.id) : [...selected, node.id])
    else if (!wasSelected) setSelected([node.id])
    const move = (next: PointerEvent) => { const p = point(next); const dx = (p.x - start.x), dy = (p.y - start.y); setPreviewNodes(canvasTranslate(initial, ids, dx, dy)) }
    watchPointer(event.pointerId, move, next => {
      const p = point(next)
      const result = canvasTranslate(initial, ids, p.x - start.x, p.y - start.y)
      setPreviewNodes(null)
      if (result.some((item, index) => item.x !== initial[index].x || item.y !== initial[index].y)) push({ ...data, nodes: result })
    }, () => setPreviewNodes(null))
  }
  const [previewNodes, setPreviewNodes] = useState<CanvasNode[] | null>(null)
  const nodes = previewNodes ?? data.nodes
  const startResize = (event: React.PointerEvent, node: CanvasNode) => {
    if (!canEdit || event.button !== 0) return; event.preventDefault(); event.stopPropagation()
    const startX = event.clientX, startY = event.clientY, initial = node
    const move = (next: PointerEvent) => setPreviewSizes(s => ({ ...s, [node.id]: canvasResize(initial, initial.width + (next.clientX - startX) / view.zoom, initial.height + (next.clientY - startY) / view.zoom) }))
    const clearSize = (): void => setPreviewSizes({})
    watchPointer(event.pointerId, move, next => {
      const resized = canvasResize(initial, initial.width + (next.clientX - startX) / view.zoom, initial.height + (next.clientY - startY) / view.zoom)
      if (resized.width !== initial.width || resized.height !== initial.height) push({ ...data, nodes: data.nodes.map(item => item.id === node.id ? resized : item) })
      clearSize()
    }, clearSize)
  }
  const createGroup = () => {
    if (!canEdit || atNodeLimit) return
    const members = data.nodes.filter(node => selected.includes(node.id))
    if (!members.length) return
    const x = Math.max(-1_000_000, Math.min(...members.map(n => n.x)) - 24)
    const y = Math.max(-1_000_000, Math.min(...members.map(n => n.y)) - 48)
    const right = Math.max(...members.map(n => n.x + n.width))
    const bottom = Math.max(...members.map(n => n.y + n.height))
    if (right - x > 100_000 || bottom - y > 100_000) {
      setNotice('カード同士が離れすぎています。位置を近づけてからグループ化してください。')
      return
    }
    setNotice('')
    const group: CanvasNode = { id: id(), type: 'group', x, y, width: Math.min(100_000, right - x + 24), height: Math.min(100_000, bottom - y + 24), label: 'グループ' }
    push({ ...data, nodes: [...data.nodes, group] }); setSelected([group.id])
  }
  const createEmptyGroup = () => { if (canEdit && !atNodeLimit) add({ id: id(), type: 'group', x: 0, y: 0, width: 360, height: 240, label: 'グループ' }) }
  const align = (axis: 'x' | 'y', side: 'start' | 'center' | 'end') => push({ ...data, nodes: canvasAlign(data.nodes, selected, axis, side) })
  const distribute = (axis: 'x' | 'y') => { const result = canvasDistribute(data.nodes, selected, axis); if (result) push({ ...data, nodes: result }) }
  const removeSelected = () => {
    if (!canEdit || !selected.length) return
    const ids = new Set(selected)
    push({ nodes: data.nodes.filter(node => !ids.has(node.id)), edges: data.edges.filter(edge => !ids.has(edge.fromNode) && !ids.has(edge.toNode)) })
    setSelected([])
  }
  const addEdge = () => {
    if (!canEdit || !edgeFrom || !edgeTo || edgeFrom === edgeTo || !data.nodes.some(node => node.id === edgeFrom) || !data.nodes.some(node => node.id === edgeTo) || data.edges.length >= 1000) return
    push({ ...data, edges: [...data.edges, { id: id(), fromNode: edgeFrom, toNode: edgeTo, fromEnd: 'none', toEnd: 'arrow' }] })
  }
  const zoom = (factor: number) => {
    const scroll = rootRef.current?.querySelector('.canvas-board-scroll')
    setView(current => canvasZoomAt(current, factor, { x: (scroll?.scrollLeft ?? 0) + (scroll?.clientWidth ?? 600) / 2, y: (scroll?.scrollTop ?? 0) + (scroll?.clientHeight ?? 400) / 2 }))
  }
  const fitBoard = () => {
    const scroll = rootRef.current?.querySelector('.canvas-board-scroll')
    const fit = canvasFit(data.nodes, { width: scroll?.clientWidth ?? 800, height: scroll?.clientHeight ?? 600 })
    scroll?.scrollTo(0, 0)
    setView({ ...fit, x: fit.x - origin.x * fit.zoom, y: fit.y - origin.y * fit.zoom })
  }
  const exportPng = async () => {
    if (!onExportPng || !worldRef.current || !data.nodes.length || exporting) return
    setExporting(true); setNotice('PNGを準備しています…')
    try {
      const viewportRect = rootRef.current?.querySelector('.canvas-board-scroll')?.getBoundingClientRect()
      const scroll = rootRef.current?.querySelector('.canvas-board-scroll')
      const viewport = pngRange === 'viewport' ? { x: ((scroll?.scrollLeft ?? 0) - view.x) / view.zoom - origin.x, y: ((scroll?.scrollTop ?? 0) - view.y) / view.zoom - origin.y, width: (viewportRect?.width ?? 800) / view.zoom, height: (viewportRect?.height ?? 600) / view.zoom } : undefined
      const png = await renderCanvasPng(worldRef.current, data, { scale: pngScale, viewport, hideContent: !includeContent })
      const result = await onExportPng(png); setNotice(result.canceled ? 'PNGの保存をキャンセルしました。' : `PNGを保存しました: ${result.path}`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'PNGを保存できませんでした。') } finally { setExporting(false) }
  }
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement
    const editing = target.matches('textarea,input,select,[contenteditable="true"]')
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !readOnly) { event.preventDefault(); event.stopPropagation(); if (!disabled) onSave(); return }
    if (editing || !canEdit) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); event.shiftKey ? redoOnce() : undoOnce() }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); event.stopPropagation(); redoOnce() }
    else if (event.key === 'Escape') { setSelected([]) }
  }
  const acceptDrop = (event: React.DragEvent) => {
    event.preventDefault(); if (!canEdit || !boardRef.current) return
    const path = event.dataTransfer.getData('application/x-tsuzune-vault-file')
    if (atNodeLimit || !filePaths.includes(path)) return
    const p = point(event)
    add({ id: id(), type: 'file', file: path, x: clamp(Math.round(p.x), -1_000_000, 1_000_000), y: clamp(Math.round(p.y), -1_000_000, 1_000_000), width: 300, height: 180 })
  }
  const panMove = (event: React.PointerEvent) => {
    if (!panStart || event.buttons !== 1) return
    setView(current => ({ ...current, x: panStart.viewX + event.clientX - panStart.x, y: panStart.viewY + event.clientY - panStart.y }))
  }
  const activeNodes = nodes
  const cardCenter = (node: CanvasNode, side?: string) => {
    const x = node.x + node.width / 2, y = node.y + node.height / 2
    if (side === 'left') return { x: node.x, y }; if (side === 'right') return { x: node.x + node.width, y }; if (side === 'top') return { x, y: node.y }; if (side === 'bottom') return { x, y: node.y + node.height }; return { x, y }
  }
  const cards = <>
    {activeNodes.filter(node => node.type === 'group').map(node => <div key={node.id} className={`canvas-card canvas-card-group canvas-group-frame ${selected.includes(node.id) ? 'is-selected' : ''}`} style={{ left: node.x + origin.x, top: node.y + origin.y, width: node.width, height: node.height, zIndex: 0 }} onPointerDown={e => startMove(e, node)}>
      <header>{node.label || 'グループ'}</header>{selected.includes(node.id) && canEdit && <div className="canvas-group-tools"><label>グループ名<input aria-label="グループ名" value={node.label ?? ''} onChange={e => changeNode(node.id, { label: e.target.value })} /></label></div>}
    </div>)}
    {activeNodes.filter(node => node.type !== 'group').map(node => {
      const size = previewSizes[node.id], width = size?.width ?? node.width, height = size?.height ?? node.height
      return <div key={node.id} data-node-id={node.id} className={`canvas-card canvas-card-${node.type} ${selected.includes(node.id) ? 'is-selected' : ''}`} style={{ left: node.x + origin.x, top: node.y + origin.y, width, height }} onPointerDown={e => startMove(e, node)}>
        <header>{node.type === 'file' ? node.file : node.type === 'link' ? 'Webリンク' : 'テキスト'}</header>
        {node.type === 'text' && <div className="canvas-card-content">{readOnly ? renderText?.(node.text, node.id) ?? <p>{node.text}</p> : <><textarea aria-label="Canvasテキストカード" value={node.text} disabled={disabled} onChange={e => changeNode(node.id, { text: e.target.value })} />{node.text.includes('![[') ? renderText?.(node.text, node.id) : null}</>}</div>}
        {node.type === 'file' && <div className="canvas-card-content"><button className="canvas-file-link" onClick={() => onOpenFile(node.file)}>{node.file}{node.subpath ? ` ${node.subpath}` : ''}</button>{renderFile?.(node.file, node.subpath, node.id)}</div>}
        {node.type === 'link' && <div className="canvas-card-content"><p>Webリンク（プレビューなし）</p><p>{node.url}</p></div>}
        {selected.includes(node.id) && canEdit && <div className="canvas-resize" role="button" aria-label="カードのサイズ変更" onPointerDown={e => startResize(e, node)} />}
      </div>
    })}
  </>
  return <div ref={rootRef} className={`canvas-editor${readOnly ? ' canvas-readonly' : ''}`} role="region" aria-label={readOnly ? 'Canvasプレビュー（読み取り専用）' : 'Canvasエディター'} onKeyDown={handleKeyDown}>
    <div className={readOnly ? 'canvas-preview-toolbar' : 'canvas-toolbar'}>
      {!readOnly && <><button disabled={!canEdit || atNodeLimit} onClick={() => add({ id: id(), type: 'text', x: 0, y: 0, width: 280, height: 180, text: '' })}>テキストカードを追加</button>
      <label>Canvasに追加するファイル<select aria-label="Canvasに追加するファイル" value="" disabled={!canEdit || atNodeLimit} onChange={e => { const path = e.target.value; if (filePaths.includes(path)) add({ id: id(), type: 'file', file: path, x: 0, y: 0, width: 300, height: 180 }) }}><option value="">ファイルを選択</option>{filePaths.map(path => <option key={path} value={path}>{path}</option>)}</select></label>
      <button disabled={!canEdit || atNodeLimit} onClick={createEmptyGroup}>グループを追加</button>
      <button disabled={!canEdit || selected.length === 0 || atNodeLimit} onClick={createGroup}>グループ化</button>
      <button disabled={!canEdit || !selected.length} onClick={removeSelected}>選択カードを削除</button>
      <button disabled={!canEdit || undo.length === 0} aria-label="元に戻す" onClick={undoOnce}>元に戻す</button><button disabled={!canEdit || redo.length === 0} onClick={redoOnce}>やり直す</button>
      <button disabled={disabled} onClick={onSave}>保存</button>
      <button disabled={selected.length < 2 || !canEdit} onClick={() => align('x', 'start')}>左揃え</button><button disabled={selected.length < 2 || !canEdit} onClick={() => align('x', 'end')}>右揃え</button>
      <button disabled={selected.length < 2 || !canEdit} onClick={() => align('y', 'start')}>上揃え</button><button disabled={selected.length < 2 || !canEdit} onClick={() => align('y', 'end')}>下揃え</button>
      <button disabled={selected.length < 3 || !canEdit} onClick={() => distribute('x')}>横方向に等間隔</button><button disabled={selected.length < 3 || !canEdit} onClick={() => distribute('y')}>縦方向に等間隔</button></>}
      {!readOnly && <button disabled={!data.nodes.length} onClick={() => setSelected(data.nodes.map(node => node.id))}>全選択</button>}
      <button aria-label="縮小" onClick={() => zoom(1 / 1.1)}>−</button><output aria-live="polite">{Math.round(view.zoom * 100)}%</output><button aria-label="拡大" onClick={() => zoom(1.1)}>＋</button>
      <button onClick={fitBoard}>全体を表示</button>
      {onExportPng && <><label>PNG出力範囲<select aria-label="PNG出力範囲" value={pngRange} onChange={e => setPngRange(e.target.value as 'all' | 'viewport')}><option value="all">全体</option><option value="viewport">表示範囲</option></select></label>
      <label>PNG倍率<select aria-label="PNG倍率" value={pngScale} onChange={e => setPngScale(Number(e.target.value) as 1 | 2)}><option value={1}>1倍</option><option value={2}>2倍</option></select></label>
      <label><input type="checkbox" checked={includeContent} onChange={e => setIncludeContent(e.target.checked)} />カード内容を含める</label>
      <button disabled={!onExportPng || !data.nodes.length || exporting} onClick={() => void exportPng()}>{exporting ? 'PNG作成中…' : 'PNGで保存'}</button>
      </>}
      <span role="status">{notice || status}</span>
    </div>
    <div className="canvas-editor-body">
      <div className="canvas-board-scroll" onDragOver={e => { if (e.dataTransfer.types.includes('application/x-tsuzune-vault-file')) e.preventDefault() }} onDrop={acceptDrop}>
        <div ref={boardRef} className="canvas-board" style={{ width: extents.width, height: extents.height }} onPointerDown={e => {
          if (e.button !== 0 || (e.target !== e.currentTarget && e.target !== worldRef.current)) return
          setSelected([])
          setPanStart({ x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y })
        }} onPointerMove={panMove} onPointerUp={() => setPanStart(null)} onPointerLeave={() => setPanStart(null)}>
          <div className="canvas-world" ref={worldRef} data-origin-x={origin.x} data-origin-y={origin.y} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transformOrigin: '0 0', transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
            <svg className="canvas-edges" aria-hidden="true">{data.edges.map((edge: CanvasEdge) => { const from = activeNodes.find(n => n.id === edge.fromNode), to = activeNodes.find(n => n.id === edge.toNode); if (!from || !to) return null; const a = cardCenter(from, edge.fromSide), b = cardCenter(to, edge.toSide); return <g key={edge.id}><line x1={a.x + origin.x} y1={a.y + origin.y} x2={b.x + origin.x} y2={b.y + origin.y} data-export-stroke={edge.color} />{edge.label && <text className="canvas-edge-label" x={(a.x + b.x) / 2 + origin.x} y={(a.y + b.y) / 2 + origin.y}>{edge.label}</text>}</g> })}</svg>
            {cards}
            {!data.nodes.length && <p className="canvas-empty-state">{readOnly ? '空のCanvasです。' : 'カードがありません。テキストカードを追加するか、ノート一覧からファイルをドラッグしてください。'}</p>}
          </div>
        </div>
      </div>
      {!readOnly && <aside className="canvas-inspector"><h3>選択中</h3>{selected.length ? <p>{selected.length}件</p> : <p>カードを選択してください</p>}
        <fieldset disabled={!canEdit || data.edges.length >= 1000}><legend>カードをつなぐ</legend>
          <label>接続元<select aria-label="接続元" value={edgeFrom} onChange={e => setEdgeFrom(e.target.value)}><option value="">選択</option>{data.nodes.map(node => <option key={node.id} value={node.id}>{node.type === 'file' ? node.file : node.type === 'link' ? node.url : node.type === 'group' ? node.label || 'グループ' : node.text.split('\n')[0] || 'テキスト'}</option>)}</select></label>
          <label>接続先<select aria-label="接続先" value={edgeTo} onChange={e => setEdgeTo(e.target.value)}><option value="">選択</option>{data.nodes.map(node => <option key={node.id} value={node.id}>{node.type === 'file' ? node.file : node.type === 'link' ? node.url : node.type === 'group' ? node.label || 'グループ' : node.text.split('\n')[0] || 'テキスト'}</option>)}</select></label>
          <button disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo} onClick={addEdge}>接続を追加</button>
        </fieldset>
        {selected.length === 1 && (() => { const node = data.nodes.find(n => n.id === selected[0]); return node?.type === 'text' ? <label>テキスト<textarea aria-label="選択カードのテキスト" value={node.text} disabled={!canEdit} onChange={e => changeNode(node.id, { text: e.target.value })} /></label> : node?.type === 'group' ? <label>グループ名<input value={node.label ?? ''} disabled={!canEdit} onChange={e => changeNode(node.id, { label: e.target.value })} /></label> : null })()}
      </aside>}
    </div>
  </div>
}
