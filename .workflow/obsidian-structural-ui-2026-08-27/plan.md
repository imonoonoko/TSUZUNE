# Obsidian-inspired structural UI continuation

Goal: Night Workshopの配色段階に続き、Daily Workspaceの構造を「場所・作業・文脈」が即座に分かるObsidian寄りの操作面へ進化させる。

Success criteria:

1. UI-1 Reading Workspace Shell、UI-2 Activity Rail、UI-3 Outlineを依存順に分離して実装し、既存の保存・Markdown・FileTree・Workspace Tabs・right tabsのkeyboard／ARIA契約を維持する。
2. 1440、900、720相当で本文、tab、sidebar toggleが重ならず、本文幅65〜75文字とNight WorkshopのAA contrastを維持する。
3. typecheck、focused/full tests、MCP check、isolated Electron visualを通し、安全ならproduction update 10/10とfresh runtime matchまで確認する。

Current context:

- Night Workshopの色・surface hierarchyは実装・本番反映済み。
- 現行left panelの大型action群、compact chrome、Outlineは未完。
- working treeの既存Night Workshop差分は保護対象。

Constraints:

- Markdown正本、既存保存経路、ローカル一台運用を維持する。
- 新規dependency、plugin／theme system、app-owned DB、account、cloud、telemetryを追加しない。
- 実行中の本番TSUZUNEを強制終了しない。Git公開・mergeは別の明示認可まで行わない。
- 見た目整理とOutline機能は同じpacketへ混ぜない。

Risks:

- App.tsxの既存inert／shortcut／sidebar stateを崩すこと。
- 720／900pxとWindows表示倍率でcontrolが重なること。
- Outlineのheading抽出とEditor／Preview jumpの意味がずれること。

Approval required: 本番アプリ稼働によりproduction updateが停止した場合のみ利用者判断が必要。破壊的操作、公開、外部変更は範囲外。

Workflow artifact path: `.workflow/obsidian-structural-ui-2026-08-27/`

Work packets: `UI1 -> UI2 -> UI3 -> V1`。各UI packetは前段のverification後に開始する。

Integration policy: 既存handler・component・CSS tokenを優先し、親agentが各packetの差分と未提示境界を統合確認する。

Verification: narrow tests、typecheck、full tests、check:mcp、isolated Electron、必要時production update。

Reusable artifacts: 最終evidenceは既存repo reportとTSUZUNEの同一campaign記録へ集約し、重複記録を作らない。
