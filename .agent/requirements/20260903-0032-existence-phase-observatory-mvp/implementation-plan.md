# 観測宙域 MVP R5 自律生成粒子場 Implementation Plan

## R5 Task Contract

- objective: 観測宙域を固定されたgraph演出から、実ノート粒子が局所的に集まり、分かれ、別のまとまりへ再編し続ける鑑賞優先の自律空間へ作り直す。
- deliverables: 決定的粒子simulation、連続描画、最小操作、時系列test、offscreen Electron acceptance、更新済みworkflow／TSUZUNE実施記録。
- constraints: Markdownと明示Wiki-linkはsourceであり、配置・密度・色・運動は一時的presentation。表示欠落を不存在、リンク欠落を関係不在、粒子群を真の意味clusterと断定しない。新依存、LLM、embedding、app-owned DB、常時edge、production update、Git delivery、利用者画面の自動起動を行わない。
- success: 同一seedで再現可能、時系列で粒子が移動し局所密度の凝集と離脱が観測可能、narrow／typecheck／build／offscreen acceptance／full regressionがPASS。
- lane: Orchestrated。状態正本はこのrequirements directoryの`state.json`。
- evidence: source test、jsdom component test、隔離fixtureによるoffscreen Electron、task-owned diff／hash、既存TSUZUNE実施記録のrevision付きread-back。
- stop: 上記source境界と記録が成立した時点。本番反映または利用者実見には自動で進まない。

## R5 implementation order

1. 粒子状態・局所相互作用・境界・決定性をcoreの公開interfaceでTDD固定する。
2. Rendererを`requestAnimationFrame`の単一運動源へ置換し、pause／reduced motion／direct openを保つ。
3. CSSはNight Workshopの低彩度、余白、奥行き、密度の重なりに限定し、HUD・neon・常時線を作らない。
4. offscreen acceptanceを複数時刻の位置・密度・受動性・停止へ更新する。
5. 独立review後に検証と正本同期を完了する。

## R0–R4 historical boundary

- status: いずれも利用者実見で不採用。R4はsource／build／offscreen検証済みだったが、星野の中の固定link列に留まり、現行仕様ではない。
- preserved value: 表示と存在の非同一性、実ノートprovenance、accessibility、offscreen受入手法だけをR5へ引き継いだ。

## Completed

1. 存在相研究と利用者が採用したTSUZUNE思想から、presentationと存在の非同一性、局所分節、境界の非一意性、relation provenance、欠落と不存在の区別を制約化した。
2. R0 hairball、R1 one-hop、R2/R3最大9星tree、R4星野＋固定link列を実見結果に基づき却下した。
3. `src/core/observatory.ts`を、最大72実ノート、決定的fixed-step、有限寿命で移動する最大5 tide、15〜35%の部分参加、漂流、近距離反発、release、soft boundsへ再実装した。
4. `ObservatoryView.tsx`とCSSを、一枚のDPR-capped Canvas、一つのrAF、残光、淡い密度光、唯一のpause、pointer／keyboard direct-openへ再実装した。edge、scene、fake star、固定clusterを削除した。
5. core/view 17件、独立範囲115件、typecheck、build、script syntax、589/4175 denseの0〜60秒＋compact＋pause/resume＋direct-open、singleton acceptance、全体回帰を通した。
6. 視覚監査は固定四象限・固定群数・恒久中心収束なしとしてaccept。実装監査は未提示4 seed×2,000 frameとsemantic invariantを通し、P0/P1/P2なしとした。
7. workflowをR5正本へ更新した。MCP client再起動後にfresh runtimeを確認し、既存TSUZUNE実施記録をrevision付きで一度だけ更新した。全読戻し、一意検索、project backlinkを確認済み。

## Verification evidence

- narrow: 2 files / 17 tests PASS
- independent narrow: 3 files / 115 tests PASS
- full: 101 files PASS / 1 SKIP; 973 tests PASS / 1 SKIP
- typecheck／build／acceptance script syntax: PASS
- dense receipt: `work/observatory-acceptance-dense-GOfLfz/acceptance-result.json`
- singleton receipt: `work/observatory-acceptance-singleton-pGzjo4/acceptance-result.json`
- dense: 72 real-note particles、517 observed-outside、0 edge、one Canvas、one pause、7 screenshots at 0/10/20/30/40/50/60 seconds、safe bounds、mean motion 13.90px、maximum 27.59px、pause／static reflow／resume／direct-open PASS
- unseen: epsilon／iota／kappa／lambda、2,000 frames、RMS 0.306〜0.440、2〜6 visible groups、largest 11〜45、name replacement＋900 linksでもmotion invariant

## Remaining gates

1. 利用者が望む時だけ開発版を表示し、実Vaultで少なくとも60秒眺め、大合流が一時的なピークで終わり、別構成へほどけることを主観受入する。
2. 利用者採用後にだけproduction updateを別work itemとして判断する。

## Known non-blocking boundaries

- 30〜40秒の一時的な大合流は視覚的に強い。fixtureでは50秒に再分散したが、実Vaultでの鑑賞感覚は未確認。
- 決定的seeded presentationなので、自然乱数や知識意味から生じる物理的な予測不能性ではない。
- fixture受入は美しさ、実Vaultの粒子選抜、長く見続けたい感覚を証明しない。
