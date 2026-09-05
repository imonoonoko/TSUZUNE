# TSUZUNE Obsidian級Daily Workspace: Scope

Status: direction approved; the 2026-08-27 P0-6 top-shell/settings continuation is source-verified and awaiting production acceptance. `state.json` is the current campaign status authority.

## Delivery Principle

完成水準は日常操作についてObsidian級を維持する。ただし実装は、一度に一つの公開挙動だけを変更する。P0を一括releaseへまとめず、各sliceが独立して使え、失敗を検出でき、必要なら戻せる形で進める。

## P0: Daily Navigation Contract

P0は「毎日使う操作が速く、予測可能で、keyboardだけでも完了する」ための必須範囲である。

### P0-1 Quick Switcher

- `Ctrl+O`でどこからでも開く。
- 既存ranked searchを再利用し、title、path、alias、recentを検索する。
- 最初のrecentはsession内で開いたMarkdown noteを最大20件保持する。再起動後の永続化とattachment tab履歴は利用実績を見て別sliceにする。
- Arrow／Home／End、Enter、Ctrl+Enter、Escapeを提供する。
- 同名noteはpathで区別する。該当なしからの作成は明示rowを選んだ時だけ行う。

### P0-2 Command Palette

- `Ctrl+P`で既存actionを名前から実行する。
- 最初はstaticな最小command listを既存handlerへ接続し、plugin architectureを作らない。
- shortcut、現在状態、disabled reasonを表示する。
- destructive commandは初回scopeから除外するか、既存確認dialogを必須にする。

### P0-3 / R3 Full-text Search

- `Ctrl+Shift+F`でpersistent Vault searchを表示し、検索入力へfocusする。既存`Ctrl+K`は互換aliasとして維持する。
- 既存の`tag:`／`path:`／`file:`／quoted phrase／negationを維持し、検索surfaceで短く説明する。
- 結果はtitle、path、modified time、match周辺excerptを示し、matchを色だけに依存せず強調する。
- Quick Switcher、Command Palette、Searchを「ノートを開く」「操作を実行」「内容を検索」と明確に分ける。
- 新index／database／BM25／embedding／recent search永続化はこのsliceへ含めない。

### P0-4 FileTree Keyboard and Semantics

- 各可視rowを標準treeitem contractへ揃える。
- Arrow、Home／End、typeahead、Enter、F2、Shift+F10を提供する。
- TypeaheadはIME composition中に選択を動かさず、確定文字だけを扱う。
- active noteを自動revealし、視覚選択とaccessibility selectionを一致させる。
- 既存drag／drop、rename、move、trash、context menuを置き換えず再利用する。

### P0-5 Workspace Tabs Keyboard and Semantics

- roving tabindex、`aria-controls`、`tabpanel`を完成させる。
- ArrowLeft／Right、Ctrl+Tab／Ctrl+Shift+Tab、Ctrl+1..9、Ctrl+Wを提供する。
- 長いtitleは視覚上省略しても、tooltipとaccessible nameで全文を取得できる。
- 閉じた後のfocusと、save中／conflict中のdata safetyを固定する。

### P0-6 Action Hierarchy and Language

- 左側はquick create、navigation、Vault-wide view、overflowの順に整理する。
- editor toolbarは高頻度formatとInsert／Moreへ分け、全controlへtooltipとshortcutを示す。
- 「グラフビュー」を「Vault全体のグラフ」、「ローカルグラフ」を「このノートのグラフ」へ変更し、対象範囲を明示する。
- headerのSync／Settingsなど低頻度actionは、note titleとsave stateより強く見せない。

### P0-7 Worst-case Acceptance Baseline

- 720／900／1280／1440 CSS px。
- Windows display scale 100／125／150／175／200%。
- 50文字以上の日本語title、120文字以上のpath、同名note、空／error／conflict state。
- 左右sidebar open／one closed／both closed。
- DOM test、isolated Electron、実Windows keyboard／NarratorまたはNVDA／High Contrastを別々に記録する。

