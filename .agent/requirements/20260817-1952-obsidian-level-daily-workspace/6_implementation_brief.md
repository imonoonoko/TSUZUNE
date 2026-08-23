# TSUZUNE Daily Workspace — Next Execution Brief

Status: ready for explicit execution selection; no product-code implementation is authorized by this document alone.

## Outcome

Complete one bounded acceptance packet for the installed Daily Workspace. Fix only a reproduced blocker. If no blocker remains, nominate R5 Workspace Tabs keyboard／ARIA as the next single implementation slice.

## Success conditions

1. Every Phase A scenario has a PASS／FAIL result, screenshot or DOM evidence where applicable, and an unchanged fixture Markdown digest.
2. Every executed Phase B scenario records the actual Windows setting, assistive technology, observed reading／focus behavior, and whether the user-visible environment was restored.
3. The boundary ends in exactly one decision: `FIX-ONE`, `R5-READY`, or `STOP-UNVERIFIED`.

## Non-goals

- No color/theme refresh, layout redesign, Outline, Focus mode, editable Properties, split view, hotkey customization, Hook, database, search engine, or plugin work.
- No automated opening of the production Vault for screenshots or error/conflict fixtures.
- No unattended changes to Windows display scale, High Contrast, Narrator, NVDA, or the user's foreground window.
- No product-code change merely to make a test easier to automate.

## Phase A — background-safe isolated acceptance

Use an isolated fixture Vault and isolated `userData`. Keep all windows offscreen or background-safe. Capture accepted screenshots and structured results.

| ID | Surface and operation | Fixed condition | PASS boundary |
|---|---|---|---|
| A1 | Three entry points | 1440×900; `Ctrl+O`, `Ctrl+P`, `Ctrl+Shift+F`, Escape | One intended surface opens, input is focused, Escape returns focus, no overlapping modal |
| A2 | FileTree pointer→keyboard | 900×768; click note, ArrowUp／Down, F2→Escape, Shift+F10→Escape | Clicked row owns focus; commands affect the focused row; no rename or data change remains |
| A3 | Japanese IME and typeahead | 900×768; composition then committed Japanese text | Composition events do not move selection; committed text alone participates in typeahead |
| A4 | Narrow workspace | 720×768; both sidebars open／closed; long Japanese labels and 120-character path | Center remains reachable; no application-wide horizontal overflow; close and primary actions remain reachable |
| A5 | Long content and state | 1280×800; long title/path, empty state, save error/conflict fixture | Text may truncate but full accessible name/tooltip remains; error and conflict action are visible and do not overlap |
| A6 | Current tabs baseline | 1440×900; note, Global Graph, attachment/linked view tabs | Existing pointer switching/closing preserves active content and safe save behavior; current missing R5 keyboard behavior is recorded as `not implemented`, not a regression |

Phase A commands are selected from existing capture/test scripts where possible. New automation may be added only if it is a small deterministic acceptance harness that reuses existing fixtures and does not alter product behavior.

## Phase B — scheduled user-visible Windows acceptance

Run only with explicit approval for a short visible test window. Do not change system settings in the background.

| ID | Check | Minimum operation | PASS boundary |
|---|---|---|---|
| B1 | Current Windows scale | Record actual scale; navigate entry points, FileTree, tabs, dialogs | Controls do not overlap; focus remains visible; dialog close action is reachable |
| B2 | Narrator or NVDA | Read app landmark order; announce Quick Switcher, Command Palette, FileTree selection, current tab | Names, roles, selected/expanded state, and modal boundaries are understandable without visual inference |
| B3 | High Contrast | User enables mode, app is rechecked, then user restores prior state | Current item, focus, disabled state, error/conflict, and primary action remain distinguishable without color alone |
| B4 | Additional scale sample | User selects one untested value from 125／150／175／200% and restarts the app if Windows requires it | Same boundary as B1; prior setting is restored or the retained change is explicitly confirmed by the user |

The first visible run does not need to cover all five scale values. One current value plus one additional value is enough to select or reject R5. Remaining scale values stay as recorded recheck items.

## Finding classification

- `BLOCKER`: data-loss risk, unreachable close/confirm action, focus trap, keyboard path acting on the wrong item, or assistive technology cannot identify the primary control/state.
- `DAILY-REGRESSION`: a repeatable failure in one of the three entry points, FileTree, tab switching, saving, or conflict handling.
- `LIMIT`: a known but non-blocking untested configuration or cosmetic issue that does not prevent the task.

Decision rule:

- Any `BLOCKER` → `FIX-ONE`; stop and define one root-cause repair.
- No blocker but a `DAILY-REGRESSION` reproduced in two matrix conditions → `FIX-ONE`.
- No blocker and no repeated daily regression → `R5-READY`.
- Missing evidence caused by tooling or unavailable visible approval → `STOP-UNVERIFIED`; do not infer PASS.

## R5 implementation candidate — only after `R5-READY`

### Public behavior

- The tablist uses roving `tabindex`; only the active or deliberately focused tab is tabbable.
- Each tab receives a stable DOM id, `aria-selected`, and `aria-controls` pointing to the active `tabpanel`; the panel is labelled by the active tab.
- ArrowLeft／ArrowRight moves tab focus with wraparound. Enter／Space activates the focused tab.
- `Ctrl+Tab`／`Ctrl+Shift+Tab` cycles active tabs. `Ctrl+1..8` selects indexed tabs, `Ctrl+9` selects the last tab, and `Ctrl+W` closes the active tab only when no modal or text-editing contract owns the shortcut.
- Closing the active tab selects and focuses the next logical tab. Closing the last tab leaves a labelled useful empty state.
- Long titles keep the existing ellipsis while exposing full tooltip and accessible text.

### Reuse boundary

- Reuse `workspaceTabs`, `activeTabId`, `loadWorkspaceTab`, `closeWorkspaceTab`, and the existing global shortcut effect in `src/renderer/App.tsx`.
- Keep note, Global Graph, attachment, and linked-view tab kinds. Do not add tab persistence, pinning, reorder, recently closed, split view, or a new state manager.
- Preserve `flushSave`, external-change, conflict, and active Graph behavior.

### Expected files

- `src/renderer/App.tsx`
- `src/renderer/styles.css` only if focus/active visibility or tooltip presentation needs a direct adjustment
- `tests/app.safety.test.tsx`
- one isolated Electron acceptance script/report only if existing scripts cannot prove narrow layout and focus

### Required executable checks

1. Focused tab tests: ARIA linkage, roving tabindex, Arrow／Enter／Space, Ctrl+Tab variants, Ctrl+1..9, Ctrl+W, close focus, modal/input collision.
2. Existing workspace-tab, Graph, attachment, linked-view, save, and conflict tests remain green.
3. `npm run typecheck`, focused tests, `npm test`, `npm run check:mcp`, `git diff --check`.
4. Isolated Electron evidence at 720×768 and 1440×900 with long Japanese titles and unchanged Markdown digest.
5. Because this changes shipped product code, `npm run production:update` must pass 10/10 before completion.

## Stop conditions

- Stop after the acceptance decision; do not automatically begin R5.
- During R5, stop after Workspace Tabs keyboard／ARIA passes. Do not continue to R6 action hierarchy or reading/context improvements.
- Stop and return for authority if the solution requires changing save/conflict semantics, adding a dependency, changing system settings unattended, or modifying the production Vault.
