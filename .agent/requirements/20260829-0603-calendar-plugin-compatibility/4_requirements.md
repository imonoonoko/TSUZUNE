# Calendar Plugin Compatibility Requirements

## 1. Overview
TSUZUNEはLiam Cain Calendar 1.5.10の公式配布物を固定対象として読み込み、利用者がObsidianで使う公開されたCalendar操作を同じMarkdown Vault上で提供する。

## 2. User Stories
- 日付を選び、既存Daily Noteを開きたい。
- 未作成日を選び、確認後に現在のDaily Note設定とtemplateで作成したい。
- 月ごとの書量と未完了taskをCalendar上で判別したい。
- week numberからWeekly Noteを開き、必要なら作成したい。
- Calendar設定とcommandをSettings／Command Paletteから使いたい。
- 開いているDaily Noteの月と日付をCalendarへ表示したい。

## 3. Acceptance Criteria

### Artifact identity
- Given Calendar candidate, when enabling compatibility, then id=`calendar`、version=`1.5.10`、公式SHA-256一致時だけloadする。
- Hash不一致、symlink、missing file、別versionは実行せず理由を表示する。

### Calendar view
- 起動時またはOpen view commandでright contextへ一つだけ表示する。
- 前後月移動、今日、選択日、week start、week numberが設定通り表示される。
- active noteが別月ならReveal active noteで対応月へ移る。

### Daily notes
- 既存日は通常のTSUZUNE note-open経路で開く。
- 未作成日はconfirm設定に従い、承認時だけ既存template／save safety経路で作る。
- 作成競合やtemplate失敗で既存内容を上書きしない。

### Indicators
- Words per Dotに従い最大5個のsolid dotを表示する。0なら無効。
- 未完了Markdown taskがある日はhollow indicatorを一つ表示する。
- 色だけに依存せずaccessible nameでも状態を伝える。

### Weekly notes
- Show Week Number有効時に列を表示し、選択でweekly noteを開く／安全に作る。
- Open Weekly Note commandで現在週へ移動する。
- folder、template、format設定を保持する。

### Settings and commands
- upstream公開設定と3 commandsがTSUZUNEの既存Settings／Command Palette語彙で到達できる。
- 設定はrestart後も保持し、失敗時に保存済み値を失わない。

### Lifecycle
- Vaultのcreate/delete/modifyとfile-openに追従し、unloadでlistenersとviewを除去する。
- 同じCalendar viewやlistenerを重複登録しない。

## 4. User-Facing Nonfunctional Requirements

### Responsiveness
- 右paneの標準幅と720 CSS px全体幅で横scrollを発生させない。

### Usability
- pointerとkeyboardの両方で日／月／設定／commandを操作できる。

### Accessibility
- day、indicator、navigation、settingsは名前、focus visible、disabled stateを持ち、WCAG AA contrastを満たす。

### Feedback And Errors
- loading、unsupported artifact、作成確認、作成失敗、空の月を明示する。

## 5. Open Questions
- 公式1.5.10 release assetのexact SHA-256。
- 上流compiled artifactが実際に参照するAPI surfaceとglobal。
- hover previewをTSUZUNE既存previewへ安全に接続できるか。