## P1: Read and Write Without Fatigue

- 右contextへOutline tabを追加し、heading jumpと現在section表示を行う。
- PreviewとEditorの本文を65〜75chへ抑え、wide table／codeだけ内部scrollで扱う。
- Propertiesを折りたたみ可能にし、件数と主要項目をcollapsed stateに残す。
- Backlinksへ一致heading／excerpt、collapse、filter、sortを段階追加する。
- Preview／Edit切替でcursor、selection、scroll contextを可能な範囲で維持する。
- Wiki link入力候補を既存note listから出す。
- Focus mode commandで左右sidebarを一時的に閉じ、解除時に直前状態を復元する。
- Full-text Search初回slice後、独立した実利用摩擦が反復した場合だけrecent searchesなどの追加改善を検討する。
- Narrow layoutではauxiliary panelを一つずつ扱い、center work surfaceへの到達を守る。

## P2: Power-user Workspace

- Tab pin、drag reorder、recently closed tab、session restore。
- Hotkey customization。まず固定shortcutの利用実績を観測してから追加する。
- Font size、density、readable line length、sidebar widthの少数設定。
- Limited split view。最初は左右2分割だけで、任意pane treeは作らない。
- Editable Properties。revision、atomic write、historyを再利用し、型schemaは別sliceにする。
- Local Graphのdepth／preset、Backlinks linked view、Outline linked view。
- Preview内検索とheading間navigation。

## Future

- Live Preview相当のMarkdown editing。
- Rich media embedding、attachments workspace、Canvas。
- `.base`互換view。

Futureは「Obsidian並みに見やすく使いやすい」P0／P1の完了条件ではない。個別の実利用摩擦または明示要求が出た時に要件化する。

## Out of Scope

- Obsidianのpixel copy、theme／CSS ecosystemの完全互換。
- Community plugin system、marketplace。
- Account、telemetry、collaboration、cloud syncをUX改善の前提にすること。
- Mobile専用gesture、pop-out windowsの完全再現。
- AI featureを日常navigationの必須依存にすること。
- App-owned databaseをMarkdown閲覧の必須条件にすること。
- Canvas、Bases、Slidesなどを機能数のためだけに先行実装すること。

## Constraints

- Product: personal, one-device, local Windows。
- Source of truth: ordinary Markdown files。
- Visual identity: existing Paper、Ink、Thread Teal、「静かな知識工房」。
- Technology: existing React／Electron／CodeMirror／search／workspace stateを優先する。新規dependencyは、現行能力で満たせない実測理由がある場合だけ。
- Safety: dirty worktreeを保全し、data loss防止、revision、history、trash、conflict behaviorを簡略化しない。
- Delivery: codeを変更したverified milestoneはproduction update 10/10 gateを通す。

## Recommended Sequence

```text
Quick Switcher
    ↓ interaction patternを実証
Command Palette
    ↓ global command modelを固定
Full-text Search
    ↓ 3つの入口と検索結果契約を固定
FileTree keyboard
    ↓ navigation semanticsを固定
Workspace Tabs keyboard
    ↓ work history semanticsを固定
Action hierarchy / wording / tooltips
    ↓
Outline + readable line length
    ↓
Backlinks / Properties / focus continuity
    ↓
Power-user options
```

各矢印はcode dependencyではなく、利用者が体感を確認する順序を示す。P0各sliceは単独で完了できる。

## Completion Boundary

P0は次のすべてが成立した時に完了とする。

1. 3つの入口がkeyboardだけで使える。
2. TreeとTabsが標準keyboard／ARIA contractを満たす。
3. Graph scope、primary／secondary actions、save stateが初見で区別できる。
4. worst-case fixtureと実Windows scale／assistive technologyの結果が記録される。
5. shipped codeがproduction gateを通り、installed binaryとsource境界が一致する。
