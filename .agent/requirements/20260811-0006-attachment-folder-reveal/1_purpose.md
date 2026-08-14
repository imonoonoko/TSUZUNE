# GP0-3b-o Attachment Folder Reveal Purpose

## Problem

The Graph attachment menu has been compared through `デフォルトアプリで開く`, but the adjacent `フォルダで表示` operation is not yet understood or implemented in TSUZUNE. Guessing whether it opens a folder, selects a file, or changes an in-app view could create an unsafe or misleading parity claim.

## Target user

A Windows personal-Vault user who wants to locate an existing attachment in its containing folder from the Graph, without changing the Vault or losing the current Graph view.

## Desired outcome

- Establish the fixed Obsidian 1.13.4 behavior for one real attachment.
- Identify the exact OS or in-app boundary and payload without launching Explorer during capture.
- Define the smallest TSUZUNE behavior that preserves the existing trusted path-validation and Graph state contracts.
- Keep the result honest about restart, OS selection, accessibility, and physical-input boundaries.

## Success definition for this design slice

A reviewable requirements package and PLAN checkpoint exist. Implementation remains unauthorized until the fixed reference capture passes its safety gate.
