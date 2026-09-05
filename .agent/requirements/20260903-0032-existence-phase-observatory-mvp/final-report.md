# 観測宙域 MVP R5 最終報告

- date: 2026-09-03
- source status: verified in development working tree
- user visual acceptance: pending
- production status: not updated
- TSUZUNE persistence: complete; revision-guarded update and read-back verified

## 結論

観測宙域を、**実ノート粒子が広い一枚の空間を飛び回り、一時的に集まり、ほどけ、別の集団へ再編し続ける鑑賞画面**へ作り直した。

最大72個の光はすべて取得済み実ノートで、架空の背景星はない。固定scene、固定cluster、中心node、Wiki-link線を廃止した。有限寿命で移動する複数の潮目へ一部粒子だけが参加し、漂流、反発、減衰、終盤のreleaseと重なることで、0〜60秒の同じ連続場に散開、複数群、合流、再分散、別構成が現れる。常設操作は一時停止／再生だけである。

## 理論境界

これは存在相そのもの、自然科学simulation、意味空間、真の集団ではない。保存済みMarkdownの有限な観測presentationである。利用者が採用したTSUZUNE思想を、表示と存在の非同一性、ノートの局所分節、境界の非一意性、relation provenance、欠落と不存在の区別を守る制約として使った。理論cycleや「濃淡」を物理forceへ直訳していない。

名称、Wiki link、語彙、階層、更新時刻は粒子の選抜・位置・運動へ使わない。pathは実ノート対応と決定性のための不透明saltだけである。captionとARIAも、近さ、動き、光、集まりが現在の観測表現であり、関係、分類、重要度、価値、同一性を確定しないと明示する。

## Evidence

- narrow core/view: 2 files / 17 tests PASS
- independent core/view/app safety: 3 files / 115 tests PASS
- full regression: 101 files PASS / 1 SKIP; 973 tests PASS / 1 SKIP
- typecheck／build／acceptance script syntax: PASS
- dense 589/4175: 72 real-note particles、517 observed-outside、1 Canvas、0 edge、1 pause、0〜60秒の7時点、全時点safe bounds、mean motion 13.90px、maximum 27.59px、pause／static reflow／resume／direct-open PASS
- singleton 1/0: 1実ノート粒子、0 edge、漂流、pause／resize／resume／direct-open PASS
- unseen epsilon／iota／kappa／lambda: 2,000 frames、RMS spread 0.306〜0.440、2〜6 visible groups、largest group 11〜45。名称全置換＋900 linksでもmotion invariant
- independent visual／implementation review: accept。P0/P1/P2なし。30〜40秒の大合流は50秒で明確にほどける

Receipts:

- `work/observatory-acceptance-dense-GOfLfz/acceptance-result.json`
- `work/observatory-acceptance-singleton-pGzjo4/acceptance-result.json`

## Not done

production update、Git delivery、active Vaultの自動操作、利用者画面の自動起動は行っていない。AIによる再解釈、provenance付きIdea Proposal、LLM、embedding、自律保存も実装していない。自動testは美しさを証明しないため、30〜40秒の大合流が心地よいピークか、実Vaultで60秒以上見続けたいかは利用者の実見に残る。

## TSUZUNE persistence

再起動後のMCP runtimeが `stale_runtime: false` であることを確認し、既存の `30_知識/TSUZUNE-観測宙域MVP採用・要件定義-実施記録-2026-09-03.md` へR5 evidence packetをrevision付きで一度だけ統合した。

- previous revision: `sha256:13827ba878019562d4344657b9a4e4d07aca3c0d33b817c71e1237bcdddf5d84`
- current revision: `sha256:e28e1ae3457dc2e9e79eb3fcde275477aa9e0c1663442d30318706afd5d8e6f8`
- full read-back: 6647 characters、truncated false、R5結論・停止線・source hashを照合済み
- exact search: 対象1件
- backlink: `10_プロジェクト/TSUZUNE.md` から1件

新規記録、履歴ノート、project／MOCの追記は不要だった。production update、MCP registration、Vault filesystem直書きは行っていない。

## Next gate

利用者が見られる時に明示的に開発版を表示し、実Vaultで少なくとも60秒、散開から大合流、その後の分離と別構成まで実見する。採用後にのみ本番反映を別work itemとして判断する。
