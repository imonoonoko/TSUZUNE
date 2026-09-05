---
name: TSUZUNE
description: "書いて、つないで、あとで尋ねる。"
colors:
  night-canvas: "#141A19"
  night-sidebar: "#18201E"
  night-surface: "#1D2623"
  night-editor: "#202925"
  night-raised: "#26312D"
  line-quiet: "#36433F"
  line-strong: "#64766F"
  night-ink: "#E7E8E2"
  night-muted: "#AEB7B1"
  night-faint: "#9CA7A1"
  night-thread: "#78BFB2"
  night-focus: "#93D3C7"
  night-selection: "#29433E"
  night-link: "#83C9BD"
  warning: "#D5A45F"
  danger: "#E0847D"
typography:
  title:
    fontFamily: "Yu Gothic UI, Hiragino Sans, Meiryo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.04em"
  body:
    fontFamily: "Yu Gothic UI, Hiragino Sans, Meiryo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Yu Gothic UI, Hiragino Sans, Meiryo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  compact: "6px"
  control: "8px"
  surface: "12px"
spacing:
  hairline: "4px"
  compact: "8px"
  control: "12px"
  surface: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.night-thread}"
    textColor: "{colors.night-canvas}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  selected-row:
    backgroundColor: "{colors.night-selection}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.compact}"
    padding: "7px 10px"
---

# Design System: TSUZUNE

## Overview

**Creative North Star: "静かな知識工房"**

TSUZUNE should feel like returning to a familiar workbench at night: warm charcoal paper, quiet green tools, and just enough structure to see where knowledge is connected. The interface is information-dense because the work is real, but its hierarchy must remain calm. Writing is the dominant surface; navigation and related context support it from the edges. Night Workshop is the default visual theme as of 2026-08-26.

The system rejects generic AI dashboards, decorative gradients, flashy glassmorphism, enterprise SaaS chrome, and unfamiliar controls invented for novelty. Motion is restrained to state feedback. At rest, the application is still.

**Key Characteristics:**

- Warm charcoal surfaces with one restrained thread-teal voice.
- Compact controls and clear information hierarchy.
- Flat tonal layering; elevation is reserved for temporary layers.
- Familiar Windows behavior with strong keyboard focus.
- Brand character comes from material, proportion, and a small thread mark—not decoration.

## Colors

The palette combines five warm charcoal surfaces with a muted thread teal that signals selection, action, and connection without making the whole screen glow.

### Primary

- **Night Thread:** The sole action and connection voice. Use it for the primary action, active state, connected-node emphasis, and focus reinforcement.
- **Night Focus:** The high-contrast keyboard focus color. Use it as a 2px outline, not as decoration.
- **Night Selection:** The selected-row and active-tab background; pair it with Ink and a shape, weight, or boundary cue.

### Neutral

- **Night Canvas:** The top chrome and darkest application ground.
- **Night Sidebar:** The location and context side panels.
- **Night Surface:** Tabs, toolbars, panel headers, and temporary layers.
- **Night Editor:** The warm charcoal reading and writing paper.
- **Night Raised:** Hovered controls and input fields.
- **Night Ink / Muted / Faint:** Primary text, metadata, and nonessential assistance in descending emphasis.
- **Quiet / Strong Line:** Decorative separation versus boundaries that must remain perceivable.

### Semantic

- **Warning:** Missing links, stale information, and recoverable attention states.
- **Danger:** Conflicts, destructive actions, and failures only.

**The One Thread Rule.** Night Thread is the only general accent and must remain visually scarce. If several unrelated colors compete for attention, the screen is off-brand.

**The Editor Is Paper Rule.** The editor is charcoal rather than white, but still carries the visual calm and readability of paper. Warm neutrals must never reduce text contrast below WCAG AA.

## Typography

**Display Font:** Yu Gothic UI (with Hiragino Sans, Meiryo, and system sans-serif fallbacks)

**Body Font:** Yu Gothic UI (with Hiragino Sans, Meiryo, and system sans-serif fallbacks)

**Character:** One humanist Japanese system stack keeps writing native to Windows, fast to render, and visually consistent with user-entered Japanese. Hierarchy comes from weight, size, and spacing rather than mixing decorative families.

### Hierarchy

