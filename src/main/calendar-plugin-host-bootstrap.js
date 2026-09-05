(function bootstrapTsuzuneCalendarHost() {
  'use strict'

  const CHANNEL = 'tsuzune-calendar'
  const documentElement = document.documentElement
  const session = documentElement.dataset.calendarSession || ''
  const hostElement = document.getElementById('calendar-plugin-host')
  const pendingRequests = new Map()
  const commands = new Map()
  const viewFactories = new Map()
  const leaves = []
  const pluginRegistry = new Map()
  let requestSequence = 0
  let pluginInstance = null
  let initialized = false
  let resolveInitialization
  const initialization = new Promise((resolve) => {
    resolveInitialization = resolve
  })

  const state = {
    settings: {},
    daily: {
      format: 'YYYY-MM-DD',
      folder: '02_デイリー',
      template: ''
    },
    snapshot: {
      directories: [],
      notes: []
    },
    selectedPath: null
  }

  function post(type, payload) {
    window.parent.postMessage({ channel: CHANNEL, session, type, payload }, '*')
  }

  function request(action, payload) {
    const requestId = `${session}:${++requestSequence}`
    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject })
      post('request', { requestId, action, payload })
    })
  }

  function sameSettings(left, right) {
    const leftKeys = Object.keys(left || {})
    const rightKeys = Object.keys(right || {})
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right || {}, key) && left[key] === right[key])
  }

  function normalizePath(value) {
    if (typeof value !== 'string' || value.trim() === '' || value === '/') return '/'
    const parts = value.replaceAll('\\', '/').split('/')
    const normalized = []
    for (const part of parts) {
      if (!part || part === '.') continue
      if (part === '..') normalized.pop()
      else normalized.push(part)
    }
    return normalized.join('/') || '/'
  }

  class Events {
    constructor() {
      this.listeners = new Map()
    }

    on(name, callback) {
      const callbacks = this.listeners.get(name) || new Set()
      callbacks.add(callback)
      this.listeners.set(name, callbacks)
      return { emitter: this, name, callback }
    }

    off(name, callback) {
      const callbacks = this.listeners.get(name)
      callbacks?.delete(callback)
      if (callbacks?.size === 0) this.listeners.delete(name)
    }

    offref(ref) {
      ref?.emitter?.off(ref.name, ref.callback)
    }

    trigger(name, ...args) {
      for (const callback of [...(this.listeners.get(name) || [])]) {
        try {
          callback(...args)
        } catch (error) {
          reportError(error)
        }
      }
    }
  }

  class Component {
    constructor() {
      this.cleanups = []
    }

    register(cleanup) {
      if (typeof cleanup === 'function') this.cleanups.push(cleanup)
      return cleanup
    }

    registerEvent(ref) {
      if (ref?.emitter?.offref) this.cleanups.push(() => ref.emitter.offref(ref))
      return ref
    }

    registerDomEvent(element, type, callback, options) {
      element.addEventListener(type, callback, options)
      this.cleanups.push(() => element.removeEventListener(type, callback, options))
    }

    unload() {
      for (const cleanup of this.cleanups.splice(0).reverse()) {
        try {
          cleanup()
        } catch (error) {
          reportError(error)
        }
      }
    }
  }

  class TAbstractFile {
    constructor(path) {
      this.path = normalizePath(path)
      this.name = this.path === '/' ? '' : this.path.split('/').pop()
      this.parent = null
      this.vault = null
    }
  }

  class TFolder extends TAbstractFile {
    constructor(path) {
      super(path)
      this.children = []
    }
  }

  class TFile extends TAbstractFile {
    constructor(note) {
      super(note.path)
      const dot = this.name.lastIndexOf('.')
      this.basename = dot > 0 ? this.name.slice(0, dot) : this.name
      this.extension = dot > 0 ? this.name.slice(dot + 1) : ''
      this.stat = {
        ctime: note.createdAt || note.modifiedAt || Date.now(),
        mtime: note.modifiedAt || Date.now(),
        size: note.size || new TextEncoder().encode(note.content || '').byteLength
      }
      this.__content = note.content || ''
    }
  }

  class Vault extends Events {
    constructor() {
      super()
      this.files = new Map()
      this.folders = new Map()
      this.root = new TFolder('/')
      this.root.vault = this
      this.folders.set('/', this.root)
    }

    rebuild(snapshot) {
      this.files.clear()
      this.folders.clear()
      this.root = new TFolder('/')
      this.root.vault = this
      this.folders.set('/', this.root)
      const directoryPaths = new Set(snapshot?.directories || [])
      for (const note of snapshot?.notes || []) {
        const parts = normalizePath(note.path).split('/')
        parts.pop()
        let path = ''
        for (const part of parts) {
          path = path ? `${path}/${part}` : part
          directoryPaths.add(path)
        }
      }
      for (const directory of [...directoryPaths].sort((left, right) => left.split('/').length - right.split('/').length)) {
        if (directory && directory !== '/') this.ensureLocalFolder(directory)
      }
      for (const note of snapshot?.notes || []) this.addLocalFile(note)
    }

    ensureLocalFolder(path) {
      const normalized = normalizePath(path)
      if (this.folders.has(normalized)) return this.folders.get(normalized)
      const parts = normalized.split('/')
      const name = parts.pop()
      const parentPath = parts.join('/') || '/'
      const parent = this.ensureLocalFolder(parentPath)
      const folder = new TFolder(normalized)
      folder.vault = this
      folder.parent = parent
      parent.children.push(folder)
      this.folders.set(normalized, folder)
      return folder
    }

    addLocalFile(note) {
      const file = new TFile(note)
      file.vault = this
      const parts = file.path.split('/')
      parts.pop()
      const parent = this.ensureLocalFolder(parts.join('/') || '/')
      file.parent = parent
      parent.children = parent.children.filter((child) => child.path !== file.path)
      parent.children.push(file)
      this.files.set(file.path, file)
      return file
    }

    removeLocalFile(path) {
      const normalized = normalizePath(path)
      const file = this.files.get(normalized)
      if (!file) return null
      file.parent.children = file.parent.children.filter((child) => child !== file)
      this.files.delete(normalized)
      return file
    }

    getMarkdownFiles() {
      return [...this.files.values()].filter((file) => file.extension.toLowerCase() === 'md')
    }

    getAbstractFileByPath(path) {
      const normalized = normalizePath(path)
      return this.files.get(normalized) || this.folders.get(normalized) || null
    }

    async cachedRead(file) {
      if (!(file instanceof TFile)) throw new Error('Calendar requested a non-file read')
      return file.__content
    }

    async read(file) {
      return this.cachedRead(file)
    }

    async create(path, content) {
      const normalized = normalizePath(path)
      if (normalized === '/' || !normalized.toLowerCase().endsWith('.md')) {
        throw new Error('Calendar may only create Markdown notes')
      }
      if (this.files.has(normalized)) throw new Error(`File already exists: ${normalized}`)
      const created = await request('create-note', { path: normalized, content: String(content || '') })
      const file = this.addLocalFile(created)
      this.trigger('create', file)
      return file
    }

    async createFolder(path) {
      const normalized = normalizePath(path)
      if (normalized === '/') return this.root
      await request('create-directory', { path: normalized })
      return this.ensureLocalFolder(normalized)
    }

    getConfig(key) {
      return key === 'defaultViewMode' ? 'preview' : undefined
    }

    static recurseChildren(folder, callback) {
      if (!(folder instanceof TFolder)) return
      for (const child of folder.children) {
        callback(child)
        if (child instanceof TFolder) Vault.recurseChildren(child, callback)
      }
    }
  }

  const vault = new Vault()

  let noteActivityByDate = new Map()
  let noteActivityObserver = null
  let noteActivityEnabled = false
  let noteActivityRenderScheduled = false
  let activeActivityDate = null
  let activeActivityTrigger = null
  let activeActivityPopover = null

  function localDateKey(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return null
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-')
  }

  function isNormalNote(path) {
    const normalized = normalizePath(path)
    return normalized !== '50_履歴' && !normalized.startsWith('50_履歴/')
  }

  function rebuildNoteActivityIndex() {
    const next = new Map()
    const add = (dateKey, note, kind) => {
      if (!dateKey) return
      const notes = next.get(dateKey) || new Map()
      const current = notes.get(note.path) || { note, created: false, modified: false }
      current[kind] = true
      notes.set(note.path, current)
      next.set(dateKey, notes)
    }
    for (const note of state.snapshot?.notes || []) {
      if (!isNormalNote(note.path)) continue
      add(localDateKey(note.createdAt), note, 'created')
      add(localDateKey(note.modifiedAt), note, 'modified')
    }
    noteActivityByDate = next
  }

  function displayedCalendarStart(days) {
    if (typeof window.moment !== 'function') return null
    const monthText = document.querySelector('.title .month')?.textContent?.trim() || ''
    const yearText = document.querySelector('.title .year')?.textContent?.trim() || ''
    const year = Number(yearText.match(/\d{4}/)?.[0])
    if (!Number.isInteger(year)) return null
    let month = Number(monthText.match(/\d{1,2}/)?.[0]) - 1
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      const input = `${monthText} ${year}`
      const formats = ['MMM YYYY', 'MMMM YYYY']
      let parsed = window.moment(input, formats, true)
      if (!parsed.isValid()) parsed = window.moment(input, formats, 'en', true)
      if (!parsed.isValid()) return null
      month = parsed.month()
    }
    const firstCurrentMonthDay = days.findIndex((day) => !day.classList.contains('adjacent-month'))
    if (firstCurrentMonthDay < 0) return null
    return window.moment([year, month, 1]).startOf('month').subtract(firstCurrentMonthDay, 'days')
  }

  function dateLabel(dateKey, includeYear = false) {
    const [year, month, day] = dateKey.split('-').map(Number)
    return includeYear ? `${year}年${month}月${day}日` : `${month}月${day}日`
  }

  function activityCounts(notes) {
    const values = [...notes.values()]
    return {
      created: values.filter((item) => item.created).length,
      modified: values.filter((item) => item.modified).length
    }
  }

  function noteActivitySignature(notes) {
    return JSON.stringify(
      [...notes.values()]
        .sort((left, right) => left.note.path.localeCompare(right.note.path, 'ja'))
        .map((item) => [
          item.note.path,
          item.note.createdAt || null,
          item.note.modifiedAt || null,
          item.created,
          item.modified
        ])
    )
  }

  function noteActivityLegendItem(label, className) {
    const item = document.createElement('span')
    item.className = 'tsuzune-note-activity-legend-item'
    const mark = document.createElement('span')
    mark.className = `tsuzune-note-activity-mark ${className}`
    mark.setAttribute('aria-hidden', 'true')
    mark.textContent = label.slice(0, 1)
    item.append(mark, label)
    return item
  }

  function renderNoteActivityLegend(visible) {
    const current = document.querySelector('.tsuzune-note-activity-legend')
    if (!visible) {
      current?.remove()
      return
    }
    if (current) return
    const container = document.querySelector('#calendar-container')
      || document.querySelector('.calendar-grid')?.parentElement
      || document.querySelector('.day')?.parentElement
    if (!container) return
    const legend = document.createElement('div')
    legend.className = 'tsuzune-note-activity-legend'
    legend.setAttribute('aria-label', 'ノート活動。作成と更新。日付の印をクリックするとノート一覧を表示します')
    legend.title = '日付の印をクリックするとノート一覧を表示します'
    const label = document.createElement('strong')
    label.textContent = 'ノート活動'
    const hint = document.createElement('span')
    hint.className = 'tsuzune-note-activity-legend-hint'
    hint.textContent = '印を押すと一覧'
    legend.append(
      label,
      noteActivityLegendItem('作成', 'is-created'),
      noteActivityLegendItem('更新', 'is-modified'),
      hint
    )
    container.append(legend)
  }

  function closeNoteActivity(restoreFocus = false) {
    const trigger = activeActivityTrigger
    trigger?.setAttribute('aria-expanded', 'false')
    activeActivityPopover?.remove()
    activeActivityPopover = null
    activeActivityTrigger = null
    activeActivityDate = null
    document.querySelectorAll('.tsuzune-note-activity-trigger.is-selected')
      .forEach((element) => element.classList.remove('is-selected'))
    if (restoreFocus && trigger?.isConnected) trigger.focus()
  }

  function noteActivityBadge(label, className) {
    const badge = document.createElement('span')
    badge.className = `tsuzune-note-activity-badge ${className}`
    badge.textContent = label
    return badge
  }

  function renderNoteActivityPopover(dateKey, trigger, focusClose = true) {
    const notes = noteActivityByDate.get(dateKey)
    if (!notes?.size) {
      closeNoteActivity()
      return
    }
    if (activeActivityPopover) closeNoteActivity()
    activeActivityDate = dateKey
    activeActivityTrigger = trigger
    trigger.classList.add('is-selected')
    trigger.setAttribute('aria-expanded', 'true')

    const counts = activityCounts(notes)
    const popover = document.createElement('section')
    popover.id = 'tsuzune-note-activity-popover'
    popover.className = 'tsuzune-note-activity-popover'
    popover.setAttribute('role', 'dialog')
    popover.setAttribute('aria-label', `${dateLabel(dateKey, true)}のノート活動`)

    const header = document.createElement('header')
    const heading = document.createElement('strong')
    heading.textContent = `${dateLabel(dateKey, true)}のノート`
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'tsuzune-note-activity-close'
    closeButton.setAttribute('aria-label', 'ノート活動を閉じる')
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => closeNoteActivity(true))
    header.append(heading, closeButton)

    const summary = document.createElement('div')
    summary.className = 'tsuzune-note-activity-summary'
    summary.append(
      noteActivityBadge(`＋ 作成 ${counts.created}`, 'is-created'),
      noteActivityBadge(`◌ 最終更新 ${counts.modified}`, 'is-modified')
    )

    const list = document.createElement('div')
    list.className = 'tsuzune-note-activity-list'
    const items = [...notes.values()].sort((left, right) =>
      (right.note.modifiedAt || 0) - (left.note.modifiedAt || 0) ||
      left.note.path.localeCompare(right.note.path, 'ja')
    )
    for (const item of items) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'tsuzune-note-activity-note'
      button.dataset.notePath = item.note.path
      button.setAttribute('aria-label', `${item.note.name || item.note.path}を開く`)
      const copy = document.createElement('span')
      copy.className = 'tsuzune-note-activity-copy'
      const name = document.createElement('strong')
      name.textContent = item.note.name || item.note.path.replace(/\.md$/i, '').split('/').pop()
      const path = document.createElement('small')
      path.textContent = item.note.path
      copy.append(name, path)
      const kinds = document.createElement('span')
      kinds.className = 'tsuzune-note-activity-kinds'
      if (item.created) kinds.append(noteActivityBadge('作成', 'is-created'))
      if (item.modified) kinds.append(noteActivityBadge('更新', 'is-modified'))
      button.append(copy, kinds)
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        const file = vault.getAbstractFileByPath(item.note.path)
        const newSplit = event.ctrlKey || event.metaKey
        closeNoteActivity()
        void request('open-note', { path: item.note.path, newSplit })
          .then(() => workspace.setActiveFile(file instanceof TFile ? file : null))
          .catch(reportError)
      })
      list.append(button)
    }

    popover.append(header, summary, list)
    document.body.append(popover)
    activeActivityPopover = popover
    if (focusClose) closeButton.focus()
  }

  function createNoteActivityTrigger(dateKey, notes) {
    const counts = activityCounts(notes)
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'tsuzune-note-activity-trigger'
    trigger.dataset.createdCount = String(counts.created)
    trigger.dataset.modifiedCount = String(counts.modified)
    trigger.dataset.activitySignature = noteActivitySignature(notes)
    trigger.setAttribute('aria-haspopup', 'dialog')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', 'tsuzune-note-activity-popover')
    trigger.setAttribute(
      'aria-label',
      `${dateLabel(dateKey)}: 作成${counts.created}件、最終更新${counts.modified}件`
    )
    trigger.title = `ノート活動: 作成 ${counts.created}件 / 最終更新 ${counts.modified}件`
    if (counts.created > 0) {
      const created = document.createElement('span')
      created.className = 'tsuzune-note-activity-mark is-created'
      created.setAttribute('aria-hidden', 'true')
      created.textContent = '作'
      trigger.append(created)
    }
    if (counts.modified > 0) {
      const modified = document.createElement('span')
      modified.className = 'tsuzune-note-activity-mark is-modified'
      modified.setAttribute('aria-hidden', 'true')
      modified.textContent = '更'
      trigger.append(modified)
    }
    trigger.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (activeActivityDate === dateKey && activeActivityPopover) closeNoteActivity(true)
      else renderNoteActivityPopover(dateKey, trigger)
    })
    return trigger
  }

  function renderNoteActivityMarkers() {
    const days = [...document.querySelectorAll('.day')]
    const start = displayedCalendarStart(days)
    if (!start || days.length === 0) {
      renderNoteActivityLegend(false)
      return
    }
    let hasVisibleActivity = false
    days.forEach((day, index) => {
      const dateKey = start.clone().add(index, 'days').format('YYYY-MM-DD')
      if (day.dataset.tsuzuneDate !== dateKey) day.dataset.tsuzuneDate = dateKey
      const notes = noteActivityByDate.get(dateKey)
      const current = day.querySelector('.tsuzune-note-activity-trigger')
      if (!notes?.size) {
        day.classList.remove('has-tsuzune-note-activity')
        delete day.dataset.tsuzuneActivity
        current?.remove()
        return
      }
      const counts = activityCounts(notes)
      const signature = noteActivitySignature(notes)
      hasVisibleActivity = true
      day.classList.add('has-tsuzune-note-activity')
      day.dataset.tsuzuneActivity = counts.created > 0 && counts.modified > 0
        ? 'created-modified'
        : counts.created > 0 ? 'created' : 'modified'
      if (
        current?.dataset.createdCount === String(counts.created) &&
        current?.dataset.modifiedCount === String(counts.modified) &&
        current?.dataset.activitySignature === signature
      ) {
        current.classList.toggle('is-selected', activeActivityDate === dateKey)
        return
      }
      current?.remove()
      day.append(createNoteActivityTrigger(dateKey, notes))
    })
    renderNoteActivityLegend(hasVisibleActivity)
    if (
      activeActivityDate &&
      (!noteActivityByDate.get(activeActivityDate)?.size || !activeActivityTrigger?.isConnected)
    ) {
      closeNoteActivity()
    }
  }

  function scheduleNoteActivityRender() {
    if (noteActivityRenderScheduled) return
    noteActivityRenderScheduled = true
    queueMicrotask(() => {
      noteActivityRenderScheduled = false
      if (!noteActivityEnabled) return
      renderNoteActivityMarkers()
    })
  }

  function installNoteActivity() {
    noteActivityEnabled = true
    noteActivityObserver = new MutationObserver(scheduleNoteActivityRender)
    noteActivityObserver.observe(hostElement, { childList: true, characterData: true, subtree: true })
    document.addEventListener('pointerdown', (event) => {
      if (!activeActivityPopover) return
      if (activeActivityPopover.contains(event.target) || activeActivityTrigger?.contains(event.target)) return
      closeNoteActivity()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeActivityPopover) {
        event.preventDefault()
        closeNoteActivity(true)
      }
    })
  }

  function frontmatterFor(content) {
    const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content || '')
    if (!match) return undefined
    const frontmatter = {}
    const lines = match[1].split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
      const entry = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[index])
      if (!entry) continue
      const key = entry[1]
      const value = entry[2]
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean)
      } else if (!value) {
        const items = []
        while (index + 1 < lines.length) {
          const item = /^\s*-\s*(.+)$/.exec(lines[index + 1])
          if (!item) break
          items.push(item[1].trim())
          index += 1
        }
        frontmatter[key] = items
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '')
      }
    }
    return frontmatter
  }

  function parseFrontMatterTags(frontmatter) {
    const raw = frontmatter?.tags ?? frontmatter?.tag
    const tags = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : []
    return tags.map((tag) => String(tag).trim()).filter(Boolean).map((tag) => tag.startsWith('#') ? tag : `#${tag}`)
  }

  const metadataCache = {
    getFirstLinkpathDest(linkpath) {
      const normalized = normalizePath(linkpath)
      const exact = vault.getAbstractFileByPath(normalized) || vault.getAbstractFileByPath(`${normalized}.md`)
      if (exact instanceof TFile) return exact
      const basename = normalized.split('/').pop().replace(/\.md$/i, '')
      return vault.getMarkdownFiles().find((file) => file.basename === basename) || null
    },
    getFileCache(file) {
      return file instanceof TFile ? { frontmatter: frontmatterFor(file.__content) } : null
    }
  }

  class WorkspaceLeaf {
    constructor(workspace, inNewSplit = false) {
      this.workspace = workspace
      this.app = workspace.app
      this.inNewSplit = inNewSplit
      this.view = { getViewType: () => 'empty' }
      this.type = 'empty'
    }

    async setViewState(viewState) {
      const factory = viewFactories.get(viewState?.type)
      if (!factory) throw new Error(`Unsupported Calendar view: ${viewState?.type}`)
      if (this.view?.onClose) await this.view.onClose()
      this.view?.unload?.()
      this.type = viewState.type
      this.view = factory(this)
      if (!leaves.includes(this)) leaves.push(this)
      await this.view.onOpen?.()
      return this
    }

    async openFile(file) {
      if (!(file instanceof TFile)) throw new Error('Calendar requested a non-file open')
      await request('open-note', { path: file.path, newSplit: this.inNewSplit })
      this.workspace.setActiveFile(file)
    }

    async detach() {
      await this.view?.onClose?.()
      this.view?.unload?.()
      const index = leaves.indexOf(this)
      if (index >= 0) leaves.splice(index, 1)
      this.type = 'empty'
      this.view = { getViewType: () => 'empty' }
    }
  }

  class ItemView extends Component {
    constructor(leaf) {
      super()
      this.leaf = leaf
      this.app = leaf.app
      this.containerEl = document.createElement('section')
      this.containerEl.className = 'workspace-leaf-content calendar-plugin-leaf'
      this.contentEl = document.createElement('div')
      this.contentEl.className = 'view-content'
      this.containerEl.append(this.contentEl)
      hostElement.replaceChildren(this.containerEl)
    }
  }

  class FileView extends ItemView {
    constructor(leaf, file = null) {
      super(leaf)
      this.file = file
    }
  }

  class Workspace extends Events {
    constructor() {
      super()
      this.layoutReady = true
      this.activeLeaf = new WorkspaceLeaf(this)
      this.activeLeaf.view = new FileView(this.activeLeaf, null)
      this.activeFile = null
    }

    registerView(type, factory) {
      viewFactories.set(type, factory)
      return () => viewFactories.delete(type)
    }

    getLeavesOfType(type) {
      return leaves.filter((leaf) => leaf.type === type)
    }

    getRightLeaf() {
      return new WorkspaceLeaf(this)
    }

    splitActiveLeaf() {
      return new WorkspaceLeaf(this, true)
    }

    getUnpinnedLeaf() {
      return new WorkspaceLeaf(this, false)
    }

    setActiveFile(file) {
      this.activeFile = file instanceof TFile ? file : null
      if (this.activeLeaf.view instanceof FileView) {
        this.activeLeaf.view.file = this.activeFile
      }
      // Keep the mounted Calendar ItemView in place; active-file changes are
      // signals for the plugin, not a request to replace its right-pane leaf.
      this.trigger('file-open', file)
    }

    getActiveFile() {
      return this.activeFile
    }

    trigger(name, ...args) {
      if (name === 'link-hover') showHoverPreview(args[1], args[4] || args[3])
      super.trigger(name, ...args)
    }
  }

  const workspace = new Workspace()

  class Plugin extends Component {
    constructor(app, manifest) {
      super()
      this.app = app
      this.manifest = manifest || { id: 'calendar', name: 'Calendar', version: '1.5.10' }
    }

    registerView(type, factory) {
      this.register(this.app.workspace.registerView(type, factory))
    }

    addCommand(command) {
      commands.set(command.id, command)
      post('commands-changed', { commands: [...commands.values()].map(({ id, name }) => ({ id, name })) })
      return command
    }

    addSettingTab(tab) {
      this.settingTab = tab
      return tab
    }

    async loadData() {
      return state.settings
    }

    async saveData(settings) {
      const nextSettings = settings && typeof settings === 'object' ? { ...settings } : {}
      if (sameSettings(nextSettings, state.settings)) return
      state.settings = nextSettings
      await request('save-settings', { settings: state.settings })
    }
  }

  class PluginSettingTab {
    constructor(app, plugin) {
      this.app = app
      this.plugin = plugin
      this.containerEl = document.createElement('div')
    }
  }

  class Modal {
    constructor(app) {
      this.app = app
      this.modalEl = document.createElement('div')
      this.modalEl.className = 'modal calendar-modal'
      this.contentEl = document.createElement('div')
      this.contentEl.className = 'modal-content'
      this.modalEl.append(this.contentEl)
      this.backdropEl = document.createElement('div')
      this.backdropEl.className = 'modal-container calendar-modal-container'
      this.backdropEl.append(this.modalEl)
      this.backdropEl.addEventListener('mousedown', (event) => {
        if (event.target === this.backdropEl) this.close()
      })
    }

    open() {
      document.body.append(this.backdropEl)
      this.onOpen?.()
    }

    close() {
      this.onClose?.()
      this.backdropEl.remove()
    }
  }

  class Notice {
    constructor(message, timeout = 4000) {
      const element = document.createElement('div')
      element.className = 'notice calendar-notice'
      element.setAttribute('role', 'status')
      element.textContent = String(message)
      document.body.append(element)
      window.setTimeout(() => element.remove(), timeout)
    }
  }

  class MenuItem {
    constructor() {
      this.title = ''
      this.icon = ''
      this.callback = null
    }
    setTitle(title) { this.title = title; return this }
    setIcon(icon) { this.icon = icon; return this }
    onClick(callback) { this.callback = callback; return this }
  }

  class Menu {
    constructor() {
      this.items = []
    }
    addItem(configure) {
      const item = new MenuItem()
      configure(item)
      this.items.push(item)
      return this
    }
    showAtPosition(position) {
      document.querySelector('.calendar-context-menu')?.remove()
      const menu = document.createElement('div')
      menu.className = 'calendar-context-menu'
      menu.setAttribute('role', 'menu')
      menu.style.left = `${Math.max(4, Number(position?.x) || 4)}px`
      menu.style.top = `${Math.max(4, Number(position?.y) || 4)}px`
      for (const item of this.items) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = item.title
        button.addEventListener('click', () => {
          menu.remove()
          item.callback?.()
        })
        menu.append(button)
      }
      document.body.append(menu)
      window.setTimeout(() => document.addEventListener('pointerdown', () => menu.remove(), { once: true }), 0)
    }
  }

  class SettingControl {
    constructor(element) {
      this.inputEl = element
    }
    setPlaceholder(value) { this.inputEl.placeholder = value; return this }
    setValue(value) { this.inputEl.value = value; return this }
    addOption(value, label) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      this.inputEl.append(option)
      return this
    }
    onChange(callback) {
      this.inputEl.addEventListener('change', () => callback(this.inputEl.type === 'checkbox' ? this.inputEl.checked : this.inputEl.value))
      return this
    }
  }

  class Setting {
    constructor(container) {
      this.settingEl = container.createDiv('setting-item')
      this.nameEl = this.settingEl.createDiv('setting-item-name')
      this.descEl = this.settingEl.createDiv('setting-item-description')
      this.controlEl = this.settingEl.createDiv('setting-item-control')
    }
    setName(value) { this.nameEl.textContent = value; return this }
    setDesc(value) { this.descEl.textContent = value; return this }
    addText(callback) { const input = document.createElement('input'); input.type = 'text'; this.controlEl.append(input); callback(new SettingControl(input)); return this }
    addDropdown(callback) { const select = document.createElement('select'); this.controlEl.append(select); callback(new SettingControl(select)); return this }
    addToggle(callback) { const input = document.createElement('input'); input.type = 'checkbox'; this.controlEl.append(input); const control = new SettingControl(input); control.setValue = (value) => { input.checked = Boolean(value); return control }; callback(control); return this }
  }

  function installDomExtensions() {
    const proto = HTMLElement.prototype
    if (!proto.empty) proto.empty = function empty() { this.replaceChildren() }
    if (!proto.detach) proto.detach = function detach() { this.remove() }
    if (!proto.createEl) proto.createEl = function createEl(tag, options, callback) {
      const element = document.createElement(tag)
      if (typeof options === 'string') element.className = options
      else if (options) {
        if (options.text !== undefined) element.textContent = String(options.text)
        if (options.cls) element.className = Array.isArray(options.cls) ? options.cls.join(' ') : options.cls
        if (options.attr) for (const [name, value] of Object.entries(options.attr)) element.setAttribute(name, String(value))
      }
      this.append(element)
      callback?.(element)
      return element
    }
    if (!proto.createDiv) proto.createDiv = function createDiv(cls, callback) {
      return this.createEl('div', typeof cls === 'string' ? { cls } : cls, callback)
    }
    if (!proto.createSpan) proto.createSpan = function createSpan(cls, callback) {
      return this.createEl('span', typeof cls === 'string' ? { cls } : cls, callback)
    }
  }

  function showHoverPreview(target, path) {
    document.querySelector('.calendar-hover-preview')?.remove()
    const file = typeof path === 'string' ? vault.getAbstractFileByPath(normalizePath(path)) : null
    if (!(file instanceof TFile)) return
    const preview = document.createElement('aside')
    preview.className = 'calendar-hover-preview'
    preview.setAttribute('role', 'tooltip')
    const heading = document.createElement('strong')
    heading.textContent = file.basename
    const excerpt = document.createElement('p')
    excerpt.textContent = file.__content.replace(/^---[\s\S]*?---\s*/m, '').replace(/\s+/g, ' ').trim().slice(0, 220) || '空のノート'
    preview.append(heading, excerpt)
    const rect = target instanceof Element ? target.getBoundingClientRect() : { right: 8, bottom: 8 }
    preview.style.left = `${Math.min(window.innerWidth - 260, Math.max(8, rect.right + 8))}px`
    preview.style.top = `${Math.min(window.innerHeight - 160, Math.max(8, rect.bottom + 8))}px`
    document.body.append(preview)
    target?.addEventListener?.('mouseleave', () => preview.remove(), { once: true })
  }

  function reportError(error) {
    const message = error instanceof Error ? error.message : String(error)
    post('error', { message })
    console.error('[TSUZUNE Calendar host]', error)
  }

  function selectedFile(path) {
    const file = typeof path === 'string' ? vault.getAbstractFileByPath(normalizePath(path)) : null
    workspace.setActiveFile(file instanceof TFile ? file : null)
  }

  async function handleParentMessage(event) {
    if (event.source !== window.parent) return
    const message = event.data
    if (!message || message.channel !== CHANNEL || message.session !== session) return
    if (message.type === 'response') {
      const pending = pendingRequests.get(message.payload?.requestId)
      if (!pending) return
      pendingRequests.delete(message.payload.requestId)
      if (message.payload.ok) pending.resolve(message.payload.value)
      else pending.reject(new Error(message.payload.error || 'Calendar request failed'))
      return
    }
    if (message.type === 'init') {
      state.settings = message.payload?.settings || {}
      state.daily = { ...state.daily, ...(message.payload?.daily || {}) }
      state.snapshot = message.payload?.snapshot || state.snapshot
      state.selectedPath = message.payload?.selectedPath || null
      vault.rebuild(state.snapshot)
      rebuildNoteActivityIndex()
      scheduleNoteActivityRender()
      if (message.payload?.language && !localStorage.getItem('language')) localStorage.setItem('language', message.payload.language)
      selectedFile(state.selectedPath)
      if (!initialized) {
        initialized = true
        resolveInitialization()
      }
      return
    }
    if (message.type === 'snapshot') {
      const previous = vault.getAbstractFileByPath(message.payload?.event?.path || '')
      state.snapshot = message.payload?.snapshot || state.snapshot
      state.selectedPath = message.payload?.selectedPath ?? state.selectedPath
      vault.rebuild(state.snapshot)
      rebuildNoteActivityIndex()
      scheduleNoteActivityRender()
      const current = vault.getAbstractFileByPath(message.payload?.event?.path || '')
      const eventType = message.payload?.event?.type
      if (eventType === 'unlink' && previous instanceof TFile) vault.trigger('delete', previous)
      else if (eventType === 'add' && current instanceof TFile) vault.trigger('create', current)
      else if (current instanceof TFile) vault.trigger('modify', current)
      selectedFile(state.selectedPath)
      return
    }
    if (message.type === 'selected-path') {
      state.selectedPath = message.payload?.path || null
      selectedFile(state.selectedPath)
      return
    }
    if (message.type === 'settings') {
      const nextSettings = message.payload?.settings || {}
      if (sameSettings(nextSettings, state.settings)) return
      state.settings = nextSettings
      if (initialized && pluginInstance?.loadOptions) {
        await pluginInstance.loadOptions()
      }
      return
    }
    if (message.type === 'run-command') {
      const command = commands.get(message.payload?.id)
      if (!command) return
      try {
        if (command.callback) await command.callback()
        else if (command.checkCallback && command.checkCallback(true) !== false) await command.checkCallback(false)
      } catch (error) {
        reportError(error)
      }
      return
    }
    if (message.type === 'unload') await unloadPlugin()
  }

  async function unloadPlugin() {
    for (const { reject } of pendingRequests.values()) {
      reject(new Error('Calendar host was unloaded'))
    }
    pendingRequests.clear()
    noteActivityEnabled = false
    noteActivityObserver?.disconnect()
    noteActivityObserver = null
    closeNoteActivity()
    if (!pluginInstance) return
    try {
      await pluginInstance.onunload?.()
      pluginInstance.unload?.()
    } finally {
      pluginInstance = null
      commands.clear()
      post('unloaded', {})
    }
  }

  installDomExtensions()
  installNoteActivity()

  const app = {
    isMobile: false,
    vault,
    workspace,
    metadataCache,
    foldManager: { load: () => null, save: () => undefined },
    internalPlugins: {
      plugins: {
        'daily-notes': { enabled: true, instance: { get options() { return state.daily } } }
      },
      getPluginById(id) {
        return id === 'daily-notes' ? { enabled: true, instance: { get options() { return state.daily } } } : null
      }
    },
    plugins: {
      getPlugin(id) { return pluginRegistry.get(id) || null }
    },
    fileManager: {
      async promptForFileDeletion(file) {
        if (!(file instanceof TFile)) return
        if (!window.confirm(`「${file.basename}」をゴミ箱へ移動しますか？`)) return
        await request('trash-note', { path: file.path })
        const deleted = vault.removeLocalFile(file.path)
        if (deleted) vault.trigger('delete', deleted)
      }
    }
  }
  workspace.app = app
  workspace.activeLeaf.app = app
  window.app = app
  window._bundledLocaleWeekSpec = { dow: 0 }

  const obsidian = {
    App: Object,
    Component,
    Events,
    FileView,
    ItemView,
    Menu,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    Vault,
    WorkspaceLeaf,
    normalizePath,
    parseFrontMatterTags
  }

  window.addEventListener('message', (event) => {
    void handleParentMessage(event).catch(reportError)
  })

  window.__tsuzuneCalendarHost = {
    obsidian,
    async activate(CalendarPlugin) {
      await initialization
      if (typeof window.moment !== 'function') throw new Error('Moment 2.29.1 did not load')
      window._bundledLocaleWeekSpec = { dow: window.moment.localeData().firstDayOfWeek() }
      if (typeof CalendarPlugin !== 'function') throw new Error('Calendar 1.5.10 did not export a plugin class')
      pluginInstance = new CalendarPlugin(app, {
        id: 'calendar',
        name: 'Calendar',
        version: '1.5.10',
        minAppVersion: '0.9.11'
      })
      pluginRegistry.set('calendar', pluginInstance)
      await pluginInstance.onload?.()
      post('activated', {
        id: 'calendar',
        version: '1.5.10',
        commands: [...commands.values()].map(({ id, name }) => ({ id, name }))
      })
    },
    unload: unloadPlugin
  }

  post('host-ready', { id: 'calendar', version: '1.5.10' })
})()
