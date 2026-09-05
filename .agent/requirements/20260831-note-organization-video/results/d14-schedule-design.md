# D14 — Schedule設計結果

- TSUZUNE sourceにはAI providerも汎用schedulerもなく、AI organizerを本体へ内蔵する根拠はない。
- 初期ownerはCodex local heartbeatとし、毎日04:00 JSTの一jobで日次整理、日曜だけ後段にread-only auditを行う。
- window closeはtray常駐を維持するが、trayから明示終了するとMCPは停止する。PC sleep、Codex終了中のmissed-runとoverlapの保証は未確認である。
- missed runを保証で埋めず、実行できた時に毎回Inbox全scanでcatch upする。write enable前に実hostでoverlap / quit / sleep復帰を検証する。
- Vaultへrun historyを保存しない。最大10件、per-note revision、systemic failureでstopというbounded contractにする。