- **Title** (700, 16px, 1.4): note titles, primary dialog titles, and current-work headings.
- **Body** (400, 14px, 1.7): note chrome, previews, explanations, and content-adjacent text.
- **Label** (600, 12px, 1.4, 0.04em): toolbar labels, metadata headings, statuses, and compact controls.

**The Writing Wins Rule.** Interface labels stay compact. Large display typography is prohibited inside the daily workspace because the note—not TSUZUNE—is the content.

## Elevation

TSUZUNE is flat by default. Depth comes from tonal boundaries between Night Canvas, Sidebar, Surface, Editor, and Raised. Ambient shadow appears only on modal dialogs, temporary menus, and floating confirmation surfaces that are genuinely above the workspace.

### Shadow Vocabulary

- **Ambient Overlay** (`0 12px 32px rgb(0 0 0 / 28%)`): dialogs and temporary elevated layers only.

**The Flat Workbench Rule.** Permanent panels never float. If every surface has a card shadow, the application has become a generic dashboard.

## Components

### Buttons

- **Shape:** Compact, gently curved edges (6px radius) with a minimum 30px hit height.
- **Primary:** Night Thread with Night Canvas text and compact 6px by 12px padding.
- **Secondary:** Night Raised with a Quiet or Strong Line border; it must read as available without competing with the primary action.
- **Hover / Focus:** Hover changes tone, not geometry. Keyboard focus uses a visible 2px teal outline and must never be removed.
- **Icons:** Use familiar line icons beside short labels. Icon-only actions require a tooltip and accessible name.

### Cards / Containers

- **Corner Style:** 12px for welcome, dialog, and report-like surfaces; workspace panels remain square and structural.
- **Background:** Night Editor, Surface, or Raised according to hierarchy.
- **Shadow Strategy:** No shadow at rest; Ambient Overlay only for genuinely temporary layers.
- **Border:** One-pixel Quiet Line for decorative division and Strong Line where the boundary carries meaning.
- **Internal Padding:** 16px for compact surfaces and 24px for onboarding or empty-state surfaces.

### Inputs / Fields

- **Style:** Night Raised fill, one-pixel Strong Line border, 8px radius, and 8px by 10px internal padding.
- **Focus:** Visible teal outline plus border reinforcement; focus must not depend on color alone.
- **Error / Disabled:** Error text names the problem. Disabled state uses opacity only in addition to a disabled semantic state.

### Navigation

- **Tree:** Compact rows with a stable indentation rhythm. The current item uses Night Selection plus weight or a boundary cue, not color alone.
- **Toolbars:** Group actions by task and show icons with concise labels. Long sentences and repeated nouns are forbidden in toolbars.
- **Panels:** Left is location, center is work, right is context. At narrower widths, context may collapse before the writing area is compromised.

### TSUZUNE Mark

The mark is an interwoven bell: two broad ribbons cross into one quiet chime. The crossing represents connected notes; the bell and clapper represent `鈴音`. It appears in the Windows icon, application header, loading state, and empty state. It never becomes a watermark or decorative background pattern.

The application icon uses a Workshop Night square with a jade-and-warm-ivory mark. The tray icon is a separately simplified transparent asset with a dark outline, so it remains recognizable at 16–32px on both light and dark Windows taskbars. Do not derive the tray icon by shrinking the full application tile, and do not add gradients, lettering, thin-line networks, or extra nodes.

## Do's and Don'ts

### Do:

- **Do** preserve warm charcoal Editor and Canvas surfaces with Night Ink at WCAG AA contrast.
- **Do** keep Night Thread scarce and meaningful: active, connected, focused, or primary.
- **Do** use familiar line icons beside short Japanese labels for frequent actions.
- **Do** keep writing and graph exploration usable with pointer, keyboard, and screen reader.
- **Do** respect reduced-motion preferences and use transitions only for state feedback.
- **Do** leave Markdown readable and recoverable without TSUZUNE or an app-owned database.

### Don't:

- **Don't** turn TSUZUNE into a generic AI dashboard filled with decorative cards, gradients, and marketing language.
- **Don't** use flashy glassmorphism, neon accents, or motion that competes with writing.
- **Don't** introduce enterprise SaaS density, account-first onboarding, collaboration chrome, or telemetry surfaces.
- **Don't** invent strange controls where a familiar Windows interaction already exists.
- **Don't** lock knowledge into an app-owned database.
- **Don't** make manual sorting, tagging, or ranking a mandatory daily maintenance ritual.
