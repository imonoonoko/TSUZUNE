# MCP Retrieval Route Observation

Date: 2026-08-13
Status: complete, 3/3 natural samples
Repository start: `agent/tsuzune-mcp-integration` / `560b54df753990fb129f9b0aeac466bf72e08c50` / dirty 99 entries

## Purpose

現行TSUZUNE MCPが、自然なCodex作業で同じ情報の再探索を十分に抑えているかを測る。wire bytesや単純な入力tokenだけでなく、必要な根拠へ到達し、作業を成功させ、安全境界を守れたかを優先する。

この観測はMCP強化の実装ではない。現在不足しているsource／revision単位の再取得証拠だけを3件の自然taskで補い、必要な介入がある場合も一種類だけ選ぶ。

## Eligible Sample

- protocol作成後に自然発生した、TSUZUNEの既存判断・進捗・証拠を必要とするCodex task
- 少なくとも1回、production TSUZUNEの`search`、`fetch`、`build_context`のいずれかを成功させる
- task開始時に目的、成功条件、開始時刻、選択routeを固定する

次はsampleに数えない。

- このprotocol自体の作成・更新
- synthetic benchmark、同じ質問の意図的な繰り返し、trivial lookup
- buildやtest実行が支配的で、TSUZUNE retrievalを評価できないtask
- fixture MCPや通常TSUZUNEへのfallbackを混在させたtask

## Per-sample Record

各sampleはローカルの`work/context-profiler/mcp-retrieval-observation.json`へ記録する。

- taskと1〜3個の成功条件
- route: `search_fetch`、`build_context`、`mixed`
- MCP tool call数と、返却または取得したcanonical note ID／revision
- 同一task内のrepeated search: source状態が変わらないまま同じ正規化queryを再実行した回数
- 同一task内のrepeated retrieval: 同じcanonical note IDとrevisionを再取得した回数
- route escalation、missing source、irrelevant source、evidence sufficiency
- task success、安全境界、elapsed、host usageが正確に観測できる場合だけusage

`build_context`内でサーバーが読んだ個別file回数はhostから見えないため推定しない。`included[].path`は到達sourceとして数えるが、内部read回数とは扱わない。

## Decision Gate

3件を連続採取し、成功sampleへの差し替えは行わない。

- 3/3で作業成功、重大なsource不足なし、meaningfulなrepeated retrievalが0〜1件だけ: 現行MCPを維持し、強化しない
- 2/3以上で同じnote＋revisionを再取得: revision-aware task cacheを最初の候補にする
- 2/3以上で検索漏れまたは低精度: BM25／rankingを最初の候補にする
- 2/3以上で必要sourceへ到達したがbundle過大または必要本文欠落: Context selection／budgetを最初の候補にする
- 品質または安全性の回帰: 最適化を止め、原因修復を先にする

3件で一般的な削減率、実料金、全ホストへの外挿は行わない。選べるのは「変更なし」または次の小さな実験一つだけである。

## Boundaries

- 観測中は製品コード、MCP surface、検索index、cache、Hooksを変更しない
- raw本文、prompt、token明細をGitやTSUZUNEへ複製しない
- TSUZUNEには開始／進捗／結論と根拠pathだけを書き戻す
- O2 Classification Migrationを製品Primary Trackとして維持し、この観測は短いSupporting Trackとする
- sample 3の判定でこのTrackを閉じ、その時点のPrimary queueへ戻る

## Start State

- protocol setupはsample外
- samples: 0/3
- implementation changes: 0
- next: 次のeligibleな自然taskをsample 2として開始前に固定する

## Sample 1 — O2-P4A Implementation Boundary

- result: `pass`
- route: `build_context` 1回 → repository正本の直接読取へescalate
- MCP response: 12,000 characters、included 11、seed truncated、warnings 3
- repeated search: 0
- repeated retrieval: 0。MCP callが1回だけなので同一sourceの再取得は発生していない
- source gap: O2-P4Aの凍結requirementsはrepository正本であり、Context bundleには含まれなかった
- relevance gap: 質問に直接不要な入口、知識地図、backlink、古い履歴もbundleへ含まれた
- success: TSUZUNEで現在Trackを確認し、repositoryのrequirements、implementation brief、Drive adapter、sync service、Path Alias validator、fake remoteを照合して、許可／禁止／停止条件を確定した
- next implementation unit: O2-P4A test-owned fake-remote sidecar syncだけ。既存`google-drive.ts`、`DriveSyncService`、`compilePathAliases`、atomic replace、ledgerを再利用する。UI、MCP、OAuth scope、live Drive、remote relocation、P4B、本番applyは対象外
- interpretation: Context selection／budgetの候補シグナルは1/3で観測したが、実装開始条件の2/3には達していない
- observation gap: `build_context.included`はnote revisionを返さないため、複数call時のsame-revision判定は`fetch`より弱い。今回は1 callなので重複0を確定できる

