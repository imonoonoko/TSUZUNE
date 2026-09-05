export function createCalendarPluginHostHtml(sessionId: string): string {
  const escapedSessionId = sessionId.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character)

  return `<!doctype html>
<html lang="ja" data-calendar-session="${escapedSessionId}" data-calendar-channel="tsuzune-calendar" data-calendar-handshake="parent">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' tsuzune-calendar:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="color-scheme" content="dark">
  <style>
    :root {
      color-scheme: dark;
      --background-primary: #1d2421;
      --background-secondary: #18201d;
      --background-modifier-border: #394641;
      --background-modifier-hover: #2a3732;
      --background-modifier-active-hover: #34453f;
      --text-normal: #e8eee9;
      --text-muted: #a5b3ac;
      --text-faint: #78857f;
      --interactive-accent: #83c7b8;
      --interactive-accent-hover: #9bd7c9;
      --tsuzune-note-created: #8ed5c5;
      --tsuzune-note-modified: #dfc47e;
      --font-interface-theme: "Segoe UI", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: transparent; color: var(--text-normal); font: 13px/1.45 var(--font-interface-theme); }
    button, input, select { color: inherit; font: inherit; }
    button { border: 0; border-radius: 4px; background: transparent; }
    button:hover, button:focus-visible { background: var(--background-modifier-hover); outline: none; }
    #calendar-plugin-host, .calendar-plugin-leaf, .view-content { min-height: 252px; width: 100%; }
    .view-content { padding: 10px 5px 12px; }
    .calendar-modal-container { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgb(4 8 6 / 72%); }
    .calendar-modal { width: min(380px, 100%); border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); box-shadow: 0 18px 52px rgb(0 0 0 / 45%); }
    .modal-content { padding: 18px; }
    .modal-button-container { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .modal-button-container button { padding: 7px 12px; border: 1px solid var(--background-modifier-border); }
    .modal-button-container .mod-cta { border-color: transparent; background: var(--interactive-accent); color: #10201b; }
    .calendar-notice { position: fixed; right: 12px; bottom: 12px; z-index: 1100; max-width: 280px; padding: 9px 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); box-shadow: 0 8px 28px rgb(0 0 0 / 35%); }
    .calendar-context-menu { position: fixed; z-index: 1050; min-width: 130px; padding: 4px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); box-shadow: 0 8px 28px rgb(0 0 0 / 35%); }
    .calendar-context-menu button { display: block; width: 100%; padding: 7px 10px; text-align: left; }
    .calendar-hover-preview { position: fixed; z-index: 1040; width: 244px; max-height: 150px; overflow: hidden; padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: 7px; background: var(--background-primary); box-shadow: 0 10px 34px rgb(0 0 0 / 42%); }
    .calendar-hover-preview p { margin: 5px 0 0; color: var(--text-muted); }
    .day { position: relative; }
    .day[data-tsuzune-activity="created"] { background-image: linear-gradient(90deg, color-mix(in srgb, var(--tsuzune-note-created) 18%, transparent), transparent 72%); box-shadow: inset 3px 0 var(--tsuzune-note-created); }
    .day[data-tsuzune-activity="modified"] { background-image: linear-gradient(0deg, color-mix(in srgb, var(--tsuzune-note-modified) 18%, transparent), transparent 72%); box-shadow: inset 0 -3px var(--tsuzune-note-modified); }
    .day[data-tsuzune-activity="created-modified"] { background-image: linear-gradient(90deg, color-mix(in srgb, var(--tsuzune-note-created) 16%, transparent), transparent 68%), linear-gradient(0deg, color-mix(in srgb, var(--tsuzune-note-modified) 16%, transparent), transparent 68%); box-shadow: inset 3px 0 var(--tsuzune-note-created), inset 0 -3px var(--tsuzune-note-modified); }
    .tsuzune-note-activity-trigger { position: absolute; top: 0; right: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 2px; width: 20px; height: 18px; padding: 0 1px; border: 1px solid color-mix(in srgb, var(--interactive-accent) 68%, var(--text-muted)); border-radius: 999px; background: rgb(10 19 16 / 94%); box-shadow: 0 1px 3px rgb(0 0 0 / 55%); opacity: 1; pointer-events: auto; }
    .tsuzune-note-activity-trigger:hover, .tsuzune-note-activity-trigger.is-selected { border-color: var(--interactive-accent); background: #24332d; }
    .tsuzune-note-activity-trigger:focus-visible { border-color: var(--interactive-accent); background: #24332d; outline: 2px solid var(--interactive-accent); outline-offset: 1px; }
    .tsuzune-note-activity-mark { display: grid; flex: 0 0 auto; width: 7px; height: 9px; place-items: center; color: #10201b; font-size: 7px; font-weight: 800; line-height: 1; pointer-events: none; }
    .tsuzune-note-activity-mark.is-created { border-radius: 1px; background: var(--tsuzune-note-created); box-shadow: 0 0 0 1px rgb(6 14 11 / 55%); }
    .tsuzune-note-activity-mark.is-modified { border: 1px solid var(--tsuzune-note-modified); border-radius: 50%; background: #171d1a; color: var(--tsuzune-note-modified); box-shadow: 0 0 0 1px rgb(6 14 11 / 55%); }
    .tsuzune-note-activity-legend { display: flex; flex-wrap: nowrap; align-items: center; gap: 4px 6px; min-height: 22px; margin: 3px 2px 0; padding: 4px 3px 0; border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 72%, transparent); color: var(--text-muted); font-size: 10px; line-height: 1.3; }
    .tsuzune-note-activity-legend strong { color: var(--text-normal); font-size: 11px; }
    .tsuzune-note-activity-legend-item { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
    .tsuzune-note-activity-legend-hint { margin-left: auto; color: var(--text-muted); white-space: nowrap; }
    .tsuzune-note-activity-popover { position: fixed; top: 42px; right: 6px; left: 6px; z-index: 900; display: grid; max-height: calc(100vh - 50px); overflow: hidden; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); box-shadow: 0 14px 38px rgb(0 0 0 / 46%); }
    .tsuzune-note-activity-popover header { display: flex; align-items: center; justify-content: space-between; min-height: 34px; padding: 6px 8px 5px 10px; border-bottom: 1px solid var(--background-modifier-border); }
    .tsuzune-note-activity-close { width: 24px; height: 24px; color: var(--text-muted); font-size: 18px; line-height: 1; }
    .tsuzune-note-activity-summary { display: flex; flex-wrap: wrap; gap: 5px; padding: 7px 10px; color: var(--text-muted); }
    .tsuzune-note-activity-badge { display: inline-flex; align-items: center; white-space: nowrap; font-size: 11px; }
    .tsuzune-note-activity-badge.is-created { color: var(--interactive-accent); }
    .tsuzune-note-activity-badge.is-modified { color: #c9b784; }
    .tsuzune-note-activity-list { min-height: 0; overflow: auto; border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 60%, transparent); }
    .tsuzune-note-activity-note { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 10px; border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 52%, transparent); border-radius: 0; text-align: left; }
    .tsuzune-note-activity-note:last-child { border-bottom: 0; }
    .tsuzune-note-activity-note:focus-visible { background: var(--background-modifier-hover); outline: 1px solid var(--interactive-accent); outline-offset: -2px; }
    .tsuzune-note-activity-copy { display: grid; min-width: 0; }
    .tsuzune-note-activity-copy strong, .tsuzune-note-activity-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tsuzune-note-activity-copy small { color: var(--text-faint); font-size: 10px; }
    .tsuzune-note-activity-kinds { display: grid; flex: 0 0 auto; gap: 1px; justify-items: end; }
    @media (prefers-reduced-motion: reduce) { .day { transition: none !important; } }
  </style>
</head>
<body>
  <main id="calendar-plugin-host" aria-label="Calendar"></main>
  <script src="tsuzune-calendar://host/bootstrap.js"></script>
  <script src="tsuzune-calendar://host/moment.js"></script>
  <script src="tsuzune-calendar://host/commonjs.js"></script>
  <script src="tsuzune-calendar://host/main.js"></script>
  <script src="tsuzune-calendar://host/activate.js"></script>
</body>
</html>`
}
