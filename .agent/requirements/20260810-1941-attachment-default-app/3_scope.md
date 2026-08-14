# GP0-3b-n Attachment Default App Scope

## In Scope

- 固定Obsidian 1.13.4の実在attachment node 1件。
- context menuのexact label、順序、有効状態、選択、menu close。
- TSUZUNEの実在attachment nodeへ同じ操作を追加する最小差分。
- 既存`onOpen`、`openVaultFile`、trusted IPC、`resolveFileForOpen`、`shell.openPath`の再利用。
- 外部open requestの安全なintercept、call count、sanitized exact targetの記録。
- action直後と同一process内のGraph再表示後のGraph／workspace／Vault不変確認。
- TSUZUNEだけ、main import前hookで安全に遮断できる別process再起動を追加観測する。
- narrow renderer regression、必要な既存backend regression、全回帰、typecheck、MCP smoke、comparison JSON／HTML。

## Out of Scope

- OSがどのアプリを選ぶか、実アプリが起動できるか、chooser／cancel。
- 固定Obsidian参照の別process再起動と、再起動時のrequest非再生証明。
- note nodeをOS既定アプリで開くparity、tag、folder、未解決node。
- `フォルダで表示`、Explorer表示、ファイル統合、削除等の残るmenu項目。
- MIME判定、拡張子とアプリの対応表、retry、確認dialog。
- Graph context menu全体のfocus model再設計。
- 物理mouse／keyboard、screen reader、High Contrast、multi-DPI、pixel同一性のacceptance。
- 新IPC、preload型、DB、service、dependency、background process。

## Change Boundary

製品sourceの第一候補は`WikiGraphView.tsx`のmenu項目1件だけである。固定参照が想定を支持する限り、App、main、preload、shared types、Vault serviceを変更しない。

## Safety Boundary

- rendererはVault相対pathだけを既存callbackへ渡す。
- main processのtrusted sender確認とVault resolverを迂回しない。
- capture hookが設置・検証できなければclickしない。
- capture失敗時に実外部起動へfallbackしない。
- 製品側から`Start-Process`、shell command、独自の`file://`生成を行わない。固定参照が既存`window.open`へ渡すfile URLはhook内で記録するだけにする。
