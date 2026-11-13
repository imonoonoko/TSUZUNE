import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import type { CanvasData, CanvasNode } from '../../shared/canvas'
import './CanvasView.css'

interface Props {
  data: CanvasData
  disabled: boolean
  status: string
  filePaths: string[]
  renderFile?(path: string): ReactNode
  onChange(data: CanvasData): void
  onOpenFile(path: string): void
  onSave(): void
}

type Position = { x: number; y: number }
const MAX_HISTORY = 100
const NODE_TYPES = new Set(['text', 'file', 'link', 'group'])
const makeId = (): string => crypto.randomUUID()
const titleOf = (node: CanvasNode): string => node.type === 'text' ? (node.text.split('\n')[0] || 'テキスト')
  : node.type === 'file' ? node.file : node.type === 'link' ? 'Webリンク' : (node.label || 'グループ')

export default function CanvasView({ data, disabled, status, filePaths, renderFile, onChange, onOpenFile, onSave }: Props) {
  const history = useRef<CanvasData[]>([])
  const future = useRef<CanvasData[]>([])
  const current = useRef(data)
  current.current = data
  const [selected, setSelected] = useState<string | null>(null)
  const [filePath, setFilePath] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [drag, setDrag] = useState<{ id: string; originX: number; originY: number; nodeX: number; nodeY: number } | null>(null)
  const [preview, setPreview] = useState<Position | null>(null)
  const selectedNode = data.nodes.find(node => node.id === selected) ?? null

  const commit = (next: CanvasData): void => {
    history.current = [...history.current, current.current].slice(-MAX_HISTORY)
    future.current = []
    onChange(next)
  }
  const undo = (): void => {
    const previous = history.current.pop()
    if (!previous) return
    future.current = [...future.current, current.current]
    onChange(previous)
  }
  const redo = (): void => {
    const next = future.current.pop()
    if (!next) return
    history.current = [...history.current, current.current].slice(-MAX_HISTORY)
    onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLocaleLowerCase()
    const target = event.target as HTMLElement
    const inTextInput = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    if (key === 's') { event.preventDefault(); event.stopPropagation(); if (!disabled) onSave() }
    else if (!inTextInput && key === 'z') { event.preventDefault(); event.stopPropagation(); if (!disabled) event.shiftKey ? redo() : undo() }
    else if (!inTextInput && key === 'y') { event.preventDefault(); event.stopPropagation(); if (!disabled) redo() }
  }

  const addText = (): void => {
    if (disabled) return
    const node: CanvasNode = { id: makeId(), type: 'text', x: 60, y: 60, width: 280, height: 180, text: '' }
    commit({ ...data, nodes: [...data.nodes, node] }); setSelected(node.id)
  }
  const minX = Math.min(0, ...data.nodes.map(node => node.x))
  const minY = Math.min(0, ...data.nodes.map(node => node.y))
  const maxX = Math.max(1200, ...data.nodes.map(node => node.x + node.width))
  const maxY = Math.max(800, ...data.nodes.map(node => node.y + node.height))
  const offsetX = 80 - minX
  const offsetY = 80 - minY
  const addFile = (path = filePath, x = 80, y = 80): void => {
    if (disabled || !filePaths.includes(path)) return
    const node: CanvasNode = { id: makeId(), type: 'file', x, y, width: 280, height: 150, file: path }
    commit({ ...data, nodes: [...data.nodes, node] }); setSelected(node.id); setFilePath('')
  }
  const updateNode = (id: string, patch: Partial<CanvasNode>): void => {
    if (disabled) return
    commit({ ...data, nodes: data.nodes.map(node => node.id === id ? { ...node, ...patch } as CanvasNode : node) })
  }
  const remove = (): void => {
    if (disabled || !selectedNode) return
    commit({ nodes: data.nodes.filter(node => node.id !== selectedNode.id), edges: data.edges.filter(edge => edge.fromNode !== selectedNode.id && edge.toNode !== selectedNode.id) })
    setSelected(null)
  }
  const addEdge = (): void => {
    if (disabled || !data.nodes.some(node => node.id === from) || !data.nodes.some(node => node.id === to)) return
    commit({ ...data, edges: [...data.edges, { id: makeId(), fromNode: from, toNode: to, fromEnd: 'none', toEnd: 'arrow' }] })
  }
  const drop = (event: DragEvent): void => {
    event.preventDefault()
    if (disabled) return
    const path = event.dataTransfer.getData('application/x-tsuzune-vault-file')
    if (filePaths.includes(path)) {
      const bounds = event.currentTarget.querySelector('.canvas-board')?.getBoundingClientRect()
      if (!bounds || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
      addFile(path, Math.round(event.clientX - bounds.left - offsetX), Math.round(event.clientY - bounds.top - offsetY))
    }
  }
  const boardPosition = (node: CanvasNode): Position => drag?.id === node.id && preview ? preview : { x: node.x, y: node.y }

  return <div className="canvas-editor" role="region" aria-label="Canvasエディター" onKeyDown={onKeyDown}>
    <div className="canvas-toolbar" aria-label="Canvas操作">
      <button type="button" disabled={disabled} onClick={addText}>テキストカードを追加</button>
      <label>ノート・添付ファイル<select aria-label="Canvasに追加するファイル" value={filePath} disabled={disabled} onChange={event => { const path = event.target.value; setFilePath(path); if (path) addFile(path) }}>
        <option value="">ファイルを選択</option>{filePaths.map(path => <option key={path} value={path}>{path}</option>)}
      </select></label>
      <button type="button" disabled={disabled || !selectedNode} onClick={remove}>カードを削除</button>
      <button type="button" disabled={disabled || history.current.length === 0} onClick={undo}>元に戻す</button>
      <button type="button" disabled={disabled || future.current.length === 0} onClick={redo}>やり直す</button>
      <button type="button" disabled={disabled} onClick={onSave}>保存</button>
      <span role="status">{status}</span>
    </div>
    <div className="canvas-editor-body">
      <div className="canvas-board-scroll" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-tsuzune-vault-file')) event.preventDefault() }} onDrop={drop}>
        <div className="canvas-board" aria-label="Canvasカード配置領域" style={{ width: Math.min(2_000_000, maxX - minX + 160), height: Math.min(2_000_000, maxY - minY + 160) }}>
          <svg className="canvas-edges" aria-hidden="true" viewBox={`0 0 ${Math.min(2_000_000, maxX - minX + 160)} ${Math.min(2_000_000, maxY - minY + 160)}`} preserveAspectRatio="none">
            {data.edges.map(edge => {
              const start = data.nodes.find(node => node.id === edge.fromNode), end = data.nodes.find(node => node.id === edge.toNode)
              if (!start || !end) return null
              const a = boardPosition(start), b = boardPosition(end)
              return <line key={edge.id} x1={a.x + start.width / 2 + offsetX} y1={a.y + start.height / 2 + offsetY} x2={b.x + end.width / 2 + offsetX} y2={b.y + end.height / 2 + offsetY} />
            })}
          </svg>
          {data.nodes.filter(node => NODE_TYPES.has(node.type)).map(node => {
            const position = boardPosition(node)
            return <article key={node.id} className={`canvas-card canvas-card-${node.type}${selected === node.id ? ' is-selected' : ''}`} style={{ left: position.x + offsetX, top: position.y + offsetY, width: Math.min(node.width, 700), minHeight: Math.min(node.height, 500) }}
              onPointerDown={event => { if (disabled || event.button !== 0 || (event.target as HTMLElement).closest('textarea,button,a,input,select')) return; setSelected(node.id); setDrag({ id: node.id, originX: event.clientX, originY: event.clientY, nodeX: node.x, nodeY: node.y }); setPreview({ x: node.x, y: node.y }); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) }}
              onPointerMove={event => { if (!drag || drag.id !== node.id) return; setPreview({ x: drag.nodeX + event.clientX - drag.originX, y: drag.nodeY + event.clientY - drag.originY }) }}
              onPointerUp={() => { if (drag?.id !== node.id || !preview) return; if (preview.x !== node.x || preview.y !== node.y) updateNode(node.id, { x: Math.round(preview.x), y: Math.round(preview.y) }); setDrag(null); setPreview(null) }}>
              <header>{titleOf(node)}</header>
              {node.type === 'text' ? <textarea aria-label="Canvasテキストカード" value={node.text} disabled={disabled} onChange={event => updateNode(node.id, { text: event.target.value })} /> : null}
              {node.type === 'file' ? <><button type="button" className="canvas-file-link" disabled={disabled} onClick={() => onOpenFile(node.file)}>{node.file}{node.subpath ?? ''}</button>{renderFile?.(node.file)}</> : null}
              {node.type === 'link' ? <p>Webリンク（プレビューなし）<br />{node.url}</p> : null}
              {node.type === 'group' ? <p>{node.label || 'グループ'}</p> : null}
            </article>
          })}
        </div>
      </div>
      <aside className="canvas-inspector" aria-label="Canvas編集">
        <fieldset disabled={disabled || data.edges.length >= 1000}><legend>カードをつなぐ</legend>
          <label>接続元<select value={from} onChange={event => setFrom(event.target.value)}><option value="">選択</option>{data.nodes.map(node => <option key={node.id} value={node.id}>{titleOf(node)}</option>)}</select></label>
          <label>接続先<select value={to} onChange={event => setTo(event.target.value)}><option value="">選択</option>{data.nodes.map(node => <option key={node.id} value={node.id}>{titleOf(node)}</option>)}</select></label>
          <button type="button" disabled={!from || !to} onClick={addEdge}>接続を追加</button>
        </fieldset>
        {selectedNode ? <fieldset disabled={disabled}><legend>選択したカード</legend>
          <label>X座標<input type="number" min={-1000000} max={1000000} value={selectedNode.x} onChange={event => updateNode(selectedNode.id, { x: Number(event.target.value) })} /></label>
          <label>Y座標<input type="number" min={-1000000} max={1000000} value={selectedNode.y} onChange={event => updateNode(selectedNode.id, { y: Number(event.target.value) })} /></label>
          {selectedNode.type === 'group' ? <label>グループ名<input value={selectedNode.label ?? ''} onChange={event => updateNode(selectedNode.id, { label: event.target.value })} /></label> : null}
        </fieldset> : <p>カードを選ぶか、ファイル一覧からここへドラッグします。</p>}
      </aside>
    </div>
  </div>
}
