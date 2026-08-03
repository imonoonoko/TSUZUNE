import type {
  GraphSettingsSectionState,
  GraphViewState,
  GraphViewStates
} from './types'

export const GRAPH_VIEW_SCALE_RANGE = {
  min: 1 / 128,
  max: 8
} as const

const DEFAULT_GRAPH_SETTINGS_SECTIONS: GraphSettingsSectionState = {
  filters: false,
  groups: false,
  display: false,
  forces: false
}

export const DEFAULT_GRAPH_VIEW_STATE: GraphViewState = {
  scale: 1,
  query: '',
  settingsOpen: false,
  settingsSections: DEFAULT_GRAPH_SETTINGS_SECTIONS
}

export const DEFAULT_GRAPH_VIEW_STATES: GraphViewStates = {
  local: DEFAULT_GRAPH_VIEW_STATE,
  vault: {
    ...DEFAULT_GRAPH_VIEW_STATE,
    settingsOpen: true
  }
}

export function parseGraphViewState(
  value: unknown,
  defaults: GraphViewState = DEFAULT_GRAPH_VIEW_STATE
): GraphViewState {
  const candidate = value as Partial<GraphViewState> | null
  const sections = candidate?.settingsSections as
    | Partial<GraphSettingsSectionState>
    | null
    | undefined
  const section = (key: keyof GraphSettingsSectionState): boolean =>
    typeof sections?.[key] === 'boolean'
      ? sections[key]
      : defaults.settingsSections[key]
  const scale =
    typeof candidate?.scale === 'number' && Number.isFinite(candidate.scale)
      ? Math.min(
          GRAPH_VIEW_SCALE_RANGE.max,
          Math.max(GRAPH_VIEW_SCALE_RANGE.min, candidate.scale)
        )
      : defaults.scale

  return {
    scale,
    query:
      typeof candidate?.query === 'string' ? candidate.query : defaults.query,
    settingsOpen:
      typeof candidate?.settingsOpen === 'boolean'
        ? candidate.settingsOpen
        : defaults.settingsOpen,
    settingsSections: {
      filters: section('filters'),
      groups: section('groups'),
      display: section('display'),
      forces: section('forces')
    }
  }
}

export function parseGraphViewStates(value: unknown): GraphViewStates {
  const candidate = value as Partial<GraphViewStates> | null
  return {
    local: parseGraphViewState(candidate?.local, DEFAULT_GRAPH_VIEW_STATES.local),
    vault: parseGraphViewState(candidate?.vault, DEFAULT_GRAPH_VIEW_STATES.vault)
  }
}
