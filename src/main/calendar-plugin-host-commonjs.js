window.module = { exports: {} }
window.exports = window.module.exports
window.require = function requireCalendarDependency(id) {
  if (id === 'obsidian') return window.__tsuzuneCalendarHost.obsidian
  throw new Error(`Calendar 1.5.10 requested an unsupported dependency: ${String(id)}`)
}
