# AI Write Review Mode UI Prompt

## Screen: Settings / AI書き込み

### Purpose

Review対象pathの設定と、AI変更案の比較・承認・取消を一か所で行う。

### Layout Diagram

```text
+------------------------------------------------------+
| 設定                                             [×] |
+------------------------------------------------------+
| AI書き込み                                           |
| Reviewするパス                                       |
| [ Projects/Important____________________________ ]   |
|                                                      |
| 保留中の変更案 (1)                                   |
| [Projects/Important.md] [更新] [12:31]               |
|                                                      |
| 現在                         提案                     |
| - old line                   + new line               |
|                                                      |
| 理由 / 出典                                           |
|                                   [取消] [承認して適用]|
+------------------------------------------------------+
```

### Primary Components

- Review path textarea: immutable設定と同じ1行1path形式。空が既定。
- Pending list: path、作成／更新、作成時刻を表示する。
- Diff viewer: currentとproposedを追加／削除記号と見出し付きで表示する。
- Actions: `取消`と`承認して適用`。競合時は適用buttonを無効化せず、操作結果として明示的に失効を知らせる。
- Empty state: 「保留中のAI変更案はありません」。

### User Flow

1. 利用者がReview pathを設定して保存する。
2. AIが対象pathへ書込みを要求し、MCPがproposal IDと未適用を返す。
3. 利用者がSettingsを開き、proposalとdiffを確認する。
4. 取消ならVault不変。承認なら最新状態を再検証して適用する。
5. 競合時はproposalを失効表示にし、AIへ再提案させる。

### Design Tone

- 既存Settings modalの見た目、spacing、button、focus handlingを再利用する。
- 危険色を常用せず、承認はprimary、取消はsecondary、競合は既存error toneを使う。
- denseな開発者向け画面にせず、1件ずつ確認できればよい。

### Implementation Prompt

既存`App.tsx`のSettings modalへ「AI書き込み」sectionを追加する。Review path設定とpending proposal一覧を表示し、一件を選ぶと現在本文・提案本文・理由・出典を比較できる。keyboard focus、Escape、busy state、error messageは既存modal patternを再利用する。新しいwindow、routing、常時polling、通知service、diff dependencyは追加しない。差分は最初のsliceではplain textの現在／提案並列表示でもよく、追加／削除を色だけで区別しない。
