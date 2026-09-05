# D13 — Hooks設計結果

- 現行entryは`src/main/watcher.ts`のfilesystem watcherで、`ignoreInitial: true`、write settle 250ms、own-write予告を持つ。
- app起動前からあるInbox noteはeventにならないため、Hookをcorrectnessの根拠にはできない。startupとschedule開始時のfull scanが必須である。
- eventは`vault.file_observed`、`inbox.capture_saved`、`inbox.organization_applied`のfact-onlyとし、memory coalescingだけを行う。
- Hookは意味分類、LLM call、write、move、delete、履歴保存、即時再帰起動を行わない。
- 最初のHook sliceはdeterministic organizerの後に置き、external add、self-write、restart、move recoveryを境界testにする。

