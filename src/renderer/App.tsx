import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildNoteCreationPath,
  findLinkImpact,
  getBacklinks,
  getOutgoingLinks,
  resolveWikiLink
} from '../core/links'
import {
  extractMarkdownHeadings,
  type MarkdownHeading
} from '../core/markdown-headings'
import {
  buildWikiGraph,
  buildWikiGraphForView,
  excludeWikiGraphPaths,
  getLocalWikiGraph,
  getVaultWikiGraph,
  type WikiGraphScope
} from '../core/graph'
import {
  basenameRelative,
  dirnameRelative,
  formatPathForCopy,
  isPathInsideOrEqual,
  joinRelative,
  validateRelativePath,
  withMarkdownExtension,
  withoutMarkdownExtension
} from '../core/paths'
import type { CopyPathFormat } from '../core/paths'
import { compilePathAliases, resolvePathAlias } from '../core/path-aliases'
import { searchRendererRanked } from '../core/search'
import { getNoteFreshness } from '../core/freshness'
import {
  TEMPLATE_DIRECTORY,
  dailyTemplatePath,
  dailyNoteLocation,
  ideaNoteLocation,
  listTemplates,
  parseDailyNote,
  parseIdeaNote,
  renderDailyNote,
  renderIdeaNote,
  renderTemplate
} from '../core/templates'
import type {
  AppError,
  AiWriteReviewProposal,
  AppUpdateStatus,
  CalendarPluginRuntimeStatus,
  DriveRemoteVault,
  DriveSyncPreview,
  EntryMoveRecoveryStatus,
  GoogleDriveStatus,
  GraphDisplaySettings,
  GraphFilterSettings,
  GraphForceSettings,
  GraphGroup,
  GraphViewState,
  GraphViewStates,
  NoteDocument,
  ObsidianPluginCandidate,
  VaultAttachment,
  VaultChangeEvent,
  VaultSnapshot
} from '../shared/types'
import {
  DEFAULT_CALENDAR_PLUGIN_SETTINGS,
  parseCalendarPluginSettings,
  type CalendarPluginSettings
} from '../shared/calendar-plugin-settings'
import { DEFAULT_GRAPH_FORCE_SETTINGS } from '../shared/graph-settings'
import { DEFAULT_GRAPH_DISPLAY_SETTINGS } from '../shared/graph-display'
import { DEFAULT_GRAPH_FILTER_SETTINGS } from '../shared/graph-filters'
import { DEFAULT_GRAPH_GROUPS } from '../shared/graph-groups'
import { DEFAULT_GRAPH_VIEW_STATES } from '../shared/graph-view-state'
import { createExcludedFileMatcher } from '../shared/excluded-files'
import FileTree, { type TreeSelection } from './components/FileTree'
import AttachmentPreview from './components/AttachmentPreview'
import HumanNoteCaptureDialog, {
  type HumanNoteCaptureSubmission
} from './components/HumanNoteCaptureDialog'
import Icon from './components/Icon'
import MarkdownEditor, { type MarkdownEditorHandle } from './components/MarkdownEditor'
import MarkdownPreview from './components/MarkdownPreview'
import BookmarkDialog from './components/BookmarkDialog'
import MoveDialog from './components/MoveDialog'
import QuickNoteCreateDialog from './components/QuickNoteCreateDialog'
import QuickSwitcherDialog from './components/QuickSwitcherDialog'
import CommandPaletteDialog, {
  type CommandPaletteCommand
} from './components/CommandPaletteDialog'
import ConflictBanner, {
  type ConflictState
} from './components/ConflictBanner'
import RenameDialog from './components/RenameDialog'
import DailyCalendar from './components/DailyCalendar'
import CalendarPluginFrame, {
  type CalendarPluginFrameHandle
} from './components/CalendarPluginFrame'
import RelatedNotes from './components/RelatedNotes'
import TemporalDetails from './components/TemporalDetails'
import WikiGraphView from './components/WikiGraphView'
import ObservatoryView from './components/ObservatoryView'
import WorkspaceTabBar, {
  WORKSPACE_TAB_PANEL_ID,
  workspaceTabDomId,
  workspaceTabLabel,
  type WorkspaceTab
} from './components/WorkspaceTabBar'
import tsuzuneMark from './assets/tsuzune-app-icon.png'

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'
type SettingsCategory = 'files' | 'templates' | 'plugins' | 'calendar' | 'ai'

const isNormalDiscoveryExcluded = createExcludedFileMatcher(['50_履歴'])

const SAVE_DELAY_MS = 600
const EXTERNAL_CHANGE_DELAY_MS = 100

function trapDialogTab(
  event: React.KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null
): void {
  if (event.key !== 'Tab' || !dialog) {
    return
  }

  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  )
  if (focusable.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || active === dialog)) {
    event.preventDefault()
    first.focus()
  } else if (!(active instanceof Node) || !dialog.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'dirty':
      return '未保存'
    case 'saving':
      return '保存中…'
    case 'error':
      return '保存失敗'
    case 'conflict':
      return '外部変更あり'
    default:
      return '保存済み'
  }
}

function errorMessage(error: AppError): string {
  return error.message || '操作を完了できませんでした。'
}

function localCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function restoredLastNote(
  notes: NoteDocument[],
  lastNotePath: string,
  pathAliases: VaultSnapshot['pathAliases']
): NoteDocument | null {
  const pathKey = lastNotePath.toLocaleLowerCase()
  const exact = notes.find(
    (note) => note.path.toLocaleLowerCase() === pathKey
  )
  if (exact) {
    return exact
  }

  try {
    const canonicalPath = resolvePathAlias(
      compilePathAliases(pathAliases ?? {}),
      lastNotePath
    )
    const canonicalKey = canonicalPath.toLocaleLowerCase()
    return (
      notes.find((note) => note.path.toLocaleLowerCase() === canonicalKey) ?? null
    )
  } catch {
    return null
  }
}

