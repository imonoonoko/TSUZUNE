# Orchestration

- D0 Discovery: read-only code map、design pressure test、verification map。完了。
- UI1 Reading Workspace Shell: CSS中心。state/data flowを変えず、header、tabs、note header、left hierarchy、reading widthを整理。
- UI2 Activity Rail: UI1受入後。既存action／handlerを細いrailへ再配置し、FileTreeとtoolbarを残す。
- UI3 Outline: UI2受入後。right tab契約を再利用し、heading抽出とjumpだけを追加。
- V1 Integration: 独立review、responsive／a11y／visual、full gates、production受入、TSUZUNE writeback。

Conflict policy: 現行working treeを正本とし、既存Night Workshop変更を戻さない。packet外の設計変更は親agentへ返す。

Stop policy: 前段のbehavior regression、data loss risk、実行中のproduction app、または新規dependency／保存modelが必要になった場合は広げず停止する。
