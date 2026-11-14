# 脚注専用ビュー

## 採用と目的

2026-10-26、既存ToDoの次のP2として本人が採用。本文の文脈を離れず脚注を一覧し、参照・定義の位置へ移動し、既存定義を安全に編集する。

## 振る舞い

- 右の「ノートの文脈」に「脚注」タブ。現在の本文（未保存分を含む）の定義をソース順に表示し、参照数と各参照・定義への移動を提供する。本文にない脚注は作らない。
- 既存remark Markdown parserとfrontmatter分離を使い、コード・frontmatter内の偽構文を除外する。複数行、CRLF、参照なしの定義を扱う。重複・入れ子定義は表示と移動に限定し理由を示す。未定義の参照検出は対象外。
- 一意な最上位定義のみ「編集」でモーダルを開き、定義全体をMarkdown textareaで編集する。同じ識別子の定義一件に限定し、定義外テキスト・識別子変更・削除を拒否する。継続行はMarkdownの字下げを使う。
- 適用は既存CodeMirrorを一回のUndo単位で更新する。変更なしは履歴を追加・破棄しない。通常の自動保存・競合保護を使う。キャンセル・検証失敗は本文を変更せず、失敗時は入力を保持する。
- ソース・ノート・Vault・ペイン・表示モードのスナップショットが変われば適用を拒否する。保存中・busy・競合・別編集・IME中は編集不可。ダイアログは通常の背景操作を遮断し、Esc/キャンセルと適用後にフォーカスを戻す。
- 編集/Live Previewでは参照・定義をソース選択。Previewでは編集表示に切り替えて選択する。Live Previewの脚注ソース退避は維持する。タブ状態をworkspaceへ保存する。
- 脚注追加・削除・識別子変更・MCP拡張・新依存・未定義参照の補完は今回対象外。

## 実装境界

core: markdownFootnotes(source) -> {identifier,label,from,to,source,references:{from,to}[],editable,reason?}[]。footnoteChange(source,from,replacement) -> {from,to,insert}、不正入力はError。オフセットは元文字列基準。rendererは既存文脈タブとeditor imperative handleへ接続する。

## 検証

`npm exec vitest -- run tests/markdown-footnotes.test.ts tests/markdown-editor.test.tsx tests/footnotes-panel.test.tsx tests/related-notes.test.tsx` で脚注の解析、編集の検証、Undo／Redo、古い本文の拒否、タブ操作を確認する。隔離した実アプリでは一覧・実キー編集・参照や定義への移動・保存後の再起動を確認する。

## 改行の境界

解析と位置移動は元のCRLFオフセットを扱い、coreの置換は定義外を保つ。実際の本文編集は既存CodeMirrorと同じLF正規化を使う。CRLFファイル全体のbyte保存は今回の受入に含めない。
