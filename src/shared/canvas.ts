export type CanvasColor = string
export type CanvasSide = 'top' | 'right' | 'bottom' | 'left'
interface CanvasNodeBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: CanvasColor
}
export interface CanvasTextNode extends CanvasNodeBase { type: 'text'; text: string }
export interface CanvasFileNode extends CanvasNodeBase { type: 'file'; file: string; subpath?: string }
export interface CanvasLinkNode extends CanvasNodeBase { type: 'link'; url: string }
export interface CanvasGroupNode extends CanvasNodeBase {
  type: 'group'; label?: string; background?: string; backgroundStyle?: 'cover' | 'ratio' | 'repeat'
}
export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode
export interface CanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide?: CanvasSide
  toSide?: CanvasSide
  fromEnd?: 'none' | 'arrow'
  toEnd?: 'none' | 'arrow'
  color?: CanvasColor
  label?: string
}
export interface CanvasData { nodes: CanvasNode[]; edges: CanvasEdge[] }
export interface CanvasDocument { path: string; content: string; modifiedAt: number; revision: string }
export interface CanvasScope { rootPath: string; rootRevision: number }
export interface CanvasCreateInput { scope: CanvasScope; path: string; content: string }
export interface CanvasSaveInput extends CanvasCreateInput { expectedRevision: string }
export const MAX_CANVAS_BYTES = 4 * 1024 * 1024