export default function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null)
  const snapshotRef = useRef<VaultSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selectedPathRef = useRef<string | null>(null)
  const markdownEditorRef = useRef<MarkdownEditorHandle | null>(null)
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([])
  const [activeTabId, setActiveTabId] = useState<number | null>(null)
  const [workspaceTabFocusId, setWorkspaceTabFocusId] = useState<number | null>(null)
  const workspaceTabRefs = useRef(new Map<number, HTMLButtonElement>())
  const [activeAttachmentPath, setActiveAttachmentPath] = useState<string | null>(null)
  const [activeLinkedViewPath, setActiveLinkedViewPath] = useState<string | null>(null)
  const nextTabIdRef = useRef(1)
  const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(null)
  const [content, setContent] = useState('')
  const contentRef = useRef('')
  const [modifiedAt, setModifiedAt] = useState(0)
  const modifiedAtRef = useRef(0)
  const expectedContentRef = useRef('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const versionRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'graph'>('preview')
  const [graphScope, setGraphScope] = useState<WikiGraphScope>('local')
  const [graphFilters, setGraphFilters] = useState<GraphFilterSettings>(
    DEFAULT_GRAPH_FILTER_SETTINGS
  )
  const [graphForces, setGraphForces] = useState<GraphForceSettings>(
    DEFAULT_GRAPH_FORCE_SETTINGS
  )
  const [graphDisplay, setGraphDisplay] = useState<GraphDisplaySettings>(
    DEFAULT_GRAPH_DISPLAY_SETTINGS
  )
  const [graphGroups, setGraphGroups] = useState<GraphGroup[]>(
    DEFAULT_GRAPH_GROUPS
  )
  const [graphViewStates, setGraphViewStates] = useState<GraphViewStates>(
    DEFAULT_GRAPH_VIEW_STATES
  )
  const [userIgnoreFilters, setUserIgnoreFilters] = useState<string[]>([])
  const [aiReviewPaths, setAiReviewPaths] = useState<string[]>([])
  const [aiReviewProposals, setAiReviewProposals] = useState<AiWriteReviewProposal[]>([])
  const [obsidianPluginCandidates, setObsidianPluginCandidates] = useState<
    ObsidianPluginCandidate[]
  >([])
  const [obsidianPluginsLoading, setObsidianPluginsLoading] = useState(false)
  const [calendarPluginStatus, setCalendarPluginStatus] =
    useState<CalendarPluginRuntimeStatus | null>(null)
  const [calendarPluginSettings, setCalendarPluginSettings] =
    useState<CalendarPluginSettings>({ ...DEFAULT_CALENDAR_PLUGIN_SETTINGS })
  const [calendarPluginSettingsDraft, setCalendarPluginSettingsDraft] =
    useState<CalendarPluginSettings>({ ...DEFAULT_CALENDAR_PLUGIN_SETTINGS })
  const [calendarPluginActivated, setCalendarPluginActivated] = useState(false)
  const [calendarPluginError, setCalendarPluginError] = useState<string | null>(null)
  const [calendarPluginFailed, setCalendarPluginFailed] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('files')
  const [excludedFilesDraft, setExcludedFilesDraft] = useState('')
  const [aiReviewPathsDraft, setAiReviewPathsDraft] = useState('')
  const [templateDirectory, setTemplateDirectory] = useState(TEMPLATE_DIRECTORY)
  const [templateDirectoryDraft, setTemplateDirectoryDraft] = useState(TEMPLATE_DIRECTORY)
  const [showBuiltInTemplates, setShowBuiltInTemplates] = useState(true)
  const [showBuiltInTemplatesDraft, setShowBuiltInTemplatesDraft] = useState(true)
  const [query, setQuery] = useState('')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [recentNotePaths, setRecentNotePaths] = useState<string[]>([])
  const [quickCreateRequest, setQuickCreateRequest] = useState<{
    name: string
    directory: string
    error: string | null
  } | null>(null)
  const [quickCreateBusy, setQuickCreateBusy] = useState(false)
  const [captureKind, setCaptureKind] = useState<'daily' | 'idea' | null>(null)
  const [captureEditPath, setCaptureEditPath] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [moveRecovery, setMoveRecovery] = useState<EntryMoveRecoveryStatus>({
    status: 'clean'
  })
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const conflictRef = useRef<ConflictState | null>(null)
  const [movePath, setMovePath] = useState<string | null>(null)
  const [createDirectoryParent, setCreateDirectoryParent] = useState<string | null>(null)
  const [renameRequest, setRenameRequest] = useState<{
    selection: TreeSelection
    currentName: string
  } | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [bookmarkPath, setBookmarkPath] = useState<string | null>(null)
  const [leftSidebarView, setLeftSidebarView] = useState<'files' | 'search' | 'bookmarks'>('files')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>({
    phase: 'disabled',
    currentVersion: '',
    availableVersion: null,
    downloadPercent: null,
    message: null
  })
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleAdvancedOpen, setGoogleAdvancedOpen] = useState(false)
  const [googleStatus, setGoogleStatus] = useState<GoogleDriveStatus | null>(null)
  const [drivePreview, setDrivePreview] = useState<DriveSyncPreview | null>(null)
  const [driveVaults, setDriveVaults] = useState<DriveRemoteVault[]>([])
  const [selectedDriveVaultId, setSelectedDriveVaultId] = useState('')
  const modalOpen =
    quickSwitcherOpen ||
    commandPaletteOpen ||
    Boolean(quickCreateRequest) ||
    settingsDialogOpen ||
    googleDialogOpen ||
    Boolean(movePath) ||
    Boolean(renameRequest) ||
    Boolean(bookmarkPath) ||
    Boolean(captureKind)
  const settingsDialogRef = useRef<HTMLElement | null>(null)
  const settingsDialogPreviousFocusRef = useRef<HTMLElement | null>(null)
  const googleDialogRef = useRef<HTMLElement | null>(null)
  const googleDialogPreviousFocusRef = useRef<HTMLElement | null>(null)
  const quickSwitcherPreviousFocusRef = useRef<HTMLElement | null>(null)
  const quickSwitcherRestoreFocusRef = useRef(false)
  const commandPalettePreviousFocusRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(false)
  const captureDirtyRef = useRef(false)
  const vaultGenerationRef = useRef(0)
  const vaultSwitchingRef = useRef(false)
  const snapshotRequestRef = useRef(0)
  const committedSnapshotRequestRef = useRef(0)
  const pendingExternalEventsRef = useRef<VaultChangeEvent[]>([])
  const queuedExternalEventsRef = useRef<Map<string, VaultChangeEvent>>(new Map())
  const externalChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const externalChangeHandlerRef = useRef<(events: VaultChangeEvent[]) => Promise<void>>(
    async () => undefined
  )
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const calendarPluginFrameRef = useRef<CalendarPluginFrameHandle | null>(null)
  const calendarPluginActivatedRef = useRef(false)
  const calendarPluginSessionRef = useRef(
    `calendar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  )
  const handleCaptureDirtyChange = useCallback((dirty: boolean): void => {
    captureDirtyRef.current = dirty
  }, [])

  useEffect(() => {
    setWorkspaceTabFocusId(activeTabId)
  }, [activeTabId])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }

    const compactLayout = window.matchMedia('(max-width: 900px)')
    const narrowLayout = window.matchMedia('(max-width: 720px)')
    const collapseForViewport = (): void => {
      if (compactLayout.matches) {
        setRightSidebarOpen(false)
      }
      if (narrowLayout.matches) {
        setLeftSidebarOpen(false)
      }
    }

    collapseForViewport()
    compactLayout.addEventListener('change', collapseForViewport)
    narrowLayout.addEventListener('change', collapseForViewport)
    return () => {
      compactLayout.removeEventListener('change', collapseForViewport)
      narrowLayout.removeEventListener('change', collapseForViewport)
    }
  }, [])

  const focusWorkspaceTab = useCallback((tabId: number): void => {
    setWorkspaceTabFocusId(tabId)
    setTimeout(() => workspaceTabRefs.current.get(tabId)?.focus(), 0)
  }, [])

  const setCurrentSnapshot = (next: VaultSnapshot | null): void => {
    snapshotRef.current = next
    setSnapshot(next)
  }

  const rememberRecentNote = useCallback((path: string): void => {
    setRecentNotePaths((current) => [
      path,
      ...current.filter((candidate) => candidate !== path)
    ].slice(0, 20))
  }, [])

  const closeQuickSwitcher = (): void => {
    setQuickSwitcherOpen(false)
    const previousFocus = quickSwitcherPreviousFocusRef.current
    const shouldRestore = quickSwitcherRestoreFocusRef.current
    quickSwitcherPreviousFocusRef.current = null
    quickSwitcherRestoreFocusRef.current = false
    if (shouldRestore && previousFocus?.isConnected) {
      setTimeout(() => previousFocus.focus(), 0)
    }
  }

  const openQuickSwitcher = useCallback((): boolean => {
    if (!snapshotRef.current || modalOpen || busyRef.current) {
      return false
    }
    quickSwitcherPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    quickSwitcherRestoreFocusRef.current = true
    setQuickSwitcherOpen(true)
    return true
  }, [modalOpen])

  const dismissCommandPalette = (): HTMLElement | null => {
    setCommandPaletteOpen(false)
    const previousFocus = commandPalettePreviousFocusRef.current
    commandPalettePreviousFocusRef.current = null
    return previousFocus
  }

  const closeCommandPalette = (): void => {
    const previousFocus = dismissCommandPalette()
    setTimeout(() => {
      if (previousFocus?.isConnected) previousFocus.focus()
    }, 0)
  }

  const openCommandPalette = useCallback((): boolean => {
    if (!snapshotRef.current || modalOpen || busyRef.current) {
      return false
    }
    commandPalettePreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCommandPaletteOpen(true)
    return true
  }, [modalOpen])

  const focusVaultSearch = useCallback((): void => {
    setLeftSidebarView('search')
    setLeftSidebarOpen(true)
    setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }, 0)
  }, [])

  const clearSaveTimer = (): void => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }

  const setCurrentConflict = (next: ConflictState | null): void => {
    conflictRef.current = next
    setConflict(next)
  }

  const persistGraphForces = async (next: GraphForceSettings): Promise<void> => {
    const result = await window.tsuzune.setGraphForces(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphDisplay = async (
    next: GraphDisplaySettings
  ): Promise<void> => {
    const result = await window.tsuzune.setGraphDisplay(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphFilters = async (
    next: GraphFilterSettings
  ): Promise<void> => {
    const result = await window.tsuzune.setGraphFilters(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphGroups = async (next: GraphGroup[]): Promise<void> => {
    const result = await window.tsuzune.setGraphGroups(next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const persistGraphViewState = async (
    scope: WikiGraphScope,
    next: GraphViewState
  ): Promise<void> => {
    setGraphViewStates((current) => ({ ...current, [scope]: next }))
    const result = await window.tsuzune.setGraphViewState(scope, next)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const beginOperation = (): boolean => {
    if (busyRef.current) {
      return false
    }
    busyRef.current = true
    setBusy(true)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    return true
  }

  const finishOperation = (): void => {
    busyRef.current = false
    setBusy(false)
    const pending = pendingExternalEventsRef.current.splice(0)
    if (pending.length > 0) {
      queueMicrotask(() => {
        void externalChangeHandlerRef.current(pending)
      })
    }
  }

  const loadNoteState = (
    note: NoteDocument | null,
    persistLastNote = true
  ): void => {
    clearSaveTimer()
    const path = note?.path ?? null
    selectedPathRef.current = path
    setSelectedPath(path)
    contentRef.current = note?.content ?? ''
    setContent(note?.content ?? '')
    modifiedAtRef.current = note?.modifiedAt ?? 0
    expectedContentRef.current = note?.content ?? ''
    setModifiedAt(note?.modifiedAt ?? 0)
    versionRef.current += 1
    dirtyRef.current = false
    savingRef.current = false
    setSaveStatus('saved')
    setCurrentConflict(null)
    setMessage(null)
    setActiveAttachmentPath(null)
    setActiveLinkedViewPath(null)
    if (path) {
      setTreeSelection({ kind: 'note', path })
    }
    if (persistLastNote) {
      void window.tsuzune.setLastNote(path)
    }
  }

  const updateSnapshotNote = (
    path: string,
    nextContent: string,
    nextModifiedAt: number,
    nextSize: number
  ): void => {
    const current = snapshotRef.current
    if (!current) {
      return
    }
    const next = {
      ...current,
      notes: current.notes.map((note) =>
        note.path === path
          ? {
              ...note,
              content: nextContent,
              modifiedAt: nextModifiedAt,
              size: nextSize
            }
          : note
      )
    }
    setCurrentSnapshot(next)
  }

  const flushSave = (force = false): Promise<boolean> => {
    clearSaveTimer()

    const operation = async (): Promise<boolean> => {
      const path = selectedPathRef.current
      if (!path || !dirtyRef.current) {
        return true
      }

      if (conflictRef.current && !force) {
        setSaveStatus('conflict')
        setMessage('外部変更を解決してから別の操作へ進んでください。')
        return false
      }

      const capturedContent = contentRef.current
      const capturedVersion = versionRef.current
      savingRef.current = true
      setSaveStatus('saving')

      const result = await window.tsuzune.saveNote({
        path,
        content: capturedContent,
        expectedModifiedAt: modifiedAtRef.current,
        expectedContent: expectedContentRef.current,
        force
      })

      savingRef.current = false
      if (!result.ok) {
        dirtyRef.current = true
        if (result.error.code === 'FILE_CHANGED') {
          const nextConflict: ConflictState = {
            kind: 'changed',
            externalContent: result.error.currentContent ?? '',
            externalModifiedAt: result.error.currentModifiedAt ?? modifiedAtRef.current,
            externalSize: new TextEncoder().encode(
              result.error.currentContent ?? ''
            ).byteLength,
            localHeld: false
          }
          setCurrentConflict(nextConflict)
          setSaveStatus('conflict')
        } else if (result.error.code === 'NOT_FOUND') {
          setCurrentConflict({ kind: 'missing' })
          setSaveStatus('conflict')
          setMessage(
            '編集中のノートが見つかりません。別名で保存するか、内容を破棄してください。'
          )
          return false
        } else {
          setSaveStatus('error')
        }
        setMessage(errorMessage(result.error))
        return false
      }

      modifiedAtRef.current = result.value.modifiedAt
      expectedContentRef.current = capturedContent
      setModifiedAt(result.value.modifiedAt)
      updateSnapshotNote(
        path,
        capturedContent,
        result.value.modifiedAt,
        result.value.size
      )

      const fullySaved =
        selectedPathRef.current === path &&
        versionRef.current === capturedVersion &&
        contentRef.current === capturedContent
      if (fullySaved) {
        dirtyRef.current = false
        setSaveStatus('saved')
      } else {
        dirtyRef.current = true
        setSaveStatus('dirty')
      }
      setMessage(null)
      return fullySaved
    }

    const next = saveQueueRef.current.then(operation, operation)
    saveQueueRef.current = next
    return next
  }

  const scheduleSave = (): void => {
    clearSaveTimer()
    if (conflictRef.current) {
      return
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void flushSave()
    }, SAVE_DELAY_MS)
  }

  const handleContentChange = (nextContent: string): void => {
    if (busyRef.current) {
      return
    }
    contentRef.current = nextContent
    setContent(nextContent)
    versionRef.current += 1
    dirtyRef.current = true
    setSaveStatus(conflictRef.current ? 'conflict' : 'dirty')
    scheduleSave()
  }

  const handleImportAttachments = async (): Promise<string[]> => {
    const notePath = selectedPathRef.current
    if (!notePath) return []
    const result = await window.tsuzune.importAttachments(dirnameRelative(notePath))
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return []
    }
    if (!result.value) return []
    await refreshSnapshot()
    setMessage(null)
    return result.value.map((entry) => entry.path)
  }

  const refreshSnapshot = async (
    generation = vaultGenerationRef.current
  ): Promise<VaultSnapshot | null> => {
    const requestId = ++snapshotRequestRef.current
    const result = await window.tsuzune.getSnapshot()
    if (
      generation !== vaultGenerationRef.current ||
      vaultSwitchingRef.current ||
      requestId < committedSnapshotRequestRef.current
    ) {
      return null
    }
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return null
    }
    committedSnapshotRequestRef.current = requestId
    setCurrentSnapshot(result.value)
    return result.value
  }

  const activateNoteWorkspace = (path: string): void => {
    if (activeTabId === null) {
      return
    }
    const activeTab = workspaceTabs.find((tab) => tab.id === activeTabId)
    if (activeTab?.kind === 'global-graph' || activeTab?.kind === 'observatory') {
      const existing = workspaceTabs.find(
        (tab) => tab.kind === 'note' && tab.path === path
      )
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        const nextTab: WorkspaceTab = {
          id: nextTabIdRef.current++,
          kind: 'note',
          path
        }
        setWorkspaceTabs([...workspaceTabs, nextTab])
        setActiveTabId(nextTab.id)
      }
      setViewMode('preview')
      return
    }
    setWorkspaceTabs((current) =>
      current.map((tab) =>
        tab.id === activeTabId ? { ...tab, kind: 'note', path } : tab
      )
    )
  }

  const openNote = async (path: string): Promise<void> => {
    if (path === selectedPathRef.current || !beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }

      const note = snapshotRef.current?.notes.find((candidate) => candidate.path === path)
      if (note) {
        loadNoteState(note)
        activateNoteWorkspace(path)
        rememberRecentNote(path)
        setViewMode('preview')
        return
      }

      const result = await window.tsuzune.readNote(path)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      loadNoteState(result.value)
      activateNoteWorkspace(path)
      rememberRecentNote(path)
      setViewMode('preview')
    } finally {
      finishOperation()
    }
  }

  const handleExternalChanges = async (
    events: VaultChangeEvent[]
  ): Promise<void> => {
    if (events.length === 0) {
      return
    }
    if (vaultSwitchingRef.current) {
      return
    }
    if (busyRef.current) {
      pendingExternalEventsRef.current.push(...events)
      return
    }

    const generation = vaultGenerationRef.current
    const currentPath = selectedPathRef.current
    const wasDirty = dirtyRef.current || savingRef.current
    const refreshed = await refreshSnapshot(generation)
    const selectedEvent = currentPath
      ? [...events].reverse().find((event) => event.path === currentPath)
      : undefined

    if (
      !refreshed ||
      generation !== vaultGenerationRef.current ||
      vaultSwitchingRef.current ||
      busyRef.current ||
      !currentPath ||
      !selectedEvent ||
      selectedPathRef.current !== currentPath
    ) {
      if (
        busyRef.current &&
        generation === vaultGenerationRef.current &&
        !vaultSwitchingRef.current
      ) {
        pendingExternalEventsRef.current.push(...events)
      }
      return
    }

    if (selectedEvent.type === 'change' || selectedEvent.type === 'add') {
      const result = await window.tsuzune.readNote(currentPath)
      if (
        generation !== vaultGenerationRef.current ||
        vaultSwitchingRef.current ||
        busyRef.current ||
        selectedPathRef.current !== currentPath
      ) {
        if (
          busyRef.current &&
          generation === vaultGenerationRef.current &&
          !vaultSwitchingRef.current
        ) {
          pendingExternalEventsRef.current.push(...events)
        }
        return
      }
      if (!result.ok) {
        if (result.error.code === 'NOT_FOUND') {
          clearSaveTimer()
          if (wasDirty || dirtyRef.current || savingRef.current) {
            setCurrentConflict({ kind: 'missing' })
            setSaveStatus('conflict')
          } else {
            loadNoteState(null)
          }
          setMessage('開いていたノートは外部で削除または移動されました。')
          return
        }
        setMessage(errorMessage(result.error))
        return
      }

      if (wasDirty || dirtyRef.current || savingRef.current) {
        clearSaveTimer()
        const nextConflict: ConflictState = {
          kind: 'changed',
          externalContent: result.value.content,
          externalModifiedAt: result.value.modifiedAt,
          externalSize: result.value.size,
          localHeld: false
        }
        setCurrentConflict(nextConflict)
        setSaveStatus('conflict')
      } else {
        loadNoteState(result.value)
      }
      return
    }

    if (selectedEvent.type === 'unlink') {
      clearSaveTimer()
      if (wasDirty || dirtyRef.current || savingRef.current) {
        setCurrentConflict({ kind: 'missing' })
        setSaveStatus('conflict')
        setMessage('開いていたノートは外部で削除または移動されました。')
      } else {
        loadNoteState(null)
        setMessage('開いていたノートは外部で削除または移動されました。')
      }
    }
  }
  externalChangeHandlerRef.current = handleExternalChanges

  const queueExternalChange = (event: VaultChangeEvent): void => {
    queuedExternalEventsRef.current.set(event.path, event)
    if (externalChangeTimerRef.current) {
      clearTimeout(externalChangeTimerRef.current)
    }
    externalChangeTimerRef.current = setTimeout(() => {
      externalChangeTimerRef.current = null
      const events = [...queuedExternalEventsRef.current.values()]
      queuedExternalEventsRef.current.clear()
      void externalChangeHandlerRef.current(events)
    }, EXTERNAL_CHANGE_DELAY_MS)
  }

  useEffect(() => {
    let disposed = false

    const initialize = async (): Promise<void> => {
      const [settingsResult, vaultResult, updateResult] = await Promise.all([
        window.tsuzune.getSettings(),
        window.tsuzune.openLastVault(),
        window.tsuzune.getUpdateStatus()
      ])
      const moveRecoveryResult = await window.tsuzune.getMoveRecovery()

      if (disposed) {
        return
      }

      if (settingsResult.ok) {
        setUserIgnoreFilters(settingsResult.value.userIgnoreFilters)
        setExcludedFilesDraft(settingsResult.value.userIgnoreFilters.join('\n'))
        setAiReviewPaths(settingsResult.value.aiReviewPaths ?? [])
        setAiReviewPathsDraft((settingsResult.value.aiReviewPaths ?? []).join('\n'))
        const nextTemplateDirectory =
          settingsResult.value.templateDirectory ?? TEMPLATE_DIRECTORY
        const nextShowBuiltIns = settingsResult.value.showBuiltInTemplates ?? true
        setTemplateDirectory(nextTemplateDirectory)
        setTemplateDirectoryDraft(nextTemplateDirectory)
        setShowBuiltInTemplates(nextShowBuiltIns)
        setShowBuiltInTemplatesDraft(nextShowBuiltIns)
        const nextCalendarSettings =
          settingsResult.value.calendarPlugin ?? DEFAULT_CALENDAR_PLUGIN_SETTINGS
        setCalendarPluginSettings({ ...nextCalendarSettings })
        setCalendarPluginSettingsDraft({ ...nextCalendarSettings })
        setGraphForces(settingsResult.value.graphForces)
        setGraphDisplay(settingsResult.value.graphDisplay)
        setGraphFilters(settingsResult.value.graphFilters)
        setGraphGroups(settingsResult.value.graphGroups)
        setGraphViewStates(settingsResult.value.graphViewStates)
      }

      if (!vaultResult.ok) {
        setMessage(errorMessage(vaultResult.error))
      } else if (vaultResult.value) {
        setCurrentSnapshot(vaultResult.value)
        if (settingsResult.ok && settingsResult.value.lastNotePath) {
          const previous = restoredLastNote(
            vaultResult.value.notes,
            settingsResult.value.lastNotePath,
            vaultResult.value.pathAliases
          )
          if (previous) {
            loadNoteState(previous, false)
            rememberRecentNote(previous.path)
          }
        }
      }
      if (updateResult.ok) {
        setUpdateStatus(updateResult.value)
      }
      if (moveRecoveryResult.ok) {
        setMoveRecovery(moveRecoveryResult.value)
      }
      setLoading(false)
    }

    void initialize()

    const unsubscribeVault = window.tsuzune.onVaultChanged(queueExternalChange)
    const unsubscribeClose = window.tsuzune.onRequestClose(() => {
      if (busyRef.current) {
        setMessage('処理が終わってからアプリを閉じてください。')
        window.tsuzune.confirmClose(false)
        return
      }
      if (
        captureDirtyRef.current &&
        !window.confirm(
          '入力フォームに未保存の内容があります。破棄してアプリを閉じますか？'
        )
      ) {
        window.tsuzune.confirmClose(false)
        return
      }
      void flushSave().then((saved) => {
        window.tsuzune.confirmClose(saved)
      })
    })
    const unsubscribeUpdate = window.tsuzune.onUpdateStatus((status) => {
      setUpdateStatus(status)
    })

    return () => {
      disposed = true
      unsubscribeVault()
      unsubscribeClose()
      unsubscribeUpdate()
      clearSaveTimer()
      if (externalChangeTimerRef.current) {
        clearTimeout(externalChangeTimerRef.current)
        externalChangeTimerRef.current = null
      }
      queuedExternalEventsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    let disposed = false
    setCalendarPluginStatus(null)
    setCalendarPluginActivated(false)
    calendarPluginActivatedRef.current = false
    setCalendarPluginError(null)
    setCalendarPluginFailed(false)
    if (!snapshot?.rootPath) {
      return () => {
        disposed = true
      }
    }
    void window.tsuzune.getCalendarPluginStatus().then((result) => {
      if (disposed) return
      if (result.ok) {
        setCalendarPluginStatus(result.value)
      } else {
        setCalendarPluginError(errorMessage(result.error))
      }
    })
    return () => {
      disposed = true
    }
  }, [snapshot?.rootPath])

  useEffect(() => {
    if (!settingsDialogOpen) {
      return
    }

    settingsDialogRef.current?.focus()
    return () => {
      const previousFocus = settingsDialogPreviousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [settingsDialogOpen])

  useEffect(() => {
    if (!googleDialogOpen) {
      return
    }

    googleDialogRef.current?.focus()
    return () => {
      const previousFocus = googleDialogPreviousFocusRef.current
      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [googleDialogOpen])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.repeat) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'o') {
        if (openQuickSwitcher()) {
          event.preventDefault()
        }
        return
      }
      if (key === 'p') {
        event.preventDefault()
        openCommandPalette()
        return
      }
      if (
        (key === 'k' || (key === 'f' && event.shiftKey)) &&
        !modalOpen &&
        !busyRef.current
      ) {
        event.preventDefault()
        focusVaultSearch()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [focusVaultSearch, modalOpen, openCommandPalette, openQuickSwitcher])

  const savedNotes = snapshot?.notes ?? []
  const normalDiscoveryNotes = useMemo(
    () => savedNotes.filter((note) => !isNormalDiscoveryExcluded(note.path)),
    [savedNotes]
  )
  const userExcludedMatcher = useMemo(
    () => createExcludedFileMatcher(userIgnoreFilters),
    [userIgnoreFilters]
  )
  const userExcludedNotePaths = useMemo(
    () =>
      new Set(
        savedNotes
          .filter((note) => userExcludedMatcher(note.path))
          .map((note) => note.path)
      ),
    [savedNotes, userExcludedMatcher]
  )
  const searchNotes = useMemo(
    () => normalDiscoveryNotes.filter((note) => !userExcludedMatcher(note.path)),
    [normalDiscoveryNotes, userExcludedMatcher]
  )
  const pathAliases = useMemo(
    () => compilePathAliases(snapshot?.pathAliases ?? {}),
    [snapshot?.pathAliases]
  )
  const bookmarkedPaths = useMemo(
    () => new Set((snapshot?.bookmarks ?? []).map((bookmark) => bookmark.path)),
    [snapshot?.bookmarks]
  )
  const bookmarkGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<VaultSnapshot['bookmarks']>>()
    for (const bookmark of snapshot?.bookmarks ?? []) {
      const group = bookmark.group?.trim() || '未分類'
      const items = groups.get(group) ?? []
      items.push(bookmark)
      groups.set(group, items)
    }
    return [...groups]
  }, [snapshot?.bookmarks])
  const templates = useMemo(
    () => listTemplates(savedNotes, {
      directory: templateDirectory,
      includeBuiltIns: showBuiltInTemplates
    }),
    [savedNotes, templateDirectory, showBuiltInTemplates]
  )
  const graphNotes = useMemo(() => {
    if (viewMode !== 'graph' || !selectedPath) {
      return normalDiscoveryNotes
    }
    return normalDiscoveryNotes.map((note) =>
      note.path === selectedPath ? { ...note, content } : note
    )
  }, [normalDiscoveryNotes, selectedPath, content, viewMode])

  const outgoing = useMemo(
    () =>
      selectedPath ? getOutgoingLinks(content, savedNotes, pathAliases) : [],
    [selectedPath, content, savedNotes, pathAliases]
  )
  const backlinks = useMemo(
    () =>
      selectedPath
        ? getBacklinks(selectedPath, normalDiscoveryNotes, pathAliases)
        : [],
    [selectedPath, normalDiscoveryNotes, pathAliases]
  )
  const headings = useMemo(
    () => selectedPath && viewMode !== 'graph' ? extractMarkdownHeadings(content) : [],
    [selectedPath, content, viewMode]
  )
  const handleHeadingSelect = useCallback((heading: MarkdownHeading): void => {
    if (viewMode === 'edit') {
      markdownEditorRef.current?.scrollToOffset(heading.sourceOffset)
    } else if (viewMode === 'preview') {
      const target = document.getElementById(heading.id)
      target?.scrollIntoView({ block: 'start' })
      target?.focus()
    }
  }, [viewMode])
  const searchResults = useMemo(
    () => searchRendererRanked(searchNotes, query),
    [query, searchNotes]
  )
  const selectedNote = useMemo(
    () =>
      selectedPath
        ? savedNotes.find((note) => note.path === selectedPath) ?? null
        : null,
    [savedNotes, selectedPath]
  )
  const selectedFreshness = useMemo(
    () =>
      selectedPath
        ? getNoteFreshness({ content, modifiedAt })
        : null,
    [content, modifiedAt, selectedPath]
  )
  const structuredCapture = useMemo((): HumanNoteCaptureSubmission | null => {
    if (!selectedPath) {
      return null
    }
    if (/^02_デイリー\/\d{4}-\d{2}-\d{2}\.md$/.test(selectedPath)) {
      const values = parseDailyNote(content)
      return values ? { kind: 'daily', ...values, memo: values.memo ?? '' } : null
    }
    if (selectedPath.startsWith('01_受信箱/アイデア/')) {
      const values = parseIdeaNote(content)
      return values ? { kind: 'idea', ...values, memo: values.memo ?? '' } : null
    }
    return null
  }, [content, selectedPath])
  const wikiGraph = useMemo(
    () =>
      excludeWikiGraphPaths(
        buildWikiGraphForView(graphNotes, viewMode, {
          includeUnresolved: !graphFilters.existingFilesOnly,
          includeTags: graphFilters.showTags,
          includeAttachments: graphFilters.showAttachments,
          attachments: snapshot?.attachments ?? [],
          pathAliases
        }),
        userExcludedMatcher
      ),
    [
      graphNotes,
      graphFilters.existingFilesOnly,
      graphFilters.showAttachments,
      graphFilters.showTags,
      pathAliases,
      snapshot?.attachments,
      userExcludedMatcher,
      viewMode
    ]
  )
  const visibleGraph = useMemo(() => {
    if (graphScope === 'local') {
      return selectedPath
      ? getLocalWikiGraph(wikiGraph, selectedPath, graphFilters)
        : { nodes: [], edges: [] }
    }
    return getVaultWikiGraph(
      wikiGraph,
      selectedPath,
      graphFilters.showOrphans
    )
  }, [wikiGraph, selectedPath, graphScope, graphFilters])
  const linkedViewBacklinks = useMemo(() => {
    if (!activeLinkedViewPath) {
      return []
    }
    const linkedViewGraph = buildWikiGraph(normalDiscoveryNotes, {
      includeAttachments: true,
      attachments: snapshot?.attachments ?? [],
      pathAliases
    })
    const sourcePaths = new Set(
      linkedViewGraph.edges
        .filter((edge) => edge.targetPath === activeLinkedViewPath)
        .map((edge) => edge.sourcePath)
    )
    return normalDiscoveryNotes.filter((note) => sourcePaths.has(note.path))
  }, [activeLinkedViewPath, normalDiscoveryNotes, pathAliases, snapshot?.attachments])
  const temporalAsOf = useMemo(() => localCalendarDate(new Date()), [])

  const targetDirectory = (): string => {
    if (treeSelection?.kind === 'directory') {
      return treeSelection.path
    }
    if (treeSelection?.kind === 'note') {
      return dirnameRelative(treeSelection.path)
    }
    return selectedPath ? dirnameRelative(selectedPath) : ''
  }

  const chooseVault = async (): Promise<void> => {
    if (!beginOperation()) {
      return
    }

    vaultGenerationRef.current += 1
    vaultSwitchingRef.current = true
    if (externalChangeTimerRef.current) {
      clearTimeout(externalChangeTimerRef.current)
      externalChangeTimerRef.current = null
    }
    queuedExternalEventsRef.current.clear()
    pendingExternalEventsRef.current.length = 0
    try {
      if (!(await flushSave())) {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
        return
      }
      const result = await window.tsuzune.chooseVault()
      if (!result.ok) {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
        setMessage(errorMessage(result.error))
        return
      }
      if (result.value) {
        setCurrentSnapshot(result.value)
        setRecentNotePaths([])
        const recoveryResult = await window.tsuzune.getMoveRecovery()
        if (recoveryResult.ok) setMoveRecovery(recoveryResult.value)
        loadNoteState(null)
        setTreeSelection({ kind: 'directory', path: '' })
        setQuery('')
      } else {
        vaultSwitchingRef.current = false
        await refreshSnapshot(vaultGenerationRef.current)
      }
    } finally {
      vaultSwitchingRef.current = false
      pendingExternalEventsRef.current.length = 0
      finishOperation()
    }
  }

  const ensureDirectory = async (directory: string): Promise<boolean> => {
    const known = new Set(snapshotRef.current?.directories ?? [])
    let parent = ''
    for (const name of directory.split('/').filter(Boolean)) {
      const path = joinRelative(parent, name)
      if (!known.has(path)) {
        const result = await window.tsuzune.createDirectory({ parent, name })
        if (!result.ok && result.error.code !== 'ALREADY_EXISTS') {
          const error = errorMessage(result.error)
          setMessage(error)
          setCaptureError(error)
          return false
        }
        known.add(path)
      }
      parent = path
    }
    return true
  }

  const availableNoteName = (directory: string, preferredName: string): string => {
    const baseName = withoutMarkdownExtension(preferredName.trim()) || '無題のノート'
    const paths = new Set(
      (snapshotRef.current?.notes ?? []).map((note) => note.path.toLocaleLowerCase())
    )
    for (let suffix = 0; ; suffix += 1) {
      const name = suffix === 0 ? baseName : `${baseName} ${suffix}`
      const path = joinRelative(directory, withMarkdownExtension(name)).toLocaleLowerCase()
      if (!paths.has(path)) {
        return name
      }
    }
  }

  const createAndOpenNote = async (
    directory: string,
    preferredName: string,
    content?: string | ((name: string) => string)
  ): Promise<boolean> => {
    if (!snapshot || !beginOperation()) {
      return false
    }
    try {
      if (!(await flushSave()) || !(await ensureDirectory(directory))) {
        return false
      }
      const name = availableNoteName(directory, preferredName)
      const renderedContent = typeof content === 'function' ? content(name) : content
      const result = await window.tsuzune.createNote({
        directory,
        name,
        content: renderedContent
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return false
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
        activateNoteWorkspace(note.path)
        rememberRecentNote(note.path)
        setViewMode('edit')
        return true
      }
      setMessage('作成したノートを現在のVaultから読み込めませんでした。')
      return false
    } finally {
      finishOperation()
    }
  }

  const createNoteInDirectory = async (directory: string): Promise<void> => {
    await createAndOpenNote(directory, '無題のノート')
  }

  const createNote = async (): Promise<void> => {
    await createNoteInDirectory(targetDirectory())
  }

  const confirmQuickNoteCreate = async (value: {
    name: string
    directory: string
  }): Promise<void> => {
    setQuickCreateBusy(true)
    setQuickCreateRequest((current) =>
      current ? { ...current, name: value.name, directory: value.directory, error: null } : null
    )
    try {
      if (await createAndOpenNote(value.directory, value.name)) {
        setQuickCreateRequest(null)
        quickSwitcherPreviousFocusRef.current = null
        quickSwitcherRestoreFocusRef.current = false
        setTimeout(() => {
          document
            .querySelector<HTMLElement>('.cm-content, [aria-label="Markdown編集欄"]')
            ?.focus()
        }, 0)
      } else {
        setQuickCreateRequest((current) =>
          current
            ? {
                ...current,
                name: value.name,
                directory: value.directory,
                error: 'ノートを作成できませんでした。通知を確認してください。'
              }
            : null
        )
      }
    } finally {
      setQuickCreateBusy(false)
    }
  }

  const openOrCreateDailyNote = async (): Promise<void> => {
    const now = new Date()
    const location = dailyNoteLocation(now)
    const existing = snapshotRef.current?.notes.find(
      (note) => note.path === location.path
    )
    if (existing) {
      await openNote(existing.path)
      return
    }
    const dailyTemplate = templates.find(
      (candidate) => candidate.path === dailyTemplatePath(templateDirectory)
    )
    await createAndOpenNote(location.directory, location.name, (name) =>
      renderTemplate(
        dailyTemplate?.content ??
          '# {{date}}\n\n## 今日やったこと\n\n## 気づき\n\n## メモ\n\n## 次にすること\n\n',
        { title: name, now }
      )
    )
  }

  const startIdeaCapture = (): void => {
    setCaptureKind('idea')
    setCaptureEditPath(null)
    setCaptureError(null)
  }

  const createCapturedNote = async (
    submission: HumanNoteCaptureSubmission
  ): Promise<boolean> => {
    setCaptureError(null)
    if (!snapshot) {
      return false
    }

    const now = new Date()
    const capturedDailyDate = captureEditPath?.match(
      /^02_デイリー\/(\d{4})-(\d{2})-(\d{2})\.md$/
    )
    const dailyDate = capturedDailyDate
      ? new Date(
          Number(capturedDailyDate[1]),
          Number(capturedDailyDate[2]) - 1,
          Number(capturedDailyDate[3]),
          12
        )
      : now
    const content =
      submission.kind === 'daily'
        ? renderDailyNote({ now: dailyDate, ...submission })
        : renderIdeaNote(submission)

    if (captureEditPath) {
      if (
        selectedPathRef.current !== captureEditPath ||
        content === undefined ||
        !(await flushSave())
      ) {
        return false
      }
      handleContentChange(content)
      if (!(await flushSave())) {
        return false
      }
      setCaptureKind(null)
      setCaptureEditPath(null)
      setViewMode('preview')
      return true
    }

    const location =
      submission.kind === 'daily'
        ? dailyNoteLocation(now)
        : submission.kind === 'idea'
          ? ideaNoteLocation(submission.title)
          : null
    const existing = location
      ? snapshotRef.current?.notes.find((note) => note.path === location.path)
      : null
    if (existing) {
      const error =
        submission.kind === 'idea'
          ? `同名のアイデア「${submission.title.trim()}」は既にあります。タイトルを変えてください。`
          : '今日のノートは既にあります。入力内容を残したまま保存を中止しました。'
      setMessage(error)
      setCaptureError(error)
      return false
    }
    if (!beginOperation()) {
      return false
    }

    try {
      if (!(await flushSave())) {
        return false
      }

      const directory = location?.directory ?? ''
      if (!(await ensureDirectory(directory))) {
        return false
      }

      const name = location?.name ?? ''
      const result = await window.tsuzune.createNote({ directory, name, content })
      if (!result.ok) {
        const error = errorMessage(result.error)
        setMessage(error)
        setCaptureError(error)
        return false
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
        activateNoteWorkspace(note.path)
        rememberRecentNote(note.path)
        setViewMode('preview')
      }
      setCaptureKind(null)
      setCaptureEditPath(null)
      return true
    } finally {
      finishOperation()
    }
  }

  const createDirectoryIn = async (
    parent: string,
    name: string
  ): Promise<string | null> => {
    if (!snapshot) {
      return 'Vaultを開いてください。'
    }
    if (!beginOperation()) {
      return '別の操作が進行中です。'
    }

    try {
      if (!(await flushSave())) {
        return '保存できなかったため、フォルダーを作成できません。'
      }
      const result = await window.tsuzune.createDirectory({
        parent,
        name
      })
      if (!result.ok) {
        const message = errorMessage(result.error)
        setMessage(message)
        return message
      }
      await refreshSnapshot()
      setTreeSelection({ kind: 'directory', path: result.value.path })
      return null
    } finally {
      finishOperation()
    }
  }

  const pathChangesForRename = (
    selection: TreeSelection,
    newPath: string
  ): Map<string, string> => {
    const changes = new Map<string, string>()
    if (selection.kind === 'note') {
      changes.set(selection.path, newPath)
      return changes
    }

    for (const note of savedNotes) {
      if (isPathInsideOrEqual(note.path, selection.path)) {
        changes.set(note.path, `${newPath}${note.path.slice(selection.path.length)}`)
      }
    }
    for (const attachment of snapshot?.attachments ?? []) {
      if (isPathInsideOrEqual(attachment.path, selection.path)) {
        changes.set(
          attachment.path,
          `${newPath}${attachment.path.slice(selection.path.length)}`
        )
      }
    }
    return changes
  }

  const confirmLinkImpact = (changes: ReadonlyMap<string, string>, followsLinks = false): boolean => {
    const impact = findLinkImpact(savedNotes, changes, pathAliases)
    if (impact.affectedCount === 0) {
      return true
    }
    const examples = impact.sourcePaths.slice(0, 3).join('\n')
    if (followsLinks) {
      return window.confirm(
        `Wikiリンクのある${impact.affectedCount}件の参照元を確認しました。参照元のリンクを新しい場所へ更新します。表示名・見出し・周辺の本文は保持します。\n\n${examples}\n\n受信箱・情報源・履歴や、解決先が曖昧なリンクは更新しません。続けますか？`
      )
    }
    return window.confirm(
      `この操作により、${impact.affectedCount}件の参照元でWikiリンクが未作成または曖昧になります。\n\n${examples}\n\nそのまま続けますか？`
    )
  }

  const openRename = (selection: TreeSelection | null): void => {
    if (!snapshot || !selection || selection.path === '') {
      return
    }
    const currentName =
      selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(selection.path))
        : basenameRelative(selection.path)
    setRenameError(null)
    setRenameRequest({ selection, currentName })
  }

  const renameSelected = (): void => openRename(treeSelection)

  const renameEntry = async (
    selection: TreeSelection,
    requestedName: string
  ): Promise<string | null> => {
    if (!snapshot) {
      return 'Vaultを読み込めませんでした。'
    }
    const currentName =
      selection.kind === 'note'
        ? withoutMarkdownExtension(basenameRelative(selection.path))
        : basenameRelative(selection.path)
    const nextName = requestedName.trim()
    if (!nextName) {
      return '新しい名前を入力してください。'
    }
    if (nextName === currentName) {
      return '現在と異なる名前を入力してください。'
    }
    if (!beginOperation()) {
      return '別の処理が完了してから再試行してください。'
    }

    try {
      if (!(await flushSave())) {
        return '編集中のノートを保存できませんでした。'
      }

      const finalName =
        selection.kind === 'note'
          ? withMarkdownExtension(nextName)
          : nextName
      const newPath = joinRelative(
        dirnameRelative(selection.path),
        finalName
      )
      const changes = pathChangesForRename(selection, newPath)
      if (!confirmLinkImpact(changes, selection.kind === 'note')) {
        return null
      }

      const result = await window.tsuzune.renameEntry({
        path: selection.path,
        newName: nextName
      })
      if (!result.ok) {
        return errorMessage(result.error)
      }

      const previousSelectionPath = selection.path
      const next = await refreshSnapshot()
      setTreeSelection({ kind: selection.kind, path: result.value.path })

      if (
        selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, previousSelectionPath)
      ) {
        const mapped =
          result.value.path +
          selectedPathRef.current.slice(previousSelectionPath.length)
        const note = next?.notes.find((candidate) => candidate.path === mapped)
        if (note) {
          loadNoteState(note)
        }
      } else if (selectedPathRef.current && !dirtyRef.current) {
        const note = next?.notes.find(candidate => candidate.path === selectedPathRef.current)
        if (note && note.content !== contentRef.current) loadNoteState(note)
      }
      return null
    } finally {
      finishOperation()
    }
  }

  const confirmRename = async (requestedName: string): Promise<void> => {
    if (!renameRequest) {
      return
    }
    const error = await renameEntry(renameRequest.selection, requestedName)
    if (error) {
      setRenameError(error)
    } else {
      setRenameRequest(null)
      setRenameError(null)
    }
  }

  const moveEntryToDirectory = async (
    path: string,
    destinationDirectory: string
  ): Promise<void> => {
    if (!path || !snapshot) {
      return
    }

    if (dirnameRelative(path) === destinationDirectory) {
      return
    }

    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }

      const isDirectory = snapshot.directories.includes(path)
      const newPath = joinRelative(destinationDirectory, basenameRelative(path))
      const changes = pathChangesForRename(
        { kind: isDirectory ? 'directory' : 'note', path },
        newPath
      )
      if (!confirmLinkImpact(changes, !isDirectory && path.toLowerCase().endsWith('.md'))) {
        return
      }

      const result = isDirectory
        ? await window.tsuzune.moveEntry({ path, destinationDirectory })
        : await window.tsuzune.moveNote({ path, destinationDirectory })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }

      const next = await refreshSnapshot()
      const mapMovedPath = (candidate: string): string =>
        isPathInsideOrEqual(candidate, path)
          ? `${result.value.path}${candidate.slice(path.length)}`
          : candidate
      if (isDirectory && isPathInsideOrEqual(templateDirectory, path)) {
        const movedTemplateDirectory = mapMovedPath(templateDirectory)
        const templateResult = await window.tsuzune.setTemplateSettings({
          directory: movedTemplateDirectory,
          includeBuiltIns: showBuiltInTemplates
        })
        if (templateResult.ok) {
          setTemplateDirectory(movedTemplateDirectory)
          setTemplateDirectoryDraft(movedTemplateDirectory)
        } else {
          setMessage(errorMessage(templateResult.error))
        }
      }
      setWorkspaceTabs((current) =>
        current.map((tab) =>
          tab.kind !== 'global-graph' &&
          tab.kind !== 'observatory' &&
          isPathInsideOrEqual(tab.path, path)
            ? { ...tab, path: mapMovedPath(tab.path) }
            : tab
        )
      )
      setActiveAttachmentPath((current) =>
        current && isPathInsideOrEqual(current, path) ? mapMovedPath(current) : current
      )
      setTreeSelection((current) =>
        current && isPathInsideOrEqual(current.path, path)
          ? { ...current, path: mapMovedPath(current.path) }
          : current
      )
      if (
        selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, path)
      ) {
        const selectedPath = mapMovedPath(selectedPathRef.current)
        const note = next?.notes.find((candidate) => candidate.path === selectedPath)
        if (note) {
          loadNoteState(note)
        }
      } else if (selectedPathRef.current && !dirtyRef.current) {
        const note = next?.notes.find(candidate => candidate.path === selectedPathRef.current)
        if (note && note.content !== contentRef.current) loadNoteState(note)
      }
    } finally {
      finishOperation()
    }
  }

  const moveSelectedFile = async (destinationDirectory: string): Promise<void> => {
    const path = movePath
    setMovePath(null)
    if (path) {
      await moveEntryToDirectory(path, destinationDirectory)
    }
  }

  const saveGraphBookmark = async (title: string, group: string): Promise<void> => {
    if (!bookmarkPath) {
      return
    }
    const result = await window.tsuzune.saveBookmark({
      path: bookmarkPath,
      title,
      group
    })
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return
    }
    await refreshSnapshot()
    setBookmarkPath(null)
  }

  const removeGraphBookmark = async (): Promise<void> => {
    if (!bookmarkPath) {
      return
    }
    const result = await window.tsuzune.removeBookmark(bookmarkPath)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
      return
    }
    await refreshSnapshot()
    setBookmarkPath(null)
  }

  const trashPath = async (path: string): Promise<void> => {
    const affected = Boolean(
      selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, path)
    )

    if (
      !window.confirm(
        `「${path}」をVault内の.trashへ移動しますか？`
      )
    ) {
      return
    }

    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.trashEntry(path)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }

      await refreshSnapshot()
      if (affected) {
        loadNoteState(null)
      }
      setTreeSelection((current) =>
        current && isPathInsideOrEqual(current.path, path)
          ? { kind: 'directory', path: '' }
          : current
      )
    } finally {
      finishOperation()
    }
  }

  const trashSelected = async (): Promise<void> => {
    if (!treeSelection || treeSelection.path === '') {
      return
    }
    await trashPath(treeSelection.path)
  }

  const createMissingLink = async (target: string): Promise<void> => {
    if (!snapshot) {
      return
    }

    const path = buildNoteCreationPath(selectedPathRef.current, target)
    if (!path) {
      setMessage('このWikiリンクは有効なノートパスではありません。')
      return
    }

    const directory = dirnameRelative(path)
    if (!snapshot.directories.includes(directory)) {
      setMessage('リンク先のフォルダがありません。先にフォルダを作成してください。')
      return
    }

    if (!window.confirm(`「${path}」を作成しますか？`)) {
      return
    }
    if (!beginOperation()) {
      return
    }

    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.createNote({
        directory,
        name: basenameRelative(path)
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
        setViewMode('edit')
      }
    } finally {
      finishOperation()
    }
  }

  const handleWikiLink = (target: string): void => {
    const resolved = resolveWikiLink(target, savedNotes, pathAliases)
    if (resolved.status === 'resolved' && resolved.resolvedPath) {
      void openNote(resolved.resolvedPath)
    } else if (resolved.status === 'missing') {
      void createMissingLink(target)
    } else if (resolved.status === 'ambiguous') {
      setMessage('同名ノートが複数あります。右側の候補から選んでください。')
    } else {
      setMessage(resolved.reason ?? 'このWikiリンクは無効です。')
    }
  }

  const openGraphNode = (path: string): void => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (!node || node.kind === 'tag') {
      return
    }
    if (node.exists === false) {
      void createMissingLink(withoutMarkdownExtension(path))
      return
    }
    if (node.kind === 'attachment') {
      void window.tsuzune.openVaultFile(path).then((result) => {
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
      })
      return
    }
    void openNote(path)
  }

  const openBookmark = (path: string): void => {
    if (snapshot?.notes.some((note) => note.path === path)) {
      void openNote(path)
      return
    }
    if (snapshot?.attachments?.some((attachment) => attachment.path === path)) {
      void window.tsuzune.openVaultFile(path).then((result) => {
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
      })
      return
    }
    setMessage(`ブックマーク先「${path}」が見つかりません。`)
  }

  const revealVaultEntry = (path: string): void => {
    void window.tsuzune.revealVaultFile(path).then((result) => {
      if (!result.ok) {
        setMessage(errorMessage(result.error))
      }
    })
  }

  const revealGraphNodeInFolder = (path: string): void => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (
      !node ||
      (node.kind !== 'note' && node.kind !== 'attachment') ||
      node.exists === false
    ) {
      return
    }
    revealVaultEntry(path)
  }

  const openGraphNodeLinkedView = async (path: string): Promise<void> => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (!node || node.kind === 'tag' || node.exists === false || !beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }

      const existing = workspaceTabs.find(
        (tab) => tab.kind === 'linked-view' && tab.path === path
      )
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        const currentTabs = workspaceTabs.length > 0
          ? workspaceTabs
          : viewMode === 'graph' && graphScope === 'vault'
            ? [{ id: nextTabIdRef.current++, kind: 'global-graph' as const }]
            : selectedPathRef.current
              ? [{
                  id: nextTabIdRef.current++,
                  kind: 'note' as const,
                  path: selectedPathRef.current
                }]
              : []
        const nextTab: WorkspaceTab = {
          id: nextTabIdRef.current++,
          kind: 'linked-view',
          path
        }
        setWorkspaceTabs([...currentTabs, nextTab])
        setActiveTabId(nextTab.id)
      }

      loadNoteState(null, false)
      setActiveLinkedViewPath(path)
      setMessage(null)
    } finally {
      finishOperation()
    }
  }

  const loadWorkspaceTab = async (tab: WorkspaceTab): Promise<boolean> => {
    if (!beginOperation()) {
      return false
    }
    try {
      if (!(await flushSave())) {
        return false
      }
      if (tab.kind === 'global-graph' || tab.kind === 'observatory') {
        setActiveTabId(tab.id)
        setActiveAttachmentPath(null)
        setActiveLinkedViewPath(null)
        if (tab.kind === 'observatory') {
          loadNoteState(null, false)
        }
        setGraphScope('vault')
        setViewMode('graph')
        setMessage(null)
        return true
      }
      if (tab.kind === 'attachment') {
        setActiveTabId(tab.id)
        setActiveAttachmentPath(tab.path)
        setActiveLinkedViewPath(null)
        setMessage(null)
        return true
      }
      if (tab.kind === 'linked-view') {
        setActiveTabId(tab.id)
        loadNoteState(null, false)
        setActiveLinkedViewPath(tab.path)
        setMessage(null)
        return true
      }
      const note = snapshotRef.current?.notes.find(
        (candidate) => candidate.path === tab.path
      )
      if (!note) {
        setMessage('このノートは現在のVaultにありません。')
        return false
      }
      setActiveTabId(tab.id)
      loadNoteState(note)
      rememberRecentNote(note.path)
      setViewMode('preview')
      return true
    } finally {
      finishOperation()
    }
  }

  const openGlobalGraphWorkspace = (): void => {
    const existing = workspaceTabs.find((tab) => tab.kind === 'global-graph')
    if (existing) {
      setActiveTabId(existing.id)
    } else {
      const currentTabs = workspaceTabs.length > 0
        ? workspaceTabs
        : selectedPathRef.current
          ? [{ id: nextTabIdRef.current++, kind: 'note' as const, path: selectedPathRef.current }]
          : []
      const graphTab: WorkspaceTab = {
        id: nextTabIdRef.current++,
        kind: 'global-graph'
      }
      setWorkspaceTabs([...currentTabs, graphTab])
      setActiveTabId(graphTab.id)
    }
    setActiveAttachmentPath(null)
    setActiveLinkedViewPath(null)
    setGraphScope('vault')
    setViewMode('graph')
  }

  const openObservatoryWorkspace = (): void => {
    const existing = workspaceTabs.find((tab) => tab.kind === 'observatory')
    const observatoryTab: WorkspaceTab = existing ?? {
      id: nextTabIdRef.current++,
      kind: 'observatory'
    }
    if (!existing) {
      const currentTabs = workspaceTabs.length > 0
        ? workspaceTabs
        : selectedPathRef.current
          ? [{ id: nextTabIdRef.current++, kind: 'note' as const, path: selectedPathRef.current }]
          : []
      setWorkspaceTabs([...currentTabs, observatoryTab])
    }
    void loadWorkspaceTab(observatoryTab)
  }

  const openVaultEntryInNewTab = async (
    path: string,
    kind: 'note' | 'attachment'
  ): Promise<void> => {
    if (!beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }

      const currentTabs = workspaceTabs.length > 0
        ? workspaceTabs
        : viewMode === 'graph' && graphScope === 'vault'
          ? [{ id: nextTabIdRef.current++, kind: 'global-graph' as const }]
          : selectedPathRef.current
            ? [{ id: nextTabIdRef.current++, kind: 'note' as const, path: selectedPathRef.current }]
            : []
      const nextTab: WorkspaceTab = {
        id: nextTabIdRef.current++,
        kind,
        path
      }
      setWorkspaceTabs([...currentTabs, nextTab])
      setActiveTabId(nextTab.id)
      setActiveLinkedViewPath(null)

      if (nextTab.kind === 'attachment') {
        setActiveAttachmentPath(path)
        setMessage(null)
        return
      }
      const note = snapshotRef.current?.notes.find((candidate) => candidate.path === path)
      if (!note) {
        setMessage('このノートは現在のVaultにありません。')
        return
      }
      loadNoteState(note)
      setActiveTabId(nextTab.id)
      rememberRecentNote(note.path)
      setViewMode('preview')
    } finally {
      finishOperation()
    }
  }

  const openGraphNodeInNewTab = async (path: string): Promise<void> => {
    const node = visibleGraph.nodes.find((candidate) => candidate.path === path)
    if (
      !node ||
      (node.kind !== 'note' && node.kind !== 'attachment') ||
      node.exists === false
    ) {
      return
    }
    await openVaultEntryInNewTab(path, node.kind)
  }

  const openGraphNodeInNewWindow = async (path: string): Promise<void> => {
    if (!(await flushSave())) {
      return
    }
    const result = await window.tsuzune.openVaultFileWindow(path)
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const copyGraphNodePath = async (
    path: string,
    format: CopyPathFormat
  ): Promise<void> => {
    if (!snapshot) {
      return
    }
    const result = await window.tsuzune.copyText(
      formatPathForCopy(snapshot.rootPath, snapshot.rootName, path, format)
    )
    if (!result.ok) {
      setMessage(errorMessage(result.error))
    }
  }

  const closeWorkspaceTab = async (tabId: number): Promise<void> => {
    const index = workspaceTabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) {
      return
    }
    const remaining = workspaceTabs.filter((tab) => tab.id !== tabId)
    if (tabId !== activeTabId) {
      setWorkspaceTabs(remaining)
      if (workspaceTabFocusId === tabId && activeTabId !== null) {
        focusWorkspaceTab(activeTabId)
      }
      return
    }
    const next = remaining[Math.min(index, remaining.length - 1)]
    if (next) {
      if (await loadWorkspaceTab(next)) {
        setWorkspaceTabs(remaining)
        focusWorkspaceTab(next.id)
      }
      return
    }
    if (!beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      setWorkspaceTabs(remaining)
      setActiveTabId(null)
      setActiveAttachmentPath(null)
      setActiveLinkedViewPath(null)
      loadNoteState(null, false)
      setViewMode('preview')
    } finally {
      finishOperation()
    }
  }

  const activateWorkspaceTabFromKeyboard = (tab: WorkspaceTab): void => {
    void loadWorkspaceTab(tab).then((loaded) => {
      if (loaded) {
        focusWorkspaceTab(tab.id)
      }
    })
  }

  const handleWorkspaceTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: WorkspaceTab
  ): void => {
    if (event.nativeEvent.isComposing) {
      return
    }
    const index = workspaceTabs.findIndex((candidate) => candidate.id === tab.id)
    if (index < 0) {
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const offset = event.key === 'ArrowLeft' ? -1 : 1
      const next = workspaceTabs[(index + offset + workspaceTabs.length) % workspaceTabs.length]
      focusWorkspaceTab(next.id)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateWorkspaceTabFromKeyboard(tab)
    }
  }

  useEffect(() => {
    const handleWorkspaceShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.repeat || event.isComposing) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'w' && (modalOpen || isTextEditingTarget(event.target))) {
        event.preventDefault()
        return
      }
      if (modalOpen || busyRef.current || workspaceTabs.length === 0) {
        return
      }

      let target: WorkspaceTab | undefined
      if (key === 'tab') {
        const currentIndex = Math.max(
          0,
          workspaceTabs.findIndex((tab) => tab.id === activeTabId)
        )
        const offset = event.shiftKey ? -1 : 1
        target = workspaceTabs[
          (currentIndex + offset + workspaceTabs.length) % workspaceTabs.length
        ]
      } else if (/^[1-9]$/.test(key)) {
        const index = key === '9' ? workspaceTabs.length - 1 : Number(key) - 1
        target = workspaceTabs[index]
      } else if (
        key === 'w' &&
        activeTabId !== null &&
        !isTextEditingTarget(event.target)
      ) {
        event.preventDefault()
        void closeWorkspaceTab(activeTabId)
        return
      }

      if (target) {
        event.preventDefault()
        activateWorkspaceTabFromKeyboard(target)
      }
    }

    window.addEventListener('keydown', handleWorkspaceShortcut)
    return () => window.removeEventListener('keydown', handleWorkspaceShortcut)
  }, [activeTabId, modalOpen, workspaceTabs])

  const activeAttachment: VaultAttachment | null = activeAttachmentPath
    ? snapshot?.attachments?.find((item) => item.path === activeAttachmentPath) ?? null
    : null

  const searchGraphTag = (tag: string): void => {
    setQuery(`tag:${tag}`)
    focusVaultSearch()
  }

  const validateCalendarPath = (path: string, markdownOnly = false): string => {
    const normalized = path.replaceAll('\\', '/')
    const validation = validateRelativePath(normalized)
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.reason ?? 'Calendarから無効なパスが渡されました。')
    }
    if (markdownOnly && !validation.normalized.toLocaleLowerCase().endsWith('.md')) {
      throw new Error('Calendarが作成・操作できるのはMarkdownノートだけです。')
    }
    return validation.normalized
  }

  const openCalendarNote = async (
    path: string,
    newSplit: boolean
  ): Promise<void> => {
    const normalized = validateCalendarPath(path, true)
    if (newSplit) {
      await openVaultEntryInNewTab(normalized, 'note')
    } else {
      await openNote(normalized)
    }
  }

  const createCalendarDirectory = async (path: string): Promise<{ path: string }> => {
    const normalized = validateCalendarPath(path)
    if (!beginOperation()) throw new Error('別の操作が完了するまでお待ちください。')
    try {
      if (!(await flushSave()) || !(await ensureDirectory(normalized))) {
        throw new Error('Calendarのフォルダを作成できませんでした。')
      }
      return { path: normalized }
    } finally {
      finishOperation()
    }
  }

  const createCalendarNote = async (payload: {
    path: string
    content: string
  }): Promise<NoteDocument> => {
    const path = validateCalendarPath(payload.path, true)
    const directory = dirnameRelative(path)
    const name = withoutMarkdownExtension(basenameRelative(path))
    if (!snapshotRef.current || !beginOperation()) {
      throw new Error('別の操作が完了するまでお待ちください。')
    }
    try {
      if (!(await flushSave()) || !(await ensureDirectory(directory))) {
        throw new Error('Calendarのノート作成準備を完了できませんでした。')
      }
      const result = await window.tsuzune.createNote({
        directory,
        name,
        content: payload.content
      })
      if (!result.ok) {
        const error = errorMessage(result.error)
        setMessage(error)
        throw new Error(error)
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (!note) {
        throw new Error('作成したCalendarノートをVaultから再読込できませんでした。')
      }
      return note
    } finally {
      finishOperation()
    }
  }

  const saveCalendarPluginSettings = async (
    value: CalendarPluginSettings
  ): Promise<null> => {
    const settings = parseCalendarPluginSettings(value)
    const result = await window.tsuzune.setCalendarPluginSettings(settings)
    if (!result.ok) {
      const error = errorMessage(result.error)
      setMessage(error)
      throw new Error(error)
    }
    setCalendarPluginSettings({ ...settings })
    setCalendarPluginSettingsDraft({ ...settings })
    return null
  }

  const trashCalendarNote = async (path: string): Promise<null> => {
    const normalized = validateCalendarPath(path, true)
    if (!beginOperation()) throw new Error('別の操作が完了するまでお待ちください。')
    try {
      if (!(await flushSave())) {
        throw new Error('編集中のノートを保存できなかったため削除を中止しました。')
      }
      const result = await window.tsuzune.trashEntry(normalized)
      if (!result.ok) {
        const error = errorMessage(result.error)
        setMessage(error)
        throw new Error(error)
      }
      await refreshSnapshot()
      if (
        selectedPathRef.current &&
        isPathInsideOrEqual(selectedPathRef.current, normalized)
      ) {
        loadNoteState(null)
      }
      return null
    } finally {
      finishOperation()
    }
  }

  const showSettingsDialog = async (
    previousFocus: HTMLElement | null
  ): Promise<void> => {
    settingsDialogPreviousFocusRef.current = previousFocus
    setSettingsError(null)
    setExcludedFilesDraft(userIgnoreFilters.join('\n'))
    setAiReviewPathsDraft(aiReviewPaths.join('\n'))
    setTemplateDirectoryDraft(templateDirectory)
    setShowBuiltInTemplatesDraft(showBuiltInTemplates)
    setCalendarPluginSettingsDraft({ ...calendarPluginSettings })
    setSettingsCategory('files')
    setSettingsDialogOpen(true)
    setObsidianPluginsLoading(true)
    const [proposals, plugins, calendarStatus] = await Promise.all([
      window.tsuzune.listAiReviewProposals(),
      window.tsuzune.listObsidianPluginCandidates(),
      window.tsuzune.getCalendarPluginStatus()
    ])
    const errors: string[] = []
    if (proposals.ok) setAiReviewProposals(proposals.value)
    else errors.push(errorMessage(proposals.error))
    if (plugins.ok) setObsidianPluginCandidates(plugins.value)
    else errors.push(errorMessage(plugins.error))
    if (calendarStatus.ok) setCalendarPluginStatus(calendarStatus.value)
    else errors.push(errorMessage(calendarStatus.error))
    setObsidianPluginsLoading(false)
    setSettingsError(errors.length > 0 ? errors.join(' ') : null)
  }

  const refreshObsidianPluginCandidates = async (): Promise<void> => {
    setSettingsError(null)
    setObsidianPluginsLoading(true)
    const result = await window.tsuzune.listObsidianPluginCandidates()
    setObsidianPluginsLoading(false)
    if (result.ok) {
      setObsidianPluginCandidates(result.value)
    } else {
      setSettingsError(errorMessage(result.error))
    }
  }

  const refreshCalendarPluginStatus = async (): Promise<void> => {
    setSettingsError(null)
    const result = await window.tsuzune.getCalendarPluginStatus()
    if (result.ok) {
      setCalendarPluginStatus(result.value)
      setCalendarPluginError(null)
      setCalendarPluginFailed(false)
    } else {
      setSettingsError(errorMessage(result.error))
    }
  }

  const openSettingsDialog = async (): Promise<void> => {
    await showSettingsDialog(
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    )
  }

  const openDailyNoteFromCalendar = async (date: Date): Promise<void> => {
    const location = dailyNoteLocation(date)
    const existing = snapshotRef.current?.notes.find(
      (note) => note.path === location.path
    )
    if (!existing) {
      setMessage(`${date.getMonth() + 1}月${date.getDate()}日のノートはまだありません。`)
      return
    }
    setMessage(null)
    await openNote(existing.path)
  }

  const settingsHaveUnsavedChanges =
    excludedFilesDraft !== userIgnoreFilters.join('\n') ||
    aiReviewPathsDraft !== aiReviewPaths.join('\n') ||
    templateDirectoryDraft !== templateDirectory ||
    showBuiltInTemplatesDraft !== showBuiltInTemplates ||
    JSON.stringify(calendarPluginSettingsDraft) !==
      JSON.stringify(calendarPluginSettings)

  const closeSettingsDialog = (): void => {
    if (settingsBusy) {
      return
    }
    if (
      settingsHaveUnsavedChanges &&
      !window.confirm('未保存の設定変更があります。破棄して閉じますか？')
    ) {
      return
    }
    setSettingsError(null)
    setSettingsDialogOpen(false)
  }

  const handleSettingsDialogKeyDown = (
    event: React.KeyboardEvent<HTMLElement>
  ): void => {
    if (event.key === 'Escape' && !settingsBusy) {
      event.preventDefault()
      closeSettingsDialog()
      return
    }
    trapDialogTab(event, settingsDialogRef.current)
  }

  const saveSettings = async (): Promise<void> => {
    const nextFilters = excludedFilesDraft
      .split(/\r?\n/)
      .map((filter) => filter.trim())
      .filter(Boolean)
    const nextAiReviewPaths = aiReviewPathsDraft
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)

    setSettingsBusy(true)
    setSettingsError(null)
    try {
      const result = await window.tsuzune.setUserIgnoreFilters(nextFilters)
      if (!result.ok) {
        setSettingsError(errorMessage(result.error))
        return
      }
      setUserIgnoreFilters(nextFilters)
      setExcludedFilesDraft(nextFilters.join('\n'))
      const reviewResult = await window.tsuzune.setAiReviewPaths(nextAiReviewPaths)
      if (!reviewResult.ok) {
        setSettingsError(
          `ファイルとリンクは保存済みです。${errorMessage(reviewResult.error)}`
        )
        return
      }
      setAiReviewPaths(nextAiReviewPaths)
      setAiReviewPathsDraft(nextAiReviewPaths.join('\n'))
      const templateResult = await window.tsuzune.setTemplateSettings({
        directory: templateDirectoryDraft,
        includeBuiltIns: showBuiltInTemplatesDraft
      })
      if (!templateResult.ok) {
        setSettingsError(
          `ファイルとリンク、AIとレビューは保存済みです。${errorMessage(templateResult.error)}`
        )
        return
      }
      setTemplateDirectory(templateDirectoryDraft)
      setShowBuiltInTemplates(showBuiltInTemplatesDraft)
      const nextCalendarSettings = parseCalendarPluginSettings(
        calendarPluginSettingsDraft
      )
      const calendarResult = await window.tsuzune.setCalendarPluginSettings(
        nextCalendarSettings
      )
      if (!calendarResult.ok) {
        setSettingsError(
          `ファイル、AI、テンプレートは保存済みです。${errorMessage(calendarResult.error)}`
        )
        return
      }
      setCalendarPluginSettings({ ...nextCalendarSettings })
      setCalendarPluginSettingsDraft({ ...nextCalendarSettings })
      await refreshSnapshot()
      setSettingsDialogOpen(false)
    } finally {
      setSettingsBusy(false)
    }
  }

  const resolveAiReviewProposal = async (
    proposal: AiWriteReviewProposal,
    approve: boolean
  ): Promise<void> => {
    setSettingsBusy(true)
    setSettingsError(null)
    try {
      const result = approve
        ? await window.tsuzune.approveAiReviewProposal(proposal.id)
        : await window.tsuzune.cancelAiReviewProposal(proposal.id)
      if (!result.ok) {
        setSettingsError(errorMessage(result.error))
      }
      const proposals = await window.tsuzune.listAiReviewProposals()
      if (proposals.ok) setAiReviewProposals(proposals.value)
      else setSettingsError(errorMessage(proposals.error))
      if (approve && result.ok) await refreshSnapshot()
    } finally {
      setSettingsBusy(false)
    }
  }

  const openGoogleDialog = async (): Promise<void> => {
    googleDialogPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setGoogleAdvancedOpen(false)
    setGoogleError(null)
    setGoogleDialogOpen(true)
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.getGoogleDriveStatus()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
    } finally {
      setGoogleBusy(false)
    }
  }

  const closeGoogleDialog = (): void => {
    if (googleBusy || busy) {
      return
    }
    setGoogleDialogOpen(false)
  }

  const handleGoogleDialogKeyDown = (
    event: React.KeyboardEvent<HTMLElement>
  ): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeGoogleDialog()
      return
    }
    trapDialogTab(event, googleDialogRef.current)
  }

  const chooseGoogleConfig = async (): Promise<void> => {
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.chooseGoogleOAuthConfig()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      if (result.value) {
        setGoogleStatus(result.value)
        setMessage('Google OAuth設定を読み込みました。')
      }
    } finally {
      setGoogleBusy(false)
    }
  }

  const connectGoogle = async (): Promise<void> => {
    setGoogleBusy(true)
    setGoogleError(null)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.connectGoogle()
      if (!result.ok) {
        const nextError = errorMessage(result.error)
        setGoogleError(nextError)
        setMessage(nextError)
        return
      }
      setGoogleStatus(result.value)
      setMessage(`${result.value.account?.email ?? 'Googleアカウント'}に接続しました。`)
    } finally {
      setGoogleBusy(false)
    }
  }

  const authorizeGoogleCalendar = async (): Promise<void> => {
    setGoogleBusy(true)
    setGoogleError(null)
    try {
      const result = await window.tsuzune.authorizeGoogleCalendar()
      if (!result.ok) {
        const nextError = errorMessage(result.error)
        setGoogleError(nextError)
        setMessage(nextError)
        return
      }
      setGoogleStatus(result.value)
      setMessage('Google Calendarの読取権限を有効にしました。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const disconnectGoogle = async (): Promise<void> => {
    if (!window.confirm('この端末からGoogle接続情報を削除しますか？')) {
      return
    }
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.disconnectGoogle()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
      setDriveVaults([])
      setSelectedDriveVaultId('')
      setMessage('Googleアカウントとの接続を解除しました。Drive上のファイルは残ります。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const listRemoteDriveVaults = async (): Promise<void> => {
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.listDriveVaults()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setDriveVaults(result.value)
      setSelectedDriveVaultId(result.value[0]?.rootFolderId ?? '')
      setMessage(
        result.value.length > 0
          ? `${result.value.length}件のDrive Vaultが見つかりました。`
          : '接続できる既存のDrive Vaultはありません。'
      )
    } finally {
      setGoogleBusy(false)
    }
  }

  const pairRemoteDriveVault = async (): Promise<void> => {
    const selected = driveVaults.find(
      (candidate) => candidate.rootFolderId === selectedDriveVaultId
    )
    if (!selected) {
      return
    }
    setGoogleBusy(true)
    setDrivePreview(null)
    try {
      const result = await window.tsuzune.pairDriveVault({
        rootFolderId: selected.rootFolderId,
        vaultId: selected.vaultId
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setGoogleStatus(result.value)
      setMessage('Drive Vaultを接続しました。')
    } finally {
      setGoogleBusy(false)
    }
  }

  const previewGoogleDriveSync = async (): Promise<void> => {
    if (!snapshot || !beginOperation()) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.previewDriveSync()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setDrivePreview(result.value)
    } finally {
      finishOperation()
    }
  }

  const applyGoogleDriveSync = async (): Promise<void> => {
    if (
      !drivePreview ||
      !window.confirm(
        '表示中の同期内容を適用しますか？削除は伝播せず、競合は別ノートとして残します。'
      ) ||
      !beginOperation()
    ) {
      return
    }
    try {
      if (!(await flushSave())) {
        return
      }
      const result = await window.tsuzune.applyDriveSync(drivePreview.planId)
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const currentPath = selectedPathRef.current
      const next = await refreshSnapshot()
      if (currentPath) {
        loadNoteState(
          next?.notes.find((note) => note.path === currentPath) ?? null
        )
      }
      setDrivePreview(null)
      const status = await window.tsuzune.getGoogleDriveStatus()
      if (status.ok) {
        setGoogleStatus(status.value)
      }
      setMessage(
        `Drive同期完了: 送信${result.value.uploaded} / 受信${result.value.downloaded} / 移動${result.value.moved} / 競合${result.value.conflicts} / 保持${result.value.preserved}`
      )
    } finally {
      finishOperation()
    }
  }

  const loadExternalVersion = (): void => {
    if (conflict?.kind !== 'changed') {
      return
    }
    if (!window.confirm('TSUZUNE内の未保存変更を破棄して外部版を読み込みますか？')) {
      return
    }

    contentRef.current = conflict.externalContent
    expectedContentRef.current = conflict.externalContent
    setContent(conflict.externalContent)
    modifiedAtRef.current = conflict.externalModifiedAt
    setModifiedAt(conflict.externalModifiedAt)
    const path = selectedPathRef.current
    if (path) {
      updateSnapshotNote(
        path,
        conflict.externalContent,
        conflict.externalModifiedAt,
        conflict.externalSize
      )
    }
    versionRef.current += 1
    dirtyRef.current = false
    setCurrentConflict(null)
    setSaveStatus('saved')
    setMessage(null)
  }

  const keepLocalVersion = (): void => {
    if (conflict?.kind !== 'changed') {
      return
    }
    setCurrentConflict({ ...conflict, localHeld: true })
    setMessage('自動保存を停止しています。明示的に上書き保存してください。')
  }

  const overwriteExternal = async (): Promise<void> => {
    if (!window.confirm('外部版を現在の編集中内容で上書きしますか？')) {
      return
    }
    if (!beginOperation()) {
      return
    }
    try {
      setCurrentConflict(null)
      dirtyRef.current = true
      await flushSave(true)
    } finally {
      finishOperation()
    }
  }

  const saveMissingAsNew = async (): Promise<void> => {
    const oldPath = selectedPathRef.current
    if (!oldPath || !snapshot) {
      return
    }
    const name = window.prompt(
      '別名で保存するノート名',
      `${withoutMarkdownExtension(basenameRelative(oldPath))}-復元`
    )
    if (!name) {
      return
    }
    if (!beginOperation()) {
      return
    }
    const oldDirectory = dirnameRelative(oldPath)
    const directory = snapshot.directories.includes(oldDirectory) ? oldDirectory : ''
    try {
      const result = await window.tsuzune.createNote({
        directory,
        name,
        content: contentRef.current
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      const next = await refreshSnapshot()
      const note = next?.notes.find((candidate) => candidate.path === result.value.path)
      if (note) {
        loadNoteState(note)
      }
    } finally {
      finishOperation()
    }
  }

  const discardMissing = (): void => {
    if (!window.confirm('編集中の内容を破棄して閉じますか？')) {
      return
    }
    loadNoteState(null)
  }

  const updateActionLabel = (): string => {
    const version = updateStatus.availableVersion
    switch (updateStatus.phase) {
      case 'available':
        return version ? `TSUZUNE ${version}を取得` : '更新を取得'
      case 'downloading':
        return `更新 ${Math.round(updateStatus.downloadPercent ?? 0)}%`
      case 'downloaded':
        return version ? `TSUZUNE ${version}を適用` : '更新を適用'
      case 'checking':
        return '確認中…'
      default:
        return '更新を確認'
    }
  }

  const handleUpdateAction = async (): Promise<void> => {
    if (updateBusy || updateStatus.phase === 'disabled') {
      return
    }

    setUpdateBusy(true)
    try {
      if (updateStatus.phase === 'downloaded') {
        if (!(await flushSave())) {
          setMessage('編集中のノートを保存できなかったため、更新を中止しました。')
          return
        }
        const result = await window.tsuzune.installUpdate()
        if (!result.ok) {
          setMessage(errorMessage(result.error))
        }
        return
      }

      const result =
        updateStatus.phase === 'available'
          ? await window.tsuzune.downloadUpdate()
          : await window.tsuzune.checkForUpdates()
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      setUpdateStatus(result.value)
      if (result.value.message) {
        setMessage(result.value.message)
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  const noteCommandDisabledReason = selectedPath
    ? undefined
    : 'ノートを選択すると使えます'
  const commandPaletteCommands: CommandPaletteCommand[] = [
    {
      id: 'new-note',
      label: '新規ノートを作成',
      keywords: ['ノート', '作成', 'new', 'note', 'create']
    },
    {
      id: 'inbox-note',
      label: '受信箱へメモを作成',
      keywords: ['受信箱', 'メモ', 'inbox', 'capture']
    },
    {
      id: 'today-note',
      label: '今日のノートを開く',
      keywords: ['今日', 'デイリー', 'daily', 'today']
    },
    {
      id: 'open-note',
      label: 'ノートを開く',
      keywords: ['クイックスイッチャー', 'quick switcher', 'open', 'note'],
      shortcut: 'Ctrl+O / Meta+O'
    },
    {
      id: 'vault-search',
      label: '内容を検索',
      keywords: ['全文検索', '検索', 'vault', 'search', 'find in files'],
      shortcut: 'Ctrl+Shift+F / Meta+Shift+F'
    },
    {
      id: 'toggle-left-sidebar',
      label: leftSidebarOpen ? '左サイドバーを閉じる' : '左サイドバーを開く',
      keywords: ['左', 'サイドバー', 'left', 'sidebar', 'navigation'],
      state: leftSidebarOpen ? '表示中' : '非表示'
    },
    {
      id: 'toggle-right-sidebar',
      label: rightSidebarOpen ? '右サイドバーを閉じる' : '右サイドバーを開く',
      keywords: ['右', 'サイドバー', 'right', 'sidebar', 'context'],
      state: rightSidebarOpen ? '表示中' : '非表示'
    },
    {
      id: 'edit-mode',
      label: '編集に切り替える',
      keywords: ['編集', 'edit', 'source', 'markdown'],
      state: viewMode === 'edit' ? '表示中' : undefined,
      disabledReason: noteCommandDisabledReason
    },
    {
      id: 'preview-mode',
      label: 'プレビューに切り替える',
      keywords: ['プレビュー', 'preview', 'reading'],
      state: viewMode === 'preview' ? '表示中' : undefined,
      disabledReason: noteCommandDisabledReason
    },
    {
      id: 'local-graph',
      label: 'ローカルグラフを開く',
      keywords: ['ローカルグラフ', 'local', 'graph', 'このノート'],
      state: viewMode === 'graph' && graphScope === 'local' ? '表示中' : undefined,
      disabledReason: noteCommandDisabledReason
    },
    {
      id: 'vault-graph',
      label: 'Vaultグラフを開く',
      keywords: ['グラフ', 'vault', 'graph', '全体'],
      state: workspaceTabs.some(
        (tab) => tab.id === activeTabId && tab.kind === 'global-graph'
      ) ? '表示中' : undefined
    },
    {
      id: 'observatory',
      label: '観測宙域を開く',
      keywords: ['観測宙域', '宇宙', '鑑賞', 'observatory'],
      state: workspaceTabs.some(
        (tab) => tab.id === activeTabId && tab.kind === 'observatory'
      ) ? '表示中' : undefined
    },
    {
      id: 'show-bookmarks',
      label: 'ブックマークを表示',
      keywords: ['ブックマーク', 'bookmark', 'favorite', 'saved'],
      state: leftSidebarView === 'bookmarks' && leftSidebarOpen ? '表示中' : undefined
    },
    {
      id: 'open-settings',
      label: '設定を開く',
      keywords: ['設定', 'settings', 'preferences', 'config']
    }
  ]
  if (calendarPluginStatus?.state === 'ready') {
    commandPaletteCommands.push(
      {
        id: 'calendar-show-calendar-view',
        label: 'Calendar: ビューを開く',
        keywords: ['calendar', 'カレンダー', 'open view'],
        state: rightSidebarOpen && calendarPluginActivated ? '表示中' : undefined
      },
      {
        id: 'calendar-open-weekly-note',
        label: 'Calendar: 週次ノートを開く',
        keywords: ['calendar', 'weekly', '週次', '週番号']
      },
      {
        id: 'calendar-reveal-active-note',
        label: 'Calendar: 選択中のノートを表示',
        keywords: ['calendar', 'reveal', '選択', '今日'],
        disabledReason: noteCommandDisabledReason
      }
    )
  }

  const executeCommandPaletteCommand = (id: string): void => {
    const run = (action: () => void): void => {
      closeCommandPalette()
      action()
    }

    switch (id) {
      case 'new-note':
        run(() => void createNote())
        return
      case 'inbox-note':
        run(() => void createNoteInDirectory('01_受信箱'))
        return
      case 'today-note':
        run(() => void openOrCreateDailyNote())
        return
      case 'open-note': {
        const previousFocus = dismissCommandPalette()
        quickSwitcherPreviousFocusRef.current = previousFocus
        quickSwitcherRestoreFocusRef.current = true
        setQuickSwitcherOpen(true)
        return
      }
      case 'vault-search':
        dismissCommandPalette()
        focusVaultSearch()
        return
      case 'toggle-left-sidebar':
        run(() => setLeftSidebarOpen((current) => !current))
        return
      case 'toggle-right-sidebar':
        run(() => setRightSidebarOpen((current) => !current))
        return
      case 'edit-mode':
        run(() => setViewMode('edit'))
        return
      case 'preview-mode':
        run(() => setViewMode('preview'))
        return
      case 'local-graph':
        run(() => {
          setGraphScope('local')
          setViewMode('graph')
        })
        return
      case 'vault-graph':
        run(openGlobalGraphWorkspace)
        return
      case 'observatory':
        run(openObservatoryWorkspace)
        return
      case 'show-bookmarks':
        run(() => {
          setLeftSidebarOpen(true)
          setQuery('')
          setLeftSidebarView('bookmarks')
        })
        return
      case 'open-settings': {
        const previousFocus = dismissCommandPalette()
        void showSettingsDialog(previousFocus)
        return
      }
      case 'calendar-show-calendar-view':
        run(() => {
          setRightSidebarOpen(true)
          calendarPluginFrameRef.current?.runCommand('show-calendar-view')
        })
        return
      case 'calendar-open-weekly-note':
        run(() => {
          setRightSidebarOpen(true)
          calendarPluginFrameRef.current?.runCommand('open-weekly-note')
        })
        return
      case 'calendar-reveal-active-note':
        run(() => {
          setRightSidebarOpen(true)
          calendarPluginFrameRef.current?.runCommand('reveal-active-note')
        })
        return
    }
  }

  const workspaceTabBar = (
    <WorkspaceTabBar
      tabs={workspaceTabs}
      activeTabId={activeTabId}
      focusTabId={workspaceTabFocusId}
      tabRefs={workspaceTabRefs}
      onActivate={(tab) => void loadWorkspaceTab(tab)}
      onClose={(tabId) => void closeWorkspaceTab(tabId)}
      onFocus={setWorkspaceTabFocusId}
      onKeyDown={handleWorkspaceTabKeyDown}
    />
  )
  const activeWorkspaceTab = workspaceTabs.find((tab) => tab.id === activeTabId) ?? null

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <img src={tsuzuneMark} alt="TSUZUNE" />
        <span>Vaultを整えています…</span>
      </div>
    )
  }

  return (
    <div className={`app-shell${busy ? ' is-busy' : ''}`} aria-busy={busy}>
      {busy && (
        <div className="operation-overlay" role="status" aria-live="polite">
          <img src={tsuzuneMark} alt="" aria-hidden="true" />
          <span>処理中…</span>
        </div>
      )}
      {message && (
        <div className="message-banner" role="status" inert={busy || modalOpen}>
          <span>{message}</span>
          {saveStatus === 'error' && (
            <button type="button" onClick={() => void flushSave()}>
              再試行
            </button>
          )}
          <button type="button" aria-label="通知を閉じる" onClick={() => setMessage(null)}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {moveRecovery.status === 'recovery-required' && (
        <div className="conflict-banner" role="alert">
          <strong>未完了の移動を安全に判定できません。新しい移動を停止しています。</strong>
          <span>
            {moveRecovery.source || '不明'} → {moveRecovery.destination || '不明'}
          </span>
        </div>
      )}

      <ConflictBanner
        conflict={conflict}
        inert={busy || modalOpen}
        onLoadExternal={loadExternalVersion}
        onKeepLocal={keepLocalVersion}
        onOverwriteExternal={() => void overwriteExternal()}
        onSaveMissingAsNew={() => void saveMissingAsNew()}
        onDiscardMissing={discardMissing}
      />

      {!snapshot ? (
        <main className="welcome" inert={busy || modalOpen}>
          <div>
            <img className="welcome-mark" src={tsuzuneMark} alt="" aria-hidden="true" />
            <p className="eyebrow">LOCAL MARKDOWN NOTEBOOK</p>
            <h1>最初のVaultを開きましょう</h1>
            <p>
              ローカルフォルダを選ぶと、Markdownノートを作成してWikiリンクでつなげられます。
            </p>
            <button type="button" className="primary-button" onClick={() => void chooseVault()}>
              <Icon name="folder-open" />
              Vaultを開く
            </button>
          </div>
        </main>
      ) : (
        <main
          className={`workspace${leftSidebarOpen ? '' : ' is-left-sidebar-collapsed'}${
            rightSidebarOpen ? '' : ' is-right-sidebar-collapsed'
          }`}
          inert={busy || modalOpen}
        >
          <aside className={`left-panel${leftSidebarOpen ? '' : ' is-collapsed'}`}>
          <nav className="activity-rail" aria-label="主なナビゲーション">
            <div className="activity-rail-main">
            <button
              type="button"
              className="activity-rail-button"
              aria-label="ファイル"
              title="ファイル"
              aria-pressed={leftSidebarOpen && leftSidebarView === 'files'}
              onClick={() => {
                setLeftSidebarOpen(true)
                setQuery('')
                setLeftSidebarView('files')
              }}
            >
              <Icon name="folder" />
              <span className="sr-only">ファイル</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="内容を検索"
              aria-keyshortcuts="Control+Shift+F Meta+Shift+F Control+K Meta+K"
              title="内容を検索（Ctrl+Shift+F、Ctrl+K）"
              aria-pressed={leftSidebarOpen && leftSidebarView === 'search'}
              onClick={focusVaultSearch}
            >
              <Icon name="search" />
              <span className="sr-only">検索</span>
            </button>
            <span className="activity-rail-separator" aria-hidden="true" />
            <button
              type="button"
              className="activity-rail-button"
              aria-keyshortcuts="Control+O Meta+O"
              aria-label="ノートを開く"
              title="ノートを開く（Ctrl+O）"
              onClick={() => void openQuickSwitcher()}
            >
              <Icon name="folder-open" />
              <span className="sr-only">ノートを開く</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="新規ノート"
              title="新規ノート"
              onClick={() => void createNote()}
            >
              <Icon name="note-plus" />
              <span className="sr-only">新規ノート</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="新規フォルダ"
              title="新規フォルダ"
              onClick={() => {
                setLeftSidebarOpen(true)
                setLeftSidebarView('files')
                setQuery('')
                setCreateDirectoryParent(targetDirectory())
              }}
            >
              <Icon name="folder-plus" />
              <span className="sr-only">新規フォルダ</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="今日のノート"
              title="今日のノート"
              onClick={() => void openOrCreateDailyNote()}
            >
              <Icon name="calendar" />
              <span className="sr-only">今日のノート</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="アイデアを追加"
              title="アイデアを追加"
              onClick={() => startIdeaCapture()}
            >
              <Icon name="lightbulb" />
              <span className="sr-only">アイデアを追加</span>
            </button>
            <span className="activity-rail-separator" aria-hidden="true" />
            <button
              type="button"
              className="activity-rail-button"
              aria-label="グラフビュー"
              title="グラフビュー"
              aria-pressed={activeWorkspaceTab?.kind === 'global-graph'}
              onClick={openGlobalGraphWorkspace}
            >
              <Icon name="graph" />
              <span className="sr-only">グラフビュー</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="観測宙域"
              title="観測宙域"
              aria-pressed={activeWorkspaceTab?.kind === 'observatory'}
              onClick={openObservatoryWorkspace}
            >
              <Icon name="sparkles" />
              <span className="sr-only">観測宙域</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="ブックマーク"
              title="ブックマーク"
              aria-pressed={leftSidebarView === 'bookmarks' && leftSidebarOpen}
              onClick={() => {
                setLeftSidebarOpen(true)
                setQuery('')
                setLeftSidebarView('bookmarks')
              }}
            >
              <Icon name="bookmark" />
              <span className="sr-only">ブックマーク</span>
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-keyshortcuts="Control+P Meta+P"
              aria-label="操作"
              title="操作を実行（Ctrl+P）"
              onClick={() => void openCommandPalette()}
            >
              <Icon name="command" />
              <span className="sr-only">操作</span>
            </button>
            </div>
            <div className="activity-rail-footer" aria-label="アプリ操作">
            {updateStatus.phase !== 'disabled' && (
              <>
                <button
                  type="button"
                  className="activity-rail-button"
                  aria-label="更新"
                  aria-describedby="activity-rail-update-state"
                  data-phase={updateStatus.phase}
                  title={
                    updateStatus.message
                      ? `${updateActionLabel()} — ${updateStatus.message}`
                      : updateActionLabel()
                  }
                  disabled={
                    updateBusy ||
                    updateStatus.phase === 'checking' ||
                    updateStatus.phase === 'downloading'
                  }
                  onClick={() => void handleUpdateAction()}
                >
                  <Icon name="refresh" />
                </button>
                <span id="activity-rail-update-state" className="sr-only">
                  現在: {updateActionLabel()}
                </span>
              </>
            )}
            <button
              type="button"
              className="activity-rail-button"
              aria-label="Google / 同期"
              title="Google Drive / Calendar 同期"
              onClick={() => void openGoogleDialog()}
            >
              <Icon name="cloud" />
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label={`Vaultを切り替える: ${snapshot.rootName}`}
              title={`Vaultを切り替える — ${snapshot.rootName}`}
              onClick={() => void chooseVault()}
            >
              <Icon name="folder-open" />
            </button>
            <button
              type="button"
              className="activity-rail-button"
              aria-label="設定"
              title="設定"
              onClick={() => void openSettingsDialog()}
            >
              <Icon name="settings" />
            </button>
            <span className="activity-rail-separator" aria-hidden="true" />
            <button
              type="button"
              className="activity-rail-button activity-rail-toggle"
              aria-label={leftSidebarOpen ? '左サイドバーを閉じる' : '左サイドバーを開く'}
              title={leftSidebarOpen ? '左サイドバーを閉じる' : '左サイドバーを開く'}
              aria-expanded={leftSidebarOpen}
              aria-controls="left-sidebar-content"
              onClick={() => setLeftSidebarOpen((current) => !current)}
            >
              {leftSidebarOpen ? '‹' : '›'}
            </button>
            </div>
          </nav>
            <div
              id="left-sidebar-content"
              className={`sidebar-content is-${leftSidebarView}-view`}
              hidden={!leftSidebarOpen}
            >
            {leftSidebarView === 'search' && (
              <section className="search-query-panel" aria-labelledby="vault-search-heading">
                <header className="search-query-heading">
                  <div>
                    <h2 id="vault-search-heading">内容を検索</h2>
                    <p id="vault-search-description">タイトル・パス・本文</p>
                  </div>
                  <kbd>Ctrl+Shift+F</kbd>
                </header>
                <label className="search-field">
                  <span className="sr-only">内容を検索</span>
                  <Icon name="search" />
                  <input
                    ref={searchInputRef}
                    aria-keyshortcuts="Control+Shift+F Meta+Shift+F Control+K Meta+K"
                    aria-describedby="vault-search-description vault-search-help"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="内容を検索"
                    title="内容を検索（Ctrl+Shift+F、Ctrl+K）"
                  />
                </label>
                <div className="search-help" id="vault-search-help" aria-label="検索条件">
                  <span><code>tag:</code>タグ</span>
                  <span><code>path:</code>フォルダー</span>
                  <span><code>file:</code>ファイル名</span>
                  <span><code>category:</code>カテゴリ</span>
                  <span><code>topic:</code>トピック</span>
                  <span><code>type:</code>ノート種別</span>
                  <span><code>role:</code>役割</span>
                  <span><code>lifecycle:</code>状態</span>
                  <span><code>-語</code>除外</span>
                  <span><code>"複数語"</code>完全一致</span>
                </div>
              </section>
            )}

            {leftSidebarView === 'bookmarks' ? (
              <section className="bookmark-panel" aria-label="ブックマーク一覧">
                {bookmarkGroups.length === 0 ? (
                  <p className="sidebar-empty">ブックマークはありません。</p>
                ) : (
                  bookmarkGroups.map(([group, bookmarks]) => (
                    <section className="bookmark-group" key={group}>
                      <h2>{group}</h2>
                      {bookmarks.map((bookmark) => {
                        const exists =
                          snapshot.notes.some((note) => note.path === bookmark.path) ||
                          snapshot.attachments?.some(
                            (attachment) => attachment.path === bookmark.path
                          )
                        return (
                          <button
                            type="button"
                            className="bookmark-row"
                            key={bookmark.path}
                            onClick={() => openBookmark(bookmark.path)}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              setBookmarkPath(bookmark.path)
                            }}
                            title="右クリックで編集"
                          >
                            <strong>{bookmark.title || basenameRelative(bookmark.path)}</strong>
                            <span>{bookmark.path}</span>
                            {!exists && <small>見つかりません</small>}
                          </button>
                        )
                      })}
                    </section>
                  ))
                )}
              </section>
            ) : leftSidebarView === 'search' && !query.trim() ? (
              <section className="search-start" aria-label="検索を開始">
                <span className="search-start-icon" aria-hidden="true">
                  <Icon name="search" />
                </span>
                <strong>Vault内を検索</strong>
                <p>検索語を入力すると、ノートのタイトル・パス・本文から候補を表示します。</p>
              </section>
            ) : (
              <FileTree
                snapshot={snapshot}
                selectedNotePath={selectedPath}
                treeSelection={treeSelection}
                searchResults={searchResults}
                query={leftSidebarView === 'search' ? query : ''}
                onSelectNote={(path) => void openNote(path)}
                onSelectEntry={setTreeSelection}
                onRename={openRename}
                onMove={setMovePath}
                onDropEntry={(path, destination) =>
                  void moveEntryToDirectory(path, destination)
                }
                onInlineRename={renameEntry}
                onTrash={(path) => void trashPath(path)}
                bookmarkedPaths={bookmarkedPaths}
                onOpenInNewTab={(path) => void openVaultEntryInNewTab(path, 'note')}
                onReveal={revealVaultEntry}
                onCopyPath={(path) => void copyGraphNodePath(path, 'vault-relative')}
                onBookmark={setBookmarkPath}
                onCreateNote={(directory) => void createNoteInDirectory(directory)}
                onCreateDirectory={createDirectoryIn}
                createDirectoryParent={createDirectoryParent}
                onCreateDirectoryRequestHandled={() => setCreateDirectoryParent(null)}
              />
            )}

            {leftSidebarView === 'files' && (
              <div className="entry-toolbar" aria-label="選択項目の操作">
                <button
                  type="button"
                  disabled={!treeSelection || treeSelection.path === ''}
                  onClick={renameSelected}
                >
                  <Icon name="rename" />
                  名前変更
                </button>
                <button
                  type="button"
                  disabled={!treeSelection || treeSelection.path === ''}
                  onClick={() =>
                    treeSelection?.path && setMovePath(treeSelection.path)
                  }
                >
                  <Icon name="move" />
                  移動
                </button>
                <button
                  type="button"
                  disabled={!treeSelection || treeSelection.path === ''}
                  onClick={() => void trashSelected()}
                >
                  <Icon name="trash" />
                  ごみ箱
                </button>
              </div>
            )}
            </div>
          </aside>

          <section
            className="note-panel"
            id={activeTabId === null ? undefined : WORKSPACE_TAB_PANEL_ID}
            role={activeTabId === null ? undefined : 'tabpanel'}
            aria-labelledby={
              activeTabId === null ? undefined : workspaceTabDomId(activeTabId)
            }
          >
            {activeLinkedViewPath ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{workspaceTabLabel({
                        id: 0,
                        kind: 'linked-view',
                        path: activeLinkedViewPath
                      })}</strong>
                      <span>{activeLinkedViewPath}</span>
                    </div>
                  </header>
                </div>
                <section
                  className="linked-view-panel"
                  role="region"
                  aria-label="バックリンクビュー"
                >
                  <h2>バックリンク</h2>
                  {linkedViewBacklinks.length > 0 ? (
                    <div className="linked-view-list">
                      {linkedViewBacklinks.map((note) => (
                        <button
                          key={note.path}
                          type="button"
                          className="related-link"
                          aria-label={note.path}
                          onClick={() => void openNote(note.path)}
                        >
                          <strong>{note.name}</strong>
                          <span>{note.path}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="related-empty">バックリンクはありません。</p>
                  )}
                </section>
                <footer className="note-footer">
                  <span>{linkedViewBacklinks.length}件のバックリンク</span>
                  <span>{activeLinkedViewPath}</span>
                </footer>
              </>
            ) : activeWorkspaceTab?.kind === 'observatory' ? (
              <>
                <div className="note-top">{workspaceTabBar}</div>
                <ObservatoryView
                  graph={visibleGraph}
                  notes={graphNotes}
                  onOpen={(path) => void openNote(path)}
                />
              </>
            ) : !selectedPath && viewMode === 'graph' && graphScope === 'vault' ? (
              <>
                <div className="note-top">{workspaceTabBar}</div>
                <WikiGraphView
                  graph={visibleGraph}
                  notes={graphNotes}
                  currentPath={null}
                  scope="vault"
                  includeOrphans={graphFilters.showOrphans}
                  filterSettings={graphFilters}
                  forceSettings={graphForces}
                  displaySettings={graphDisplay}
                  groups={graphGroups}
                  viewState={graphViewStates.vault}
                  onScopeChange={setGraphScope}
                  onIncludeOrphansChange={(showOrphans) =>
                    setGraphFilters((current) => ({
                      ...current,
                      showOrphans
                    }))
                  }
                  onFilterSettingsChange={setGraphFilters}
                  onFilterSettingsCommit={(next) =>
                    void persistGraphFilters(next)
                  }
                  onForceSettingsChange={setGraphForces}
                  onForceSettingsCommit={(next) => void persistGraphForces(next)}
                  onDisplaySettingsChange={setGraphDisplay}
                  onDisplaySettingsCommit={(next) =>
                    void persistGraphDisplay(next)
                  }
                  onGroupsChange={setGraphGroups}
                  onGroupsCommit={(next) => void persistGraphGroups(next)}
                  onViewStateCommit={(next) =>
                    void persistGraphViewState('vault', next)
                  }
                  onSearchTag={searchGraphTag}
                  onMove={setMovePath}
                  bookmarkedPaths={bookmarkedPaths}
                  onBookmark={setBookmarkPath}
                  onCopyPath={copyGraphNodePath}
                  onTrash={(path) => void trashPath(path)}
                  onOpen={openGraphNode}
                  onOpenInNewTab={(path) => void openGraphNodeInNewTab(path)}
                  onOpenInNewWindow={(path) => void openGraphNodeInNewWindow(path)}
                  onOpenLinkedView={(path) => void openGraphNodeLinkedView(path)}
                  onRevealInFolder={revealGraphNodeInFolder}
                />
              </>
            ) : activeAttachment ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{activeAttachment.name}</strong>
                      <span>{activeAttachment.path}</span>
                    </div>
                  </header>
                </div>
                <AttachmentPreview
                  attachment={activeAttachment}
                  onOpenExternally={() => void openGraphNode(activeAttachment.path)}
                />
                <footer className="note-footer">
                  <span>{activeAttachment.size.toLocaleString()} bytes</span>
                  <span>
                    更新: {new Date(activeAttachment.modifiedAt).toLocaleString('ja-JP')}
                  </span>
                </footer>
              </>
            ) : selectedPath ? (
              <>
                <div className="note-top">
                  {workspaceTabBar}
                  <header className="note-header">
                    <div>
                      <strong>{withoutMarkdownExtension(basenameRelative(selectedPath))}</strong>
                      <span>{selectedPath}</span>
                    </div>
                    <div className="note-actions">
                    <span
                      className={`save-status is-${saveStatus}`}
                      role="status"
                      aria-live="polite"
                    >
                      <span className="save-status-dot" aria-hidden="true" />
                      {saveStatusLabel(saveStatus)}
                    </span>
                    {structuredCapture && (
                      <button
                        type="button"
                        onClick={() => {
                          setCaptureEditPath(selectedPath)
                          setCaptureError(null)
                          setCaptureKind(structuredCapture.kind)
                        }}
                      >
                        <Icon name="edit" />
                        内容を編集
                      </button>
                    )}
                    <div
                      className="note-view-switcher"
                      role="group"
                      aria-label="ノート表示"
                    >
                      <button
                        type="button"
                        className={viewMode === 'edit' ? 'is-active' : ''}
                        aria-pressed={viewMode === 'edit'}
                        onClick={() => setViewMode('edit')}
                      >
                        <Icon name="edit" />
                        {structuredCapture ? 'Markdownソース' : '編集'}
                      </button>
                      <button
                        type="button"
                        className={viewMode === 'preview' ? 'is-active' : ''}
                        aria-pressed={viewMode === 'preview'}
                        onClick={() => setViewMode('preview')}
                      >
                        <Icon name="preview" />
                        プレビュー
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`note-context-action ${
                        viewMode === 'graph' && graphScope === 'local'
                          ? 'is-active'
                          : ''
                      }`}
                      aria-pressed={viewMode === 'graph' && graphScope === 'local'}
                      onClick={() => {
                        setGraphScope('local')
                        setViewMode('graph')
                      }}
                    >
                      <Icon name="graph" />
                      ローカルグラフ
                    </button>
                    </div>
                  </header>
                </div>
                {viewMode === 'edit' ? (
                  <MarkdownEditor
                    key={selectedPath}
                    ref={markdownEditorRef}
                    value={content}
                    onChange={handleContentChange}
                    readOnly={busy}
                    propertiesReadOnly={saveStatus === 'saving' || conflict !== null}
                    notes={savedNotes.filter((note) => note.path !== selectedPath)}
                    deprioritizedPaths={userExcludedNotePaths}
                    templates={templates}
                    templateDirectory={templateDirectory}
                    noteTitle={
                      selectedPath
                        ? withoutMarkdownExtension(
                            selectedPath.split('/').at(-1) ?? ''
                          )
                        : undefined
                    }
                    onImportAttachments={handleImportAttachments}
                  />
                ) : viewMode === 'preview' ? (
                  <MarkdownPreview
                    content={content}
                    notePath={selectedPath}
                    attachments={snapshot.attachments ?? []}
                    onWikiLink={handleWikiLink}
                  />
                ) : (
                  <WikiGraphView
                    graph={visibleGraph}
                    notes={graphNotes}
                    currentPath={selectedPath}
                    scope={graphScope}
                    includeOrphans={graphFilters.showOrphans}
                    filterSettings={graphFilters}
                    forceSettings={graphForces}
                    displaySettings={graphDisplay}
                    groups={graphGroups}
                    viewState={graphViewStates[graphScope]}
                    onScopeChange={setGraphScope}
                    onIncludeOrphansChange={(showOrphans) =>
                      setGraphFilters((current) => ({
                        ...current,
                        showOrphans
                      }))
                    }
                    onFilterSettingsChange={setGraphFilters}
                    onFilterSettingsCommit={(next) =>
                      void persistGraphFilters(next)
                    }
                    onForceSettingsChange={setGraphForces}
                    onForceSettingsCommit={(next) => void persistGraphForces(next)}
                    onDisplaySettingsChange={setGraphDisplay}
                    onDisplaySettingsCommit={(next) =>
                      void persistGraphDisplay(next)
                    }
                    onGroupsChange={setGraphGroups}
                    onGroupsCommit={(next) => void persistGraphGroups(next)}
                    onViewStateCommit={(next) =>
                      void persistGraphViewState(graphScope, next)
                    }
                    onSearchTag={searchGraphTag}
                    onMove={setMovePath}
                    bookmarkedPaths={bookmarkedPaths}
                    onBookmark={setBookmarkPath}
                    onCopyPath={copyGraphNodePath}
                    onTrash={(path) => void trashPath(path)}
                    onOpen={openGraphNode}
                    onOpenInNewTab={(path) => void openGraphNodeInNewTab(path)}
                    onOpenInNewWindow={(path) => void openGraphNodeInNewWindow(path)}
                    onOpenLinkedView={(path) => void openGraphNodeLinkedView(path)}
                    onRevealInFolder={revealGraphNodeInFolder}
                  />
                )}
                <footer className="note-footer">
                  <span>{content.length.toLocaleString()}文字</span>
                  <span>
                    更新: {modifiedAt ? new Date(modifiedAt).toLocaleString('ja-JP') : '—'}
                    {selectedFreshness
                      ? ` · ${selectedFreshness.statusLabel}（${selectedFreshness.relativeLabel}）`
                      : ''}
                  </span>
                </footer>
              </>
            ) : (
              <div
                className="note-empty"
                role="region"
                aria-label={
                  workspaceTabs.length === 0
                    ? '開いているタブはありません'
                    : 'ノートが選択されていません'
                }
              >
                <img src={tsuzuneMark} alt="" aria-hidden="true" />
                <p>左の一覧からノートを選ぶか、新しいノートを作成してください。</p>
                <button type="button" className="primary-button" onClick={() => void createNote()}>
                  <Icon name="note" />
                  最初のノートを作る
                </button>
              </div>
            )}
          </section>

          <aside className={`related-panel-shell${rightSidebarOpen ? '' : ' is-collapsed'}`}>
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={rightSidebarOpen ? '右サイドバーを閉じる' : '右サイドバーを開く'}
              title={rightSidebarOpen ? '右サイドバーを閉じる' : '右サイドバーを開く'}
              aria-expanded={rightSidebarOpen}
              aria-controls="right-sidebar-content"
              onClick={() => setRightSidebarOpen((current) => !current)}
            >
              {rightSidebarOpen ? '›' : '‹'}
            </button>
            <div id="right-sidebar-content" className="sidebar-content" hidden={!rightSidebarOpen}>
              {calendarPluginStatus?.state === 'ready' && snapshot && !calendarPluginFailed ? (
                <section className="calendar-plugin-panel" aria-label="Calendarプラグイン">
                  <CalendarPluginFrame
                    ref={calendarPluginFrameRef}
                    sessionId={calendarPluginSessionRef.current}
                    snapshot={snapshot}
                    settings={calendarPluginSettings}
                    selectedPath={selectedPath}
                    daily={{
                      format: 'YYYY-MM-DD',
                      folder: '02_デイリー',
                      template: snapshot.notes.some(
                        (note) => note.path === dailyTemplatePath(templateDirectory)
                      )
                        ? dailyTemplatePath(templateDirectory)
                        : ''
                    }}
                    onOpenNote={openCalendarNote}
                    onCreateNote={createCalendarNote}
                    onCreateDirectory={createCalendarDirectory}
                    onSaveSettings={saveCalendarPluginSettings}
                    onTrashNote={trashCalendarNote}
                    onActivated={() => {
                      calendarPluginActivatedRef.current = true
                      setCalendarPluginActivated(true)
                      setCalendarPluginFailed(false)
                      setCalendarPluginError(null)
                    }}
                    onError={(error) => {
                      setCalendarPluginError(error)
                      setMessage(`Calendar: ${error}`)
                      if (!calendarPluginActivatedRef.current) {
                        setCalendarPluginFailed(true)
                      }
                    }}
                  />
                  {calendarPluginError && (
                    <p className="calendar-plugin-error" role="status">
                      {calendarPluginError}
                    </p>
                  )}
                </section>
              ) : (
                <DailyCalendar
                  notes={savedNotes}
                  selectedPath={selectedPath}
                  onSelectDate={(date) => void openDailyNoteFromCalendar(date)}
                  onOpenNote={(path) => void openCalendarNote(path, false)}
                />
              )}
              {selectedPath ? (
                <RelatedNotes
                  outgoing={outgoing}
                  backlinks={backlinks}
                  selectedNoteName={selectedNote?.name}
                  headings={headings}
                  onHeadingSelect={handleHeadingSelect}
                  temporal={
                    selectedNote ? (
                      <TemporalDetails
                        selectedNote={selectedNote}
                        notes={savedNotes}
                        asOf={temporalAsOf}
                        pathAliases={pathAliases}
                      />
                    ) : null
                  }
                  onOpen={(path) => void openNote(path)}
                  onMissing={(target) => void createMissingLink(target)}
                />
              ) : (
                <div className="related-panel related-empty-panel">関連ノート</div>
              )}
            </div>
          </aside>
        </main>
      )}

      {quickSwitcherOpen && snapshot && (
        <QuickSwitcherDialog
          notes={normalDiscoveryNotes}
          recentPaths={recentNotePaths}
          deprioritizedPaths={userExcludedNotePaths}
          onClose={closeQuickSwitcher}
          onOpen={(path) => {
            quickSwitcherRestoreFocusRef.current = false
            setQuickSwitcherOpen(false)
            void openNote(path)
          }}
          onOpenInNewTab={(path) => {
            quickSwitcherRestoreFocusRef.current = false
            setQuickSwitcherOpen(false)
            void openVaultEntryInNewTab(path, 'note')
          }}
          onCreate={(name) => {
            setQuickSwitcherOpen(false)
            setQuickCreateRequest({
              name,
              directory: targetDirectory(),
              error: null
            })
          }}
        />
      )}

      {commandPaletteOpen && (
        <CommandPaletteDialog
          commands={commandPaletteCommands}
          onExecute={executeCommandPaletteCommand}
          onClose={closeCommandPalette}
        />
      )}

      {quickCreateRequest && snapshot && (
        <QuickNoteCreateDialog
          initialName={quickCreateRequest.name}
          directories={snapshot.directories}
          initialDirectory={quickCreateRequest.directory}
          busy={quickCreateBusy}
          error={quickCreateRequest.error}
          onCancel={() => {
            if (quickCreateBusy) {
              return
            }
            setQuickCreateRequest(null)
            closeQuickSwitcher()
          }}
          onConfirm={(value) => void confirmQuickNoteCreate(value)}
        />
      )}

      {movePath && snapshot && (
        <MoveDialog
          notePath={movePath}
          entryKind={snapshot.directories.includes(movePath) ? 'directory' : 'file'}
          directories={snapshot.directories.filter(
            (directory) =>
              !snapshot.directories.includes(movePath) ||
              !isPathInsideOrEqual(directory, movePath)
          )}
          currentDirectory={dirnameRelative(movePath)}
          onCancel={() => setMovePath(null)}
          onConfirm={(directory) => void moveSelectedFile(directory)}
        />
      )}

      {renameRequest && (
        <RenameDialog
          entryPath={renameRequest.selection.path}
          entryKind={renameRequest.selection.kind}
          currentName={renameRequest.currentName}
          error={renameError}
          busy={busy}
          onCancel={() => {
            if (!busy) {
              setRenameRequest(null)
              setRenameError(null)
            }
          }}
          onConfirm={(name) => void confirmRename(name)}
        />
      )}

      {bookmarkPath && snapshot && (
        <BookmarkDialog
          path={bookmarkPath}
          bookmark={snapshot.bookmarks?.find(
            (bookmark) => bookmark.path === bookmarkPath
          )}
          onCancel={() => setBookmarkPath(null)}
          onSave={saveGraphBookmark}
          onDelete={removeGraphBookmark}
        />
      )}

      {captureKind && snapshot && (
        <HumanNoteCaptureDialog
          key={`${captureKind}:${captureEditPath ?? ''}`}
          kind={captureKind}
          error={captureError}
          dateLabel={
            captureEditPath?.match(/^02_デイリー\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1] ??
            localCalendarDate(new Date())
          }
          initialValues={captureEditPath ? structuredCapture ?? undefined : undefined}
          notes={savedNotes}
          onCancel={() => {
            captureDirtyRef.current = false
            setCaptureKind(null)
            setCaptureEditPath(null)
            setCaptureError(null)
          }}
          onDirtyChange={handleCaptureDirtyChange}
          onSubmit={createCapturedNote}
        />
      )}

      {settingsDialogOpen && (
        <div
          className="modal-backdrop app-settings-backdrop"
          role="presentation"
          data-testid="settings-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeSettingsDialog()
            }
          }}
        >
          <section
            ref={settingsDialogRef}
            className="modal app-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-settings-title"
            aria-busy={settingsBusy}
            tabIndex={-1}
            onKeyDown={handleSettingsDialogKeyDown}
          >
            <div className="app-settings-heading">
              <div>
                <h2 id="app-settings-title">設定</h2>
                <p>このVaultで使う設定をカテゴリごとに整理します。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="設定を閉じる"
                disabled={settingsBusy}
                onClick={closeSettingsDialog}
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="app-settings-layout">
              <nav className="app-settings-navigation" aria-label="設定カテゴリ">
                <button
                  type="button"
                  aria-label="ファイルとリンク"
                  aria-current={settingsCategory === 'files' ? 'page' : undefined}
                  onClick={() => setSettingsCategory('files')}
                >
                  <span>ファイルとリンク</span>
                  <small>除外する場所</small>
                </button>
                <button
                  type="button"
                  aria-label="テンプレート"
                  aria-current={settingsCategory === 'templates' ? 'page' : undefined}
                  onClick={() => setSettingsCategory('templates')}
                >
                  <span>テンプレート</span>
                  <small>作成に使う雛形</small>
                </button>
                <button
                  type="button"
                  aria-label="Obsidianプラグイン"
                  aria-current={settingsCategory === 'plugins' ? 'page' : undefined}
                  onClick={() => setSettingsCategory('plugins')}
                >
                  <span>Obsidianプラグイン</span>
                  <small>
                    manifestを確認
                    {obsidianPluginCandidates.length > 0 && (
                      <span className="settings-count" aria-hidden="true">
                        {obsidianPluginCandidates.length}
                      </span>
                    )}
                  </small>
                </button>
                <button
                  type="button"
                  aria-label="Calendar互換"
                  aria-current={settingsCategory === 'calendar' ? 'page' : undefined}
                  onClick={() => setSettingsCategory('calendar')}
                >
                  <span>Calendar</span>
                  <small>
                    {calendarPluginStatus?.state === 'ready'
                      ? '公式 1.5.10 検証済み'
                      : calendarPluginStatus?.state === 'rejected'
                        ? '配布物を拒否'
                        : '公式配布物を確認'}
                  </small>
                </button>
                <button
                  type="button"
                  aria-label="AIとレビュー"
                  aria-current={settingsCategory === 'ai' ? 'page' : undefined}
                  onClick={() => setSettingsCategory('ai')}
                >
                  <span>AIとレビュー</span>
                  <small>
                    承認と保留
                    {aiReviewProposals.length > 0 && (
                      <span className="settings-count" aria-hidden="true">
                        {aiReviewProposals.length}
                      </span>
                    )}
                  </small>
                </button>
              </nav>

              <div className="app-settings-content">
                {settingsCategory === 'files' && (
                  <section className="app-settings-section" aria-labelledby="files-links-title">
                    <div className="app-settings-section-heading">
                      <h3 id="files-links-title">ファイルとリンク</h3>
                      <p>一覧、検索、リンク、グラフへ表示しない場所を指定します。</p>
                    </div>
                    <label>
                      <span>除外するファイル</span>
                      <textarea
                        aria-label="除外するファイル"
                        value={excludedFilesDraft}
                        disabled={settingsBusy}
                        placeholder={'例: 90_Archive\n/\\.private\\.md$/'}
                        onChange={(event) => {
                          setSettingsError(null)
                          setExcludedFilesDraft(event.target.value)
                        }}
                      />
                    </label>
                    <p className="setting-help">
                      1行に1つ、パスの一部または /正規表現/ を指定します。
                    </p>
                  </section>
                )}

                {settingsCategory === 'templates' && (
                  <section className="app-settings-section" aria-labelledby="templates-title">
                    <div className="app-settings-section-heading">
                      <h3 id="templates-title">テンプレート</h3>
                      <p>新しいノートの土台として使うMarkdownを管理します。</p>
                    </div>
                    <label>
                      <span>テンプレートフォルダ</span>
                      <select
                        aria-label="テンプレートフォルダ"
                        value={templateDirectoryDraft}
                        disabled={settingsBusy}
                        onChange={(event) => {
                          setSettingsError(null)
                          setTemplateDirectoryDraft(event.target.value)
                        }}
                      >
                        {(snapshot?.directories ?? []).filter(Boolean).map((directory) => (
                          <option key={directory} value={directory}>
                            {directory}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-checkbox-row">
                      <input
                        type="checkbox"
                        checked={showBuiltInTemplatesDraft}
                        disabled={settingsBusy}
                        onChange={(event) => {
                          setSettingsError(null)
                          setShowBuiltInTemplatesDraft(event.target.checked)
                        }}
                      />
                      <span>内蔵テンプレートを表示</span>
                    </label>
                    <button
                      type="button"
                      className="secondary-button settings-inline-action"
                      disabled={settingsBusy}
                      onClick={() => revealVaultEntry(templateDirectoryDraft)}
                    >
                      <Icon name="folder-open" />
                      テンプレートフォルダをエクスプローラーで表示
                    </button>
                    <p className="setting-help">
                      このフォルダ内のMarkdownは通常ノートとして編集できます。
                    </p>
                  </section>
                )}

                {settingsCategory === 'plugins' && (
                  <section
                    className="app-settings-section"
                    aria-labelledby="obsidian-plugins-title"
                  >
                    <div className="app-settings-section-heading">
                      <h3 id="obsidian-plugins-title">Obsidianプラグイン</h3>
                      <p>
                        このVaultの .obsidian/plugins にある候補を安全に確認します。
                      </p>
                    </div>
                    <p className="setting-help">
                      一般のプラグインは候補検出のみで、main.jsを実行しません。Calendar 1.5.10だけは専用の隔離互換層で扱います。
                    </p>
                    <button
                      type="button"
                      className="secondary-button settings-inline-action"
                      disabled={obsidianPluginsLoading}
                      onClick={() => void refreshObsidianPluginCandidates()}
                    >
                      {obsidianPluginsLoading ? '確認中…' : 'もう一度確認'}
                    </button>
                    {obsidianPluginsLoading ? (
                      <p className="obsidian-plugin-empty" role="status">
                        プラグイン候補を確認しています…
                      </p>
                    ) : obsidianPluginCandidates.length === 0 ? (
                      <p className="obsidian-plugin-empty">
                        このVaultにはObsidianプラグインが見つかりません。
                      </p>
                    ) : (
                      <div className="obsidian-plugin-list">
                        {obsidianPluginCandidates.map((plugin, index) => (
                          <article
                            key={`${plugin.id}:${index}`}
                            className="obsidian-plugin-card"
                          >
                            <div className="obsidian-plugin-card-heading">
                              <strong>{plugin.name}</strong>
                              <span className={`obsidian-plugin-status is-${plugin.status}`}>
                                {plugin.status === 'detected'
                                  ? 'manifest確認済み'
                                  : plugin.status === 'incomplete'
                                    ? 'ファイル不足'
                                    : '要確認'}
                              </span>
                            </div>
                            <p>{plugin.description || '説明はありません。'}</p>
                            <div className="obsidian-plugin-meta">
                              <span>ID: {plugin.id}</span>
                              <span>Version: {plugin.version || '不明'}</span>
                              <span>作者: {plugin.author || '不明'}</span>
                              <span>
                                最低Obsidian: {plugin.minAppVersion || '不明'}
                              </span>
                              <span>
                                Desktop専用: {plugin.isDesktopOnly ? 'はい' : 'いいえ'}
                              </span>
                              <span>main.js: {plugin.hasMain ? 'あり' : 'なし'}</span>
                              <span>styles.css: {plugin.hasStyles ? 'あり' : 'なし'}</span>
                            </div>
                            <p className="setting-help">
                              {plugin.id === 'calendar' && plugin.version === '1.5.10'
                                ? 'Calendar画面で公式配布物のSHA-256を追加検証します。'
                                : plugin.reason ?? 'manifestを検出しました。一般実行互換は未対応です。'}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {settingsCategory === 'calendar' && (
                  <section
                    className="app-settings-section calendar-settings-section"
                    aria-labelledby="calendar-settings-title"
                  >
                    <div className="app-settings-section-heading">
                      <h3 id="calendar-settings-title">Calendar 互換</h3>
                      <p>
                        Liam Cain版 Calendar 1.5.10の公式配布物だけを、TSUZUNE専用の隔離環境で動かします。
                      </p>
                    </div>

                    <div className="calendar-compatibility-status">
                      <div>
                        <strong>
                          {calendarPluginStatus?.state === 'ready'
                            ? '公式配布物を検証済み'
                            : calendarPluginStatus?.state === 'rejected'
                              ? '配布物を安全のため拒否'
                              : calendarPluginStatus
                                ? '公式配布物は未配置'
                                : '配布物を確認中'}
                        </strong>
                        <span>
                          {calendarPluginStatus?.state === 'ready'
                            ? calendarPluginActivated
                              ? '隔離ホストで実行中'
                              : '画面を開くと隔離ホストで起動します'
                            : calendarPluginStatus?.reason ??
                              '.obsidian/plugins/calendar にmain.jsとmanifest.jsonを配置してください'}
                        </span>
                      </div>
                      <span
                        className={`calendar-compatibility-badge is-${calendarPluginStatus?.state ?? 'checking'}`}
                      >
                        {calendarPluginStatus?.state === 'ready'
                          ? 'SHA一致'
                          : calendarPluginStatus?.state === 'rejected'
                            ? '拒否'
                            : '未配置'}
                      </span>
                    </div>
                    <p className="setting-help calendar-compatibility-hash">
                      対象: calendar@1.5.10 / main.js SHA-256: {calendarPluginStatus?.mainSha256 ?? '確認中'}
                    </p>
                    <div className="calendar-settings-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={settingsBusy}
                        onClick={() => void refreshCalendarPluginStatus()}
                      >
                        配布物を再確認
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          void window.tsuzune.openExternal(
                            'https://github.com/liamcain/obsidian-calendar-plugin/releases/tag/1.5.10'
                          )
                        }
                      >
                        公式リリースを開く
                      </button>
                    </div>

                    <h4>一般</h4>
                    <label>
                      <span>週の開始曜日</span>
                      <select
                        aria-label="Calendarの週の開始曜日"
                        value={calendarPluginSettingsDraft.weekStart}
                        disabled={settingsBusy}
                        onChange={(event) =>
                          setCalendarPluginSettingsDraft((current) => ({
                            ...current,
                            weekStart: event.target.value as CalendarPluginSettings['weekStart']
                          }))
                        }
                      >
                        <option value="locale">システムの地域設定</option>
                        <option value="sunday">日曜日</option>
                        <option value="monday">月曜日</option>
                        <option value="tuesday">火曜日</option>
                        <option value="wednesday">水曜日</option>
                        <option value="thursday">木曜日</option>
                        <option value="friday">金曜日</option>
                        <option value="saturday">土曜日</option>
                      </select>
                    </label>
                    <label>
                      <span>1ドットあたりの単語数</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Calendarの1ドットあたりの単語数"
                        value={calendarPluginSettingsDraft.wordsPerDot}
                        disabled={settingsBusy}
                        onChange={(event) =>
                          setCalendarPluginSettingsDraft((current) => ({
                            ...current,
                            wordsPerDot: Math.max(0, Math.trunc(Number(event.target.value) || 0))
                          }))
                        }
                      />
                    </label>
                    <p className="setting-help">0にするとノート量のドットを表示しません。最大5個です。</p>
                    <label className="settings-checkbox-row">
                      <input
                        type="checkbox"
                        checked={calendarPluginSettingsDraft.shouldConfirmBeforeCreate}
                        disabled={settingsBusy}
                        onChange={(event) =>
                          setCalendarPluginSettingsDraft((current) => ({
                            ...current,
                            shouldConfirmBeforeCreate: event.target.checked
                          }))
                        }
                      />
                      <span>新しいデイリーノートを作る前に確認する</span>
                    </label>
                    <label>
                      <span>表示言語</span>
                      <input
                        type="text"
                        aria-label="Calendarの表示言語"
                        value={calendarPluginSettingsDraft.localeOverride}
                        disabled={settingsBusy}
                        placeholder="system-default または ja"
                        onChange={(event) =>
                          setCalendarPluginSettingsDraft((current) => ({
                            ...current,
                            localeOverride: event.target.value
                          }))
                        }
                      />
                    </label>

                    <h4>週次ノート</h4>
                    <label className="settings-checkbox-row">
                      <input
                        type="checkbox"
                        checked={calendarPluginSettingsDraft.showWeeklyNote}
                        disabled={settingsBusy}
                        onChange={(event) =>
                          setCalendarPluginSettingsDraft((current) => ({
                            ...current,
                            showWeeklyNote: event.target.checked
                          }))
                        }
                      />
                      <span>週番号を表示する</span>
                    </label>
                    {calendarPluginSettingsDraft.showWeeklyNote && (
                      <div className="calendar-weekly-settings">
                        <label>
                          <span>週次ノートの形式</span>
                          <input
                            type="text"
                            aria-label="Calendarの週次ノート形式"
                            value={calendarPluginSettingsDraft.weeklyNoteFormat}
                            disabled={settingsBusy}
                            placeholder="gggg-[W]ww"
                            onChange={(event) =>
                              setCalendarPluginSettingsDraft((current) => ({
                                ...current,
                                weeklyNoteFormat: event.target.value
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>週次ノートのテンプレート</span>
                          <input
                            type="text"
                            aria-label="Calendarの週次ノートテンプレート"
                            value={calendarPluginSettingsDraft.weeklyNoteTemplate}
                            disabled={settingsBusy}
                            placeholder="90_テンプレート/週次"
                            onChange={(event) =>
                              setCalendarPluginSettingsDraft((current) => ({
                                ...current,
                                weeklyNoteTemplate: event.target.value
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>週次ノートのフォルダ</span>
                          <input
                            type="text"
                            aria-label="Calendarの週次ノートフォルダ"
                            value={calendarPluginSettingsDraft.weeklyNoteFolder}
                            disabled={settingsBusy}
                            placeholder="02_デイリー/週次"
                            onChange={(event) =>
                              setCalendarPluginSettingsDraft((current) => ({
                                ...current,
                                weeklyNoteFolder: event.target.value
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}
                    <p className="setting-help">
                      週次ノート機能は上流で非推奨です。互換のため残していますが、新しい設計の中心にはしません。
                    </p>
                  </section>
                )}

                {settingsCategory === 'ai' && (
                  <section className="app-settings-section" aria-labelledby="ai-review-title">
                    <div className="app-settings-section-heading">
                      <h3 id="ai-review-title">AIとレビュー</h3>
                      <p>AIによる書き込みを、指定した場所だけ承認制にします。</p>
                    </div>
                    <label>
                      <span>AI変更を承認制にするパス</span>
                      <textarea
                        aria-label="AI変更を承認制にするパス"
                        value={aiReviewPathsDraft}
                        disabled={settingsBusy}
                        placeholder="例: 30_知識"
                        onChange={(event) => {
                          setSettingsError(null)
                          setAiReviewPathsDraft(event.target.value)
                        }}
                      />
                    </label>
                    <p className="setting-help">
                      対象ではAIの作成・更新を即時反映せず、ここで承認または取り消します。変更禁止の指定が優先されます。
                    </p>
                    <section className="ai-review-list" aria-labelledby="ai-review-proposals-title">
                      <h4 id="ai-review-proposals-title">承認待ちのAI変更案</h4>
                      {aiReviewProposals.length === 0 ? (
                        <p>承認待ちの変更案はありません。</p>
                      ) : (
                        aiReviewProposals.map((proposal) => {
                          const current = snapshot?.notes.find(
                            (note) => note.path.toLowerCase() === proposal.path.toLowerCase()
                          )
                          return (
                            <article key={proposal.id} className="ai-review-proposal">
                              <strong>{proposal.path}</strong>
                              <p>{proposal.reason}</p>
                              <p>操作: {proposal.operation === 'create' ? '作成' : '更新'}</p>
                              <p>
                                作成時刻: {new Date(proposal.createdAt).toLocaleString('ja-JP')}
                              </p>
                              <p>
                                出典: {proposal.sourceRefs.length > 0 ? proposal.sourceRefs.join('、') : 'なし'}
                              </p>
                              <div className="ai-review-comparison">
                                <div>
                                  <span>現在</span>
                                  <pre>{current?.content ?? '（新規ノート）'}</pre>
                                </div>
                                <div>
                                  <span>変更案</span>
                                  <pre>{proposal.content}</pre>
                                </div>
                              </div>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  disabled={settingsBusy}
                                  onClick={() => void resolveAiReviewProposal(proposal, false)}
                                >
                                  取り消す
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={settingsBusy}
                                  onClick={() => void resolveAiReviewProposal(proposal, true)}
                                >
                                  承認して反映
                                </button>
                              </div>
                            </article>
                          )
                        })
                      )}
                    </section>
                  </section>
                )}
              </div>
            </div>

            <div className="modal-actions app-settings-actions">
              {settingsError ? (
                <p className="app-settings-feedback is-error" role="alert">
                  {settingsError}
                </p>
              ) : settingsHaveUnsavedChanges ? (
                <p className="app-settings-feedback" role="status">
                  未保存の変更があります
                </p>
              ) : null}
              <button
                type="button"
                disabled={settingsBusy}
                onClick={closeSettingsDialog}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={settingsBusy}
                onClick={() => void saveSettings()}
              >
                設定を保存
              </button>
            </div>
          </section>
        </div>
      )}

      {googleDialogOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          data-testid="google-sync-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeGoogleDialog()
            }
          }}
        >
          <section
            ref={googleDialogRef}
            className="modal google-sync-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-sync-title"
            aria-busy={googleBusy || busy}
            tabIndex={-1}
            onKeyDown={handleGoogleDialogKeyDown}
          >
            <div className="google-sync-heading">
              <div>
                <h2 id="google-sync-title">Google Drive同期</h2>
                <p>ローカルMarkdownを原本として、確認してから手動同期します。</p>
              </div>
              <button
                type="button"
                aria-label="Google Drive同期を閉じる"
                disabled={googleBusy || busy}
                onClick={closeGoogleDialog}
              >
                ×
              </button>
            </div>

            {googleBusy && <p className="google-sync-progress">Googleの処理を待っています…</p>}
            {googleError && (
              <p className="google-sync-error" role="alert">
                {googleError}
              </p>
            )}

            {!googleStatus?.configured ? (
              <div className="google-sync-step">
                <strong>Google OAuth設定が必要です</strong>
                <p>
                  Google Cloudで作成した「デスクトップアプリ」のOAuthクライアントJSONを選びます。
                </p>
                <button
                  type="button"
                  className="primary-button"
                  disabled={googleBusy}
                  onClick={() => void chooseGoogleConfig()}
                >
                  OAuth JSONを選ぶ
                </button>
              </div>
            ) : !googleStatus.connected ? (
              <div className="google-sync-step">
                <strong>Googleアカウントへ接続</strong>
                <p>
                  基本プロフィールと、TSUZUNEが作成するDriveファイルだけを扱う権限を求めます。
                </p>
                <div className="google-sync-buttons">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={googleBusy}
                    onClick={() => void connectGoogle()}
                  >
                    Googleでログイン
                  </button>
                  <button
                    type="button"
                    disabled={googleBusy}
                    aria-expanded={googleAdvancedOpen}
                    onClick={() => setGoogleAdvancedOpen((open) => !open)}
                  >
                    {googleAdvancedOpen ? '詳細設定を閉じる' : '詳細設定を開く'}
                  </button>
                </div>
                {googleAdvancedOpen && (
                  <div className="google-sync-advanced">
                    <p>
                      自分のGoogle Cloud設定を使う場合だけ、Desktop OAuth
                      JSONを選択します。
                    </p>
                    <button
                      type="button"
                      disabled={googleBusy}
                      onClick={() => void chooseGoogleConfig()}
                    >
                      独自のOAuth JSONを選ぶ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="google-account-card">
                  <div>
                    <strong>{googleStatus.account?.name ?? 'Googleアカウント'}</strong>
                    <span>{googleStatus.account?.email}</span>
                  </div>
                  <button
                    type="button"
                    disabled={googleBusy || busy}
                    onClick={() => void disconnectGoogle()}
                  >
                    接続解除
                  </button>
                </div>

                <div className="google-sync-step">
                  <strong>Google読取機能</strong>
                  <p>
                    Calendarはここでは読取権限だけを準備します。予定の確認と取込は次の段階で追加します。
                  </p>
                  <p>
                    Drive同期:{' '}
                    {googleStatus.authorizedFeatures.includes('drive_sync')
                      ? '許可済み'
                      : '未許可'}
                  </p>
                  <p>
                    Calendar読取:{' '}
                    {googleStatus.authorizedFeatures.includes('calendar_read')
                      ? '許可済み'
                      : '未許可'}
                  </p>
                  {!googleStatus.authorizedFeatures.includes(
                    'calendar_read'
                  ) && (
                    <button
                      type="button"
                      disabled={googleBusy || busy}
                      onClick={() => void authorizeGoogleCalendar()}
                    >
                      Calendar読取を有効にする
                    </button>
                  )}
                </div>

                <div className="google-sync-meta">
                  <span>
                    最終同期:{' '}
                    {googleStatus.lastSyncAt
                      ? new Date(googleStatus.lastSyncAt).toLocaleString('ja-JP')
                      : '未実行'}
                  </span>
                  {googleStatus.vaultFolderUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        void window.tsuzune.openExternal(
                          googleStatus.vaultFolderUrl as string
                        )
                      }
                    >
                      Driveフォルダを開く
                    </button>
                  )}
                </div>

                <div className="google-sync-step">
                  <strong>既存のDrive Vaultへ接続</strong>
                  <p>
                    別端末で作成した空のローカルVaultへ、TSUZUNEが以前作成したDrive Vaultを接続できます。
                  </p>
                  <div className="google-sync-buttons">
                    <button
                      type="button"
                      disabled={!snapshot || googleBusy || busy}
                      onClick={() => void listRemoteDriveVaults()}
                    >
                      既存のDrive Vaultを探す
                    </button>
                  </div>
                  {driveVaults.length > 0 && (
                    <div className="drive-vault-picker">
                      <label>
                        <span>接続先</span>
                        <select
                          aria-label="接続するDrive Vault"
                          value={selectedDriveVaultId}
                          onChange={(event) =>
                            setSelectedDriveVaultId(event.target.value)
                          }
                        >
                          {driveVaults.map((vault) => (
                            <option
                              key={vault.rootFolderId}
                              value={vault.rootFolderId}
                            >
                              {vault.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!selectedDriveVaultId || googleBusy || busy}
                        onClick={() => void pairRemoteDriveVault()}
                      >
                        このDrive Vaultを使う
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="primary-button"
                  disabled={!snapshot || googleBusy || busy}
                  onClick={() => void previewGoogleDriveSync()}
                >
                  同期内容を確認
                </button>

                {drivePreview && (
                  <div className="sync-preview">
                    <div className="sync-counts" aria-label="同期件数">
                      <span>送信 {drivePreview.counts.upload}</span>
                      <span>受信 {drivePreview.counts.download}</span>
                      <span>移動 {drivePreview.counts.move}</span>
                      <span>競合 {drivePreview.counts.conflict}</span>
                      <span>保持 {drivePreview.counts.preserve}</span>
                    </div>
                    {drivePreview.items.length > 0 ? (
                      <ul className="sync-preview-list">
                        {drivePreview.items.map((item) => (
                          <li key={`${item.action}:${item.path}`}>
                            <span className={`sync-action is-${item.action}`}>
                              {item.action === 'upload'
                                ? '送信'
                                : item.action === 'download'
                                  ? '受信'
                                  : item.action === 'move'
                                    ? '移動'
                                  : item.action === 'conflict'
                                    ? '競合'
                                    : '保持'}
                            </span>
                            <span>
                              {item.oldPath ? `${item.oldPath} → ${item.path}` : item.path}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="sync-no-changes">同期が必要な変更はありません。</p>
                    )}
                    {drivePreview.items.length > 0 && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={googleBusy || busy}
                        onClick={() => void applyGoogleDriveSync()}
                      >
                        この内容で同期
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            <p className="google-sync-boundary">
              広告プロファイル、Google検索履歴、他アプリのDriveファイルは取得しません。
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
