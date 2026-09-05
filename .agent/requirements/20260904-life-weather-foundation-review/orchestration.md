# Foundation Review Orchestration

## Branching

- A、B、Cは独立にread-only調査し、それぞれ専用resultだけを書く。
- DはCEO-01が現行call pathと実画面を確認する。
- A〜D統合後にEを起動し、推奨案を反証する。
- EでP0が出た場合は推奨を確定せず、証拠が不足する最小spikeへ戻す。

## Capability cards

- ART-01: 役職=制作戦略、model=gpt-5.6-terra、reasoning=high、得意=作品原理と体験の統合、不得意・上申条件=runtime断定や製品変更、必要context=現行art docsと利用者評価、検証owner=CEO-01、根拠freshness=current repo。
- RENDER-01: 役職=技術調査、model=gpt-5.6-terra、reasoning=high、得意=複数runtime/API比較、不得意・上申条件=未計測性能の断定、必要context=package/sourceと公式一次資料、検証owner=CEO-01、根拠freshness=2026-09-04 live docs。
- INTEGRATION-01: 役職=正本・文脈監査、model=gpt-5.6-terra、reasoning=medium、得意=current product pathと運用境界の統合、不得意・上申条件=TSUZUNE writeと採否、必要context=Electron renderer/preload/main/data source、検証owner=CEO-01、根拠freshness=current checkout。
- VERIFY-01: 役職=検証、model=gpt-5.6-terra、reasoning=high、得意=複数制約の反証、不得意・上申条件=高影響変更の承認、必要context=統合案とpacket evidence、検証owner=CEO-01、根拠freshness=integration revision。

## Shared prohibitions

全員、他の変更を戻さない。本番TSUZUNEを書かない。製品code、dependency、config、Gitを変更しない。結果は割り当てられた一ファイルだけへ書く。

