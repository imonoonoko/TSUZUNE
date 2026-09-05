# Living Archive Field — isolated art proof

## Goal

Gate 3B.5を製品へ継ぎ足さず、資料由来の流れ、立体的な持続世界、単調でない長時間構成、切替に依存しないカメラを持つ新しい隔離作品として実証する。

## Task Contract

- objective: 本人のVaultに由来するエネルギーの通過を、説明UIなしでも追え、同じ世界をカメラが連続して観測する生成芸術候補を作る。
- deliverables: 凍結済み受入protocol、contributor ledgerとpersistent world model、三素材のWebGL2 renderer、control／再現性／連続性／12分性能の証拠、Codex内ブラウザで鑑賞できる候補。
- constraints: `work/archive-weather-prototype`と製品`src`を変更しない。新規dependency、WebGPU、audio、製品配線、production update、Git deliveryを行わない。field／flow／depth／particleは局所的な作品表現であり、存在相そのもの、noteの価値、真の関係として扱わない。dirty worktreeを保全する。
- success:
  1. 同一snapshot／seedのledger、control差、world feature identity、camera continuityが決定的testで再現する。
  2. 1280x720／DPR 1.0の12分technical runで、3つ以上のmacro composition、frame budget、WebGL error／context-loss境界を検証できる。
  3. 候補がCodex内ブラウザで開き、工房主が「流れ」「持続」「立体感」「再訪性」を作品として判定できる。
- lane: Orchestrated。
- evidence: Nodeのbehavior tests、renderer contract、browser runtime receipt、capture set、technical report、独立verification。
- stop: 技術gateを満たした候補を工房主へ戻す。製品統合や依存追加が必要になった時、または因果／連続性不変条件が成立しない時は範囲を広げず停止する。

## Product value hypothesis

一つ一つのnoteを常時点として陳列する代わりに、noteのidentityを保存された寄与として材質と時間へ流すと、個人archive固有の原因を失わず、星野やparticle demoではない持続的な作品になる。

## Work packets

| Packet | Owner | Scope | State |
| --- | --- | --- | --- |
| A: contributor and world | MODEL-01 + CEO-01 | ledger、score、world feature、camera trace、behavior tests | complete |
| B: live artwork | CEO-01 | HTML/CSS/WebGL2 renderer、三素材、integration | complete |
| C: protocol and evidence harness | EVIDENCE-01 + CEO-01 | frozen protocol、technical runner、capture/receipt schema | complete |
| D: live integration | CEO-01 | narrow/broad tests、server、in-app browser inspection | complete |
| E: adversarial acceptance | VERIFY-01 | defect-first independent verification | complete |

## Integration policy

既存snapshotだけをread-only入力として再利用する。Aのpublic APIをBが消費し、CはA/Bの公開diagnosticsだけを検証する。各write surfaceは重ねず、CEO-01が最終統合と未提示境界検証を行う。

## Verification

- red-greenのmodel／protocol behavior tests
- same input reproducibility and one-phenomenon control
- cue境界を含むcamera/world trace bound
- renderer source contract and browser WebGL2 state
- 12-minute frame interval/composition/error receipt
- reduced-motion and context-loss fallback
- independent adversarial review

## Approval boundary

新規隔離directoryと専用workflow artifactだけが認可済み。製品code、package metadata、依存、production、Git、TSUZUNE以外の外部surfaceは変更しない。

## 2026-09-05 visible-motion correction

- 工房主の「全く動いてない」をowner FAILとして採用し、従来の内部時計だけの受入を撤回した。
- 根因は、疎なbrowser frameで経過時間を毎回`0.1`秒へ切り詰め、現実時間の大半を捨てていたこと。加えてcamera、filament、membrane、witnessの可視変化が知覚閾値未満だった。
- wall timeを欠落させないclockへ直し、同一live pageを3秒隔てて比較するpixel-difference gateを追加した。23 tests、5 syntax checks、8秒current-revision smoke、Codex内browserの実時間追従と可視変化がPASS。
- 以前の12分runは修正前revisionの歴史的証拠とし、現revisionの12分acceptanceには流用しない。次の一手は工房主のlive再鑑賞であり、採用候補になった場合だけcurrent revisionの12分runを行う。

## 2026-09-05 aesthetic regression correction

- 工房主の「前の方が良かった」「ひどすぎる」をowner FAILとして採用し、visible-motion correctionのうちcamera／shaderの増幅を撤回した。
- 疎なframeでもwall timeを捨てないclock修正だけを残し、camera軌道、filament形状、membrane変形、witness位置を直前の静かな表現へ正確に戻した。エネルギーの移動は固定に近い形状を通る光として残す。
- 「画像差が大きいほど良い」という片側gateをやめ、3秒のclock追従と画像差の上下限を持つ回帰guardへ変更した。24 tests、5 syntax checks、8秒smoke、Codex内browserの実時間追従と4秒の目視差分がPASS。
- 現在は技術的な短時間再確認までで、美的採用ではない。次の一手は工房主が戻したlive候補を再鑑賞すること。採用候補になった場合だけcurrent revisionの12分runを行う。

## 2026-09-05 Gate 3B.5 baseline restoration

- 工房主は求めていた「元の宇宙感ある奴」をGate 3B.5とexactに指定した。Living Archive Fieldの増幅前版も復元先ではなく、同proofのowner rereviewを停止した。
- Gate 3B.5の現存正本 `work/archive-weather-prototype/` をコピー・改変せず、稼働中のrepository-root Vite server上の `/work/archive-weather-prototype/` へCodex内browserを切り替えた。
- 白いnote光群、共有field memory、前景／遠景のdepth、凝集・解体・播種、cutしない観測cameraを持つ元の宇宙版がlive表示され、38 tests、syntax、WebGL error 0を確認した。
- 現在の停止線はGate 3B.5を工房主が再鑑賞すること。12分run、Living Archive Fieldとの統合、製品統合、本番反映、Git deliveryは行わない。
