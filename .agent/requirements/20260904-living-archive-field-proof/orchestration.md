# Living Archive Field orchestration

## Execution graph

- AとCは独立に実装し、write surfaceを分離する。
- BはCEO-01がAのpublic APIへ接続する。
- DはA〜C統合後にCEO-01が行う。
- EはDの証拠が揃った後に、制作へ参加していない検証員が行う。

## Capability cards

- MODEL-01: 役職=制作、model=gpt-5.6-luna、reasoning=low、得意=exact contractに沿うdeterministic modelとtest、不得意・上申条件=曖昧な作品判断・renderer変更、必要context=凍結protocolと既存snapshot、検証owner=CEO-01、根拠freshness=current checkout 2026-09-04。
- EVIDENCE-01: 役職=検証基盤制作、model=gpt-5.6-luna、reasoning=low、得意=bounded harness・report schema・機械的検証、不得意・上申条件=美的合否・renderer/model変更、必要context=protocolとpublic diagnostics contract、検証owner=CEO-01、根拠freshness=frozen protocol revision。
- VERIFY-01: 役職=検証、model=gpt-5.6-terra、reasoning=high、得意=複数制約のdefect-first反証、不得意・上申条件=製品変更・TSUZUNE write・工房主の美的採否、必要context=統合candidateと全evidence、検証owner=CEO-01、根拠freshness=integration revision。

## Shared prohibitions

全員、他の変更を戻さない。本番TSUZUNEを書かない。既存prototype、製品code、package、dependency、config、Gitを変更しない。割当外のfileへ書かない。契約外の設計変更が必要なら実装を広げずCEO-01へ戻す。

## Parent unseen checks

- control対象以外のworld identityとreceiptが不変であること。
- cue境界を挟む非整数frame stepでもcamera boundを満たすこと。
- rendererがhidden reset、screen-space authoritative history、source-free cue selectionを持たないこと。

## Integration outcomes

- MODEL-01の初稿は決定論的ledger/worldの骨格として採用したが、3 featureだけでは作品密度と意味対応が不足したため、12の実phenomena、三素材、局所control伝播へCEO-01が統合改訂した。親の追加境界testを含めてscore/world 9 tests PASS。
- EVIDENCE-01のpure harnessは採用した。CEO-01が実Electron runnerへ接続し、visible actual-time 720秒、固定capture、control、reduced motion、context lossまで一回の凍結runで収集した。
- RENDER監査のshader初期化失敗時に診断が残らない指摘を採用し、静的failure fallbackを追加した。その後の実GPU bootでWebGL error 0を確認した。
- REUSE調査はsnapshot/data trait、固定step、shader helperの知見だけを採用し、旧screen-space trail、event-tied camera、90秒loop、overlay UIは不採用とした。
- VERIFY-01は制作へ参加せず、凍結protocol、source、tests、実capture、最終reportをread-onlyで反証した。technical gateはPASS、blocking defectなし、総合採否はblind-controlと工房主の美的判断待ちと判定した。

## Delegation assessment

独立write surfaceをA（model）とC（harness）へ分けた並列化は初期骨格と検証器の立上げを短縮した。一方、作品密度はrendererとの統合判断を要し、MODEL-01成果をそのまま採用せずCEO-01が再作業した。今後もexactなmodel/harnessだけをbounded委譲し、芸術設計と最終統合は親に保持する方針を維持する。
