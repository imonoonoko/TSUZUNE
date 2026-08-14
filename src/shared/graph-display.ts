import type { GraphDisplaySettings } from './types'

export type { GraphDisplaySettings }

export const GRAPH_DISPLAY_RANGES = {
  textFade: { min: -3, max: 3, step: 0.1 },
  nodeSize: { min: 0.1, max: 5, step: 'any' },
  lineSize: { min: 0.1, max: 5, step: 'any' }
} as const

export const DEFAULT_GRAPH_DISPLAY_SETTINGS: GraphDisplaySettings = {
  arrows: false,
  textFade: 0,
  nodeSize: 1,
  lineSize: 1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function parseGraphDisplaySettings(value: unknown): GraphDisplaySettings {
  const candidate = value as Partial<GraphDisplaySettings> | null
  const numericSetting = (
    setting: 'textFade' | 'nodeSize' | 'lineSize'
  ): number => {
    const range = GRAPH_DISPLAY_RANGES[setting]
    const settingValue = candidate?.[setting]
    return typeof settingValue === 'number' && Number.isFinite(settingValue)
      ? clamp(settingValue, range.min, range.max)
      : DEFAULT_GRAPH_DISPLAY_SETTINGS[setting]
  }

  return {
    arrows:
      typeof candidate?.arrows === 'boolean'
        ? candidate.arrows
        : DEFAULT_GRAPH_DISPLAY_SETTINGS.arrows,
    textFade: numericSetting('textFade'),
    nodeSize: numericSetting('nodeSize'),
    lineSize: numericSetting('lineSize')
  }
}

export function calculateGraphNodeRadius(
  referenceCount: number,
  sizeMultiplier: number
): number {
  return (
    sizeMultiplier *
    clamp(3 * Math.sqrt(Math.max(0, referenceCount) + 1), 8, 30)
  )
}

export function calculateGraphLabelOpacity(
  zoom: number,
  textFade: number
): number {
  return clamp(Math.log2(Math.max(zoom, 1 / 128)) + 2 - textFade, 0, 1)
}

export interface GraphZoomGeometry {
  nodeScale: number
  highlightedLabelScale: number
  lineWidth: number
}

export function calculateGraphZoomGeometry(
  scale: number,
  lineSizeMultiplier: number
): GraphZoomGeometry {
  const nodeScale = Math.sqrt(1 / scale)
  return {
    nodeScale,
    highlightedLabelScale: scale < 1 ? 1 / scale : nodeScale,
    lineWidth: lineSizeMultiplier / scale
  }
}
