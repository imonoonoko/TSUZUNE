import type { GraphForceSettings } from './types'

export const GRAPH_FORCE_RANGES: Record<
  keyof GraphForceSettings,
  { min: number; max: number }
> = {
  centerForce: { min: 0, max: 1 },
  repelForce: { min: 0, max: 20 },
  linkForce: { min: 0, max: 1 },
  linkDistance: { min: 30, max: 500 }
}

function sliderFromStrength(strength: number, minimum = 0.01): number {
  return 1 - Math.log(strength * (1 - minimum) + minimum) / Math.log(minimum)
}

export const DEFAULT_GRAPH_FORCE_SETTINGS: GraphForceSettings = {
  centerForce: sliderFromStrength(0.1),
  repelForce: 10,
  linkForce: 1,
  linkDistance: 250
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function strengthFromSlider(slider: number, minimum = 0.01): number {
  return (Math.pow(minimum, 1 - slider) - minimum) / (1 - minimum)
}

export function toGraphWorkerForceSettings(
  settings: GraphForceSettings
): GraphForceSettings {
  return {
    centerForce: strengthFromSlider(settings.centerForce),
    repelForce: -Math.max(1, settings.repelForce ** 3),
    linkForce: strengthFromSlider(settings.linkForce),
    linkDistance: settings.linkDistance
  }
}

function hasLegacyRange(value: Partial<GraphForceSettings> | null): boolean {
  return Boolean(
    value &&
      ((typeof value.centerForce === 'number' &&
        Number.isFinite(value.centerForce) &&
        value.centerForce > 1) ||
        (typeof value.repelForce === 'number' &&
          Number.isFinite(value.repelForce) &&
          value.repelForce > 20) ||
        (typeof value.linkForce === 'number' &&
          Number.isFinite(value.linkForce) &&
          value.linkForce > 1))
  )
}

export function migrateLegacyGraphForceSettings(
  value: unknown
): GraphForceSettings {
  const candidate = value as Partial<GraphForceSettings> | null
  const legacyValue = (setting: keyof GraphForceSettings): number =>
    typeof candidate?.[setting] === 'number' &&
    Number.isFinite(candidate[setting])
      ? clamp(candidate[setting], 0, 100)
      : 50

  return {
    centerForce: legacyValue('centerForce') / 100,
    repelForce: legacyValue('repelForce') / 5,
    linkForce: legacyValue('linkForce') / 100,
    linkDistance: 30 + legacyValue('linkDistance') * 4.7
  }
}

export function parseGraphForceSettings(value: unknown): GraphForceSettings {
  const candidate = value as Partial<GraphForceSettings> | null
  if (hasLegacyRange(candidate)) {
    return migrateLegacyGraphForceSettings(candidate)
  }

  const numberOrDefault = (
    setting: keyof GraphForceSettings
  ): number => {
    const range = GRAPH_FORCE_RANGES[setting]
    return typeof candidate?.[setting] === 'number' &&
      Number.isFinite(candidate[setting])
      ? clamp(candidate[setting], range.min, range.max)
      : DEFAULT_GRAPH_FORCE_SETTINGS[setting]
  }

  return {
    centerForce: numberOrDefault('centerForce'),
    repelForce: numberOrDefault('repelForce'),
    linkForce: numberOrDefault('linkForce'),
    linkDistance: numberOrDefault('linkDistance')
  }
}
