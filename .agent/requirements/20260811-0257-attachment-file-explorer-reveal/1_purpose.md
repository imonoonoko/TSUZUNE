# GP0-3b-p Attachment File Explorer Reveal Purpose

## Goal

Determine and, only if safe and proportionate, reproduce the single Obsidian 1.13.4 Graph context-menu operation `ファイルエクスプローラでファイルを表示` for one existing attachment.

The result must answer a narrow question: does the action reveal/select the attachment in an in-app File Explorer, cross to the operating system, or do something else? It must not be inferred from the label or from the already completed `フォルダで表示` slice.

## User value

An attachment found in Graph should be locatable from the same workspace without making the user guess which reveal behavior is being invoked. The action must preserve the current Graph and avoid opening an unintended external process.

## Success conditions

1. The fixed reference behavior and API/state boundary are recorded for the exact attachment and one click.
2. A safe TSUZUNE path is either implemented with a minimal public-behavior test, or the slice is stopped with a precise blocker when the reference requires an unsupported/unsafe surface.
3. Graph, workspace, Vault bytes, and external-process safety remain explicit in the evidence; no adjacent menu operation is bundled.

## Non-goal

This is not a general file browser, attachment manager, OS Explorer automation, or context-menu redesign.
