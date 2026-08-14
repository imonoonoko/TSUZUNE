---
name: TSUZUNE
description: "書いて、つないで、あとで尋ねる。"
colors:
  thread-teal: "#2F655F"
  thread-teal-deep: "#254F4A"
  thread-teal-soft: "#DCEBE6"
  workshop-night: "#283B38"
  workshop-night-deep: "#1D302D"
  ink: "#292822"
  muted-ink: "#777267"
  paper: "#FFFDF8"
  paper-soft: "#F8F5ED"
  canvas: "#F4F0E7"
  rule: "#DDD7CA"
  warning: "#9B5D2D"
  danger: "#9A3F3B"
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
    backgroundColor: "{colors.thread-teal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  selected-row:
    backgroundColor: "{colors.thread-teal-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "7px 10px"
---

# Design System: TSUZUNE

## Overview

**Creative North Star: "静かな知識工房"**

TSUZUNE should feel like returning to a familiar workbench: warm paper, dark green tools, and just enough structure to see where knowledge is connected. The interface is information-dense because the work is real, but its hierarchy must remain calm. Writing is the dominant surface; navigation and related context support it from the edges.

The system rejects generic AI dashboards, decorative gradients, flashy glassmorphism, enterprise SaaS chrome, and unfamiliar controls invented for novelty. Motion is restrained to state feedback. At rest, the application is still.

**Key Characteristics:**

- Warm paper surfaces with one restrained deep-teal voice.
- Compact controls and clear information hierarchy.
- Flat tonal layering; elevation is reserved for temporary layers.
- Familiar Windows behavior with strong keyboard focus.
- Brand character comes from material, proportion, and a small thread mark—not decoration.

## Colors

The palette combines warm archival paper with a muted thread teal that signals selection, action, and connection.

### Primary

- **Thread Teal:** The sole action and selection voice. Use it for the primary action, active state, connected-node emphasis, and focus reinforcement.
- **Deep Thread Teal:** The pressed and hovered form of the primary color. It must never become a large decorative background.
- **Soft Thread Teal:** The selected-row and quiet contextual highlight surface.

### Neutral

- **Workshop Night:** The application header and the strongest framing surface.
- **Ink:** Primary text and note content.
- **Muted Ink:** Metadata, paths, counts, and secondary explanation.
- **Paper:** Editors, fields, and readable foreground surfaces.
- **Soft Paper:** Secondary panels and quiet container backgrounds.
- **Canvas:** The application ground behind panels.
- **Rule:** Dividers, field borders, and structural boundaries.

### Semantic

- **Warning:** Missing links, stale information, and recoverable attention states.
- **Danger:** Conflicts, destructive actions, and failures only.

**The One Thread Rule.** Thread Teal is the only general accent and must remain visually scarce. If several unrelated colors compete for attention, the screen is off-brand.

**The Paper Is Data Rule.** Warm neutrals support reading; they must never reduce text contrast below WCAG AA.

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

TSUZUNE is flat by default. Depth comes from tonal boundaries between Workshop Night, Canvas, Paper, and Soft Paper. Ambient shadow appears only on modal dialogs, temporary menus, and floating confirmation surfaces that are genuinely above the workspace.

### Shadow Vocabulary

- **Ambient Overlay** (`0 12px 32px rgb(67 58 41 / 9%)`): dialogs and temporary elevated layers only.

**The Flat Workbench Rule.** Permanent panels never float. If every surface has a card shadow, the application has become a generic dashboard.

## Components

### Buttons

- **Shape:** Compact, gently curved edges (6px radius) with a minimum 30px hit height.
- **Primary:** Thread Teal with Paper text and compact 6px by 12px padding.
- **Secondary:** Paper with a Rule border; it must read as available without competing with the primary action.
- **Hover / Focus:** Hover changes tone, not geometry. Keyboard focus uses a visible 2px teal outline and must never be removed.
- **Icons:** Use familiar line icons beside short labels. Icon-only actions require a tooltip and accessible name.

### Cards / Containers

- **Corner Style:** 12px for welcome, dialog, and report-like surfaces; workspace panels remain square and structural.
- **Background:** Paper or Soft Paper according to hierarchy.
- **Shadow Strategy:** No shadow at rest; Ambient Overlay only for genuinely temporary layers.
- **Border:** One-pixel Rule border where tonal contrast alone is insufficient.
- **Internal Padding:** 16px for compact surfaces and 24px for onboarding or empty-state surfaces.

### Inputs / Fields

- **Style:** Paper fill, one-pixel Rule border, 8px radius, and 8px by 10px internal padding.
- **Focus:** Visible teal outline plus border reinforcement; focus must not depend on color alone.
- **Error / Disabled:** Error text names the problem. Disabled state uses opacity only in addition to a disabled semantic state.

### Navigation

- **Tree:** Compact rows with a stable indentation rhythm. The current item uses Soft Thread Teal plus weight, not color alone.
- **Toolbars:** Group actions by task and show icons with concise labels. Long sentences and repeated nouns are forbidden in toolbars.
- **Panels:** Left is location, center is work, right is context. At narrower widths, context may collapse before the writing area is compromised.

### TSUZUNE Mark

The mark is an interwoven bell: two broad ribbons cross into one quiet chime. The crossing represents connected notes; the bell and clapper represent `鈴音`. It appears in the Windows icon, application header, loading state, and empty state. It never becomes a watermark or decorative background pattern.

The application icon uses a Workshop Night square with a jade-and-warm-ivory mark. The tray icon is a separately simplified transparent asset with a dark outline, so it remains recognizable at 16–32px on both light and dark Windows taskbars. Do not derive the tray icon by shrinking the full application tile, and do not add gradients, lettering, thin-line networks, or extra nodes.

## Do's and Don'ts

### Do:

- **Do** preserve the warm Paper and Canvas surfaces with Ink text at WCAG AA contrast.
- **Do** keep Thread Teal scarce and meaningful: active, connected, focused, or primary.
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
