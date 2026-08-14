# GP0-3b-n Attachment Default App UI Prompt

## Surface

Global／Local Graphのnode context menu。対象は実在attachment nodeだけ。

## Required Menu Fragment

```text
…
リンクされたビューを開く  ›
デフォルトアプリで開く
ファイルを削除
```

## Interaction

1. 実在attachmentを右clickする。
2. `デフォルトアプリで開く`を選ぶ。
3. context menuを閉じる。
4. 既存の安全な外部open経路へrelative pathを1回渡す。
5. Graph view、camera、query、workspace tabを維持する。

## States

- Default: existing context-menu button styleを再利用する。
- Hover／focus: existing menu item styleを再利用する。
- Disabled: 作らない。対象外nodeには項目自体を表示しない。
- Error: 新しいdialogを作らず、既存の共通message bannerを使う。

## Accessibility Boundary

既存のnative `button`／`role="menuitem"`契約を維持し、mouse以外でもactivate可能にする。このsliceではcontext menu全体のfocus trap、screen reader、実Windows keyboard acceptanceを再設計しない。

## Do Not Add

- iconだけの曖昧な操作
- confirm dialog
- アプリ選択UI
- `フォルダで表示`の同時追加
- 新しいtoolbar／settings
