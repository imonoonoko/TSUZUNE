# Orchestration

`state.json`だけをlive workflow stateの正本とする。各agentは調査結果を親へ返し、本番Vaultを書かない。

| Packet | Owner | Scope | Forbidden | Expected evidence |
|---|---|---|---|---|
| WEB-01 | web extraction researcher | Proven article-to-text/Markdown extractors、license、bundle、fallback比較 | code編集、Vault書込み、外部service採用 | 一次資料URL、採否、最小integration案 |
| YT-01 | YouTube researcher | Caption取得の既存方式、MV3適合性、失敗状態、live/shorts | code編集、Vault書込み、認証回避 | 一次資料・原作者source、推奨経路、反証 |
| MV3-01 | platform researcher | scripting world、CSP、asset packaging、permissions | code編集、権限拡大、公開 | Chrome公式資料と実装制約 |
| UX-01 | human-first critic | 受信箱へ適当に投入、1〜3クリック、設定負担、誤成功 | code編集、Vault書込み | 採用案への批判、最低限の利用者表示 |
| INT-01 | root | Task Contract、TDD、code/docs、integration、verification、production delivery | 無関係差分、履歴復活、cloud | tests、live evidence、receipt、read-back |

## Integration policy

- 一次資料・原作者repository・現行sourceを優先し、記事やまとめだけで採用しない。
- library採用は、license、browser bundle、maintainability、privacy、既存依存との差分が説明できる場合だけ行う。
- YouTubeの非公開・非公式endpointは、壊れやすさと規約境界を明記し、DOM方式より悪いなら採用しない。
- workerの結論はrootが現物sourceと未提示境界で再検証してから採用する。
- production TSUZUNEへの書込みとproduction updateはrootだけが行う。