## Sample 2 — O2-P4A Test-owned Fake-remote Implementation

- result: `pass`
- route: exact phrase search 1回（0件）→ broad search 1回（10件）→ canonical evidence-map fetch 1回 → repository正本と実装へescalate
- canonical TSUZUNE source: `30_知識/TSUZUNE現在地・証拠地図.md` revision `sha256:9fa6...`
- repeated search: 0。二つのnormalized queryは異なる
- repeated retrieval: 5。close時のrevision付きwritebackでproject／evidence noteの完全本文が必要になり、最初の並列fetch出力がhost表示上truncatedしたため、updateと同じatomic host call内で再fetchした。さらにdirty共有worktreeの最終test数訂正で両noteを再取得した。内訳はevidence map 3回、project note 2回のsame-revision再取得
- search gap: `O2-P4A Drive Path Alias sidecar sync`は0件。`Drive Path Alias`は現在地へ到達した一方、`50_履歴/AI更新`の近似重複を多数返した
- success: 凍結repository contractを正本としてtest-only prototypeを実装。16 focused tests、5 files／69 related tests、61 files／585 full tests、typecheckをPASSし、UI／MCP／OAuth／live Drive／P4B／production Vaultを変更しなかった
- evidence: `docs/reports/cp1-c-04-o2-p4a-sidecar-sync-prototype-2026-08-13.md`
- interpretation: search/rankingの候補シグナルは1/3、sample 1のContext selection／budgetシグナルも1/3。same-revision再取得はsample 2で1/3として観測した。いずれも2/3へ達しておらず、sample 3完了までMCP強化を開始しない

## Sample 3 — O2-P4B Test-owned Fake-remote Relocation and Recovery

- result: `pass`
- route: `O2-P4B remote relocation` search 1回（2件）→ canonical evidence-map fetch 1回 → repository正本と実装へescalate
- canonical TSUZUNE source: `30_知識/TSUZUNE現在地・証拠地図.md` revision `sha256:ae3c9520...`
- repeated search: 0
- repeated retrieval: 1。close時のrevision-guarded writebackで、開始時に取得したevidence mapを同一revisionでもう一度fetchした。これは更新安全性に必要な再取得で、cache製品化の根拠には採用しない
- search gap: 2件中1件はcurrent evidence map、もう1件は`50_履歴/AI更新`の近似重複。sample 2と同じ履歴重複が2/3で反復した
- success: 明示planだけを対象に同一Drive file ID、content／parent不変、remote→alias→ledger順、combined recovery、remote／alias／ledger failpoint、remote／local rollback drift packet retention、completion re-readをtest-only fake remoteで固定。12 focused tests、43 related tests、全62 files／608 tests、typecheck PASS
- evidence: `docs/reports/cp1-c-05-o2-p4b-relocation-recovery-prototype-2026-08-13.md`
- safety: live Drive、OAuth、UI、IPC、MCP、production Vault、installed app、commit、push、production updateは変更していない

## Decision

MCP-R1は3/3でtask successと安全境界を満たした。反復した不足はsample 2・3の検索履歴重複であり、search/ranking候補が2/3の閾値に達した。Context bundle過大はsample 1だけ、same-revision再取得はclose writeback由来を含むため、それぞれContext budget／cacheを選ぶ根拠には不足する。

次の小実験は新規BM25ではない。dirty sourceには既に`50_履歴/**`をMCP `search`から既定除外し、`include_history: true`で復元する実装とtestsが存在する一方、sample 3のactive MCP runtimeでは履歴重複が返った。したがって最小介入は、この既存実装をactive runtimeへ反映した隔離受入である。新規BM25、revision cache、Hooks、Context budgetは開始しない。
