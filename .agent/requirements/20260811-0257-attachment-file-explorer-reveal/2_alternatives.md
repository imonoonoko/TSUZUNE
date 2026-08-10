# GP0-3b-p Alternatives

## A. Internal File Explorer reveal/select — preferred if observed

The action may focus an existing Obsidian file-explorer item or pane. In TSUZUNE, first inspect the existing `FileTree`/`treeSelection` route. Extend it only enough to represent the observed public result; do not create a second browser or a generic navigation framework.

## B. OS Explorer reveal — not assumed

`フォルダで表示` already covers the parent-folder request through `showItemInFolder`. Treating this label as an alias for the same OS call would duplicate work and could misrepresent the reference. If the fixed reference actually crosses the OS boundary, capture that request with a fail-closed hook and make the product decision separately.

## C. Implement from the menu label — rejected

The Japanese label is insufficient evidence. Implementing a guessed callback before observing the reference risks silently choosing the wrong pane, path, or OS behavior.

## D. Batch the remaining menu items — rejected

`ファイルを削除`, file integration, note/tag behavior, and other remaining items have different mutation or surface contracts. They remain separate slices.

## E. Defer the operation entirely — fallback

If the reference seam cannot be safely intercepted, the target is disabled/ambiguous, or TSUZUNE has no proportionate existing surface, record `blocked`/`unimplemented` and return to the Graph queue without speculative code.
