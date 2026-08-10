# GP0-3b-p Attachment File Explorer Reveal Requirements

## Status

This document is the GP0-3b-p design checkpoint. It fixes the question, fixture, safety boundary, and stop conditions only. Product implementation and an accepted fixed capture start after a separate continuation decision and the reference gate. A provisional runtime observation exists, but no repository evidence packet has been accepted.

## R1 — Reference first

- Use the pinned Obsidian 1.13.4 installer/asar and the existing isolated fixture. The known installer and asar hashes from GP0-3b-n/o remain the fixed inputs; a mismatch is a hard stop.
- Target exactly `attachments/diagram.svg`, a real attachment resolved from `00_Home.md`.
- Record the complete context menu and verify the exact item `ファイルエクスプローラでファイルを表示`, its enabled state, and its relative position after `フォルダで表示` and before deletion if that is what the runtime shows.
- Static source may suggest a seam, but runtime behavior decides the contract. A label, minified symbol, or prior slice is not sufficient.

## R2 — Meaning discovery

Before selecting the item, capture the Graph and workspace baseline. After one selection, classify the result as exactly one of:

1. internal File Explorer reveal/selection;
2. OS/external request;
3. another in-app navigation or an error; or
4. no observable action.

Do not claim parity until the classification is supported by the observed state or intercepted request. If more than one classification is plausible, stop and update this requirements package.

## R3 — Safe action

- Install the narrowest actual seam immediately before the action and assert its identity. For an OS boundary, stub it to record only a sanitized request and return without launching anything. For an internal transition, record the affected pane/tab/selection without synthesizing a second UI.
- Click once only after the hook or state observer is verified. Assert exactly one request/transition, menu close, and no fallback launch.
- Restore hooks and temporary observers in `finally`; a restoration failure invalidates the capture.

## R4 — State preservation

The action must not change the fixture content. Compare before/after and same-process Graph reopen for:

- Graph query, camera, node ID set, directed edge signature;
- Graph tab/leaf and active file/attachment. An internal classification may intentionally activate the
  File Explorer leaf; record that transition rather than treating it as an external launch. Graph data
  must remain recoverable when the Graph is reopened;
- File Explorer pane visibility, selected/revealed relative path, and any explicit workspace state;
- source/Vault digest, Markdown bytes, and attachment bytes;
- process count and hook restoration.

Node coordinates and pixel identity are not invariants. A second process is not required for the Obsidian reference unless a safe pre-start boundary is proven; TSUZUNE restart evidence may be captured separately only when it does not widen the product claim.

## R5 — TSUZUNE implementation gate

Only after R1–R4 pass may implementation be considered:

- If the result is internal File Explorer selection, prefer `FileTree`/`treeSelection` and existing `openNote`/selection callbacks. If attachments are not represented by the current public tree, first prove the smallest attachment-selection UI; do not create a parallel browser.
- If the result is OS/external, reuse the existing validated `revealVaultFile`/main seam only if the observed target is identical. A new IPC or absolute-path renderer API requires a new design gate and is not authorized here.
- If the result has no proportionate existing route, leave TSUZUNE unimplemented and record the blocker rather than adding speculative infrastructure.

## R6 — Product behavior and evidence

If implementation is authorized, the minimum public regression covers exact label/order, attachment-only availability, one callback/transition with the exact relative path, menu close, and Graph data plus the expected workspace transition. Capture evidence is limited to two screenshots per product plus structured lifecycle JSON. No attachment body, clipboard, raw Vault text, user path, credential, or process command line may enter repository evidence.

## R7 — Honest result

Use `matched-core-behavior` only when both products perform the same classified action on the same fixture identity, close the menu, preserve the required Graph data/Vault state, and show the same expected workspace transition. An internal File Explorer activation is not required to leave the Graph leaf active. Otherwise use `different`, `missing`, or `blocked` and retain the reason. Do not call an internal selection an OS reveal, or vice versa.

## Acceptance gates for the next slice

### Reference gate

- pinned installer/asar/fixture checks pass;
- exact item, order, enabled state, and target action are captured;
- the action classification is unambiguous;
- hook/state observer is installed before click, one action is recorded, menu closes, and all hooks restore;
- external launch is prevented if applicable.

### Product gate (future, not part of this checkpoint)

- only the observed attachment behavior is implemented;
- existing validated route is reused, or implementation is blocked honestly;
- focused public regression, typecheck, full tests, MCP smoke, diff-check, and Ponytail review pass.

### Stop gate

Stop after one successful classification and comparison. Do not continue to file deletion, file integration, note/tag/folder variants, OS automation, or production update.

## Non-goals

- Full Obsidian File Explorer parity.
- OS Explorer/associated-app automation.
- General attachment browsing or workspace persistence redesign.
- Automatic continuation to GP0-3b-q or another menu item.
