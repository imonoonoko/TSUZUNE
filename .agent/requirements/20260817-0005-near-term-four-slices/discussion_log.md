# Discussion log

## 2026-08-17 — current evidence and decisions

### Current evidence

- sidebarは`App.tsx`の3-pane構造とgrid CSSにあり、既存の`bookmarksOpen`がsession-only toggleの先例である。
- Drive同期は片側削除を`preserve`として数えるだけで、remote adapterのtrash、delete tombstone、recovery契約がない。
- 5件分類の旧packetはproduction Drive identityとbatch rollbackが不足して`blocked-before-approval`だった。
- AI履歴のrevisionはroot path、note path、mtime、size、contentから計算されるが、旧履歴は旧mtimeとsizeを保存していない。

### Decisions

- UIは永続設定にせず、最小のaccessible session toggleとする。
- deletionは既定保持を変えず、explicit policyとrecoverable trashを追加する。
- classificationは「5件を必ず動かす」ではなく「本番適用条件をfreshに満たして動かす」を完了定義にする。
- legacy 164件は監査証拠として保存し、新しく作る履歴から検証可能にする。
- 4項目を同一release boundaryで検証するが、destructive production applyは項目別にゲートする。

### Residual validation items

- 現在pair済みのproduction Drive rootが対象Vaultとclean baselineを持つか。
- current single-entry move coordinatorが分類5件のlocal/Drive/sidecar rollback要件を満たすか。
- Drive isolated acceptanceでremote trash後のlist/filter挙動と再実行防止を実測できるか。
- history root hashを既存revision式とどう共有するのが最小か。
