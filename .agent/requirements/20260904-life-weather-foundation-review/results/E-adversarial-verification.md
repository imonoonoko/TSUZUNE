# E — LIFE Weather foundation adversarial verification

## 対象・基準面

- **対象の主語:** 「Living Archive Field を、TSUZUNE LIFE Weather の次の隔離art proofとして採用判断に上げてよいか」。製品実装・production・依存追加は対象外。
- **as of:** 2026-09-04 JST。
- **baseline:** dirty checkout。Git revisionは取得していない。検証した主要artifactのSHA-256は `foundation-review.md` `C3D685516D42B6E1AB7D5C1F5D079DAAF0F2B3910937784A9A931CE3EF499E11`、`vertical-slice.md` `A5F20F0DFB9BBFFEC53F3A328A8C33E1252C348BB092742BDB310ECEBEF2460B`、`decision-packet.md` `ADA5097409C3977042868E11117EC26A8CF43ECFED90D65A74D4874D29BF3561`、現行prototype `prototype.mjs` `01B80BF91B449B6E95B8432C13103864B2DCB318F7F5C4B55DD3BE1A1A754A78` / `note-model.mjs` `09A6A393461F24C0CA702971EAEAB6FE5B49DED3DF189B3C2C71BE746F075FD7`。
- **実施した確認:** packet A–D、統合案、vertical slice、decision packet、現行shader/score/workspace sourceをread-onlyで照合。参照されたrepo内sourceは存在を確認し、GPU probe scriptは `node --check` をPASSした。

## Verdict

**approve-with-corrections**。第一proofを隔離したまま進めるという判断は妥当である。ただし下記P1をartifactへ反映しない限り、proofは「美しい抽象画ができた」ことしか証明せず、Vault固有性・連続性・WebGPU移行の正当性を証明できない。P0はない。

## P0 — block

なし。現時点の提案は製品配線、dependency、production、Gitへ越境していない。

## P1 — proofの結論を無効にし得る欠陥

### P1-1: contributor ledgerの因果不変条件がまだない

**根拠:** [`foundation-review.md` — “One note = one conserved contributor” / “Permit a carrier medium”](../foundation-review.md)、[`vertical-slice.md` — “Contributor ledger” と Acceptance 6](../vertical-slice.md)。

`599 logical note IDs`を保持し、material regionのreceiptを置くだけでは、作品を生む主要な形が任意presetや無由来noiseで決まり、あとからsource IDを添える余地が残る。一note一光を捨てること自体は因果を偽装しないが、**形を先に作り、説明を後から足す**構造は防げていない。

**必須修正（最小provenance invariant）:** Archive Scoreの各可視macro変換／material regionについて、`{snapshotDigest, seed, archiveTime, regionOrCueId, channel, noteId, normalizedWeight, carrierTerm}`をdeterministically再生可能にする。全てのsource寄与の正規化規則と、sourceを持たないcarrier term（noise、interpolation、decay）をreceiptへ明示する。region/cueを生成する未記録のsemantic inputは禁止する。同一seed・同一snapshotでは同じreceiptを再生し、controlでは除去対象note/channel以外を不変にしたうえで、事前に予測した局所差が後続regionへ伝播しなければFAILとする。これは「各pixelにnote IDが必要」という要求ではない。

### P1-2: camera/worldの文言は連続性を約束するが、隠れたrebaseを検出できない

**根拠:** [`foundation-review.md` — “The world persists; the camera observes it”](../foundation-review.md)、[`vertical-slice.md` — “Persistent world and camera” と Acceptance 3](../vertical-slice.md)、現行の[`prototype.mjs` — `activeEventComposition`](../../../../work/archive-weather-prototype/prototype.mjs) と [`note-model.mjs` — fixed score](../../../../work/archive-weather-prototype/note-model.mjs)。

現行はevent pairからcomposition center/angleを取り、90秒scoreのevent slotを更新する。新案はこれを批判しているが、「一つの見えるfeatureが連続」に留まると、world全体のrecenter、seedし直し、座標wrap、camera target差替えをeasingで隠せてしまう。

**必須修正:** scoreが変更できるのはworld内のforce/envelopeだけと明記し、cue境界でworld origin、camera transform、seed、既存feature identityを置換・再初期化・rebaseしない。固定した複数のworld feature IDとcamera pose/velocityをcue前・境界中・cue後で記録し、積分stepから導く事前定義の連続性境界を超えたpose/coordinate discontinuityはFAILとする。画面録画によるhuman reviewは、このtraceの代替ではなく補助証拠にする。

### P1-3: acceptanceは方向として正しいが、perceptual/causal判定プロトコルが事前固定されていない

**根拠:** [`vertical-slice.md` — Evidence set / Acceptance 1–7](../vertical-slice.md)。

「randomly selected frame」「owner can visually follow」「clearly different」「no observed cut」は、誰が何を見てPASSにするか、どのcontrolと比較するかを固定していない。ownerの三つの問いは重要だが、単独ではsource removalが可視因果を生んだことを検証できない。frame budgetも“agreed”のままで数値がない。

**必須修正:** render前に、(a) snapshot/seed/archive-timeと0/30/90/240/480/720秒のcapture、(b) current 3B.5・candidate・one-source-removed controlを匿名化した比較順、(c) first-reading、energy-passage、cutの観察質問とPASS規則、(d) target canvas/DPRとframe intervalのp95予算、(e) 受入者と再試行不可の回数を一枚のprotocolへ固定する。telemetry/receiptだけでcontrol差を合格にしてはならず、blind表示で局所差とその後の変化を区別できなければFAILとする。

### P1-4: WebGPU判定用のbenchmarkが提案作品ではなく旧90秒particle scoreを比較する

**根拠:** [`results/B-rendering-language.md` — “Smallest benchmark / spike”, steps 2–3](B-rendering-language.md)、[`vertical-slice.md` — “Three overlapping clocks” / Technology boundary](../vertical-slice.md)、[`results/D-current-path-and-gpu.md` — capability receipt](D-current-path-and-gpu.md)。

Bは旧90秒score、hover label、point/historyの最小passを同一にして比較する。一方、採用するproofはhoverを捨て、固定90秒clockを捨て、world-space materialと12分のoverlapping clocksへ変える。旧prototypeのAPI比較はcapability確認にはなるが、新しい作品にWebGPUが必要かの判定にはならない。

**必須修正:** Bの旧score比較を「capability/pipeline-only」と明記する。WebGPUへの移行条件は、Living Archive Fieldの**同一snapshot・同一seed・同一score・同一canvas/DPR・同一perceptual protocol**で、WebGL2が事前登録したframe budgetを満たせない、またはWebGL2では表せないことを実装で示したsource-grounded material passがある、のどちらかに限定する。Dが示したadapter/device/replacement-device成功は探索可能性の証拠であり、性能・作品優位・packaged parityの証拠ではない。

### P1-5: “full-window”と“reusable tab”のpresentation contractが矛盾したまま

**根拠:** [`foundation-review.md` — Conclusion / Foundation architecture](../foundation-review.md)、[`results/C-tsuzune-placement.md` — Recommendation](C-tsuzune-placement.md)。

統合案は「ordinary workspace disappears」「cover the whole main window」「should not look like a tab」とする一方、Cはfirst sliceでordinary tab barをescape hatchとして残してよいとする。前者なら作品面からtool chromeは退場し、後者なら鑑賞中にもtab UIが残る。これは同じsurfaceの二つの仕様であり、実装者が都合よく選べる。

**必須修正:** “workspace tab is lifecycle/state only; immersive presentation hides activity rail, header, sidebars, and tab bar while active; Escape and a focus-revealed explicit return control remain the only in-work escape routes” か、“central-panel presentation with visible tab bar”のどちらか一つを選ぶ。前者を採るならfull-windowは**同じBrowserWindowのclient area**でありOS fullscreenやsecond windowではない、と明記する。どちらの場合もreturn時のprevious-tab/focusの不変条件とreduced-motion/failure stateを受入に含める。

## P2 — 直すべき精度・境界

### P2-1: 3Dという言葉がfirst proofの範囲より強い

[`foundation-review.md` — Conclusion / Foundation architecture](../foundation-review.md) は「persistent three-dimensional world」と言うが、同文書の“world persists”は「sparse 3D field **or bounded stack of depth layers**」を許す。前者を「persistent world-coordinate representation (sparse 3D when implemented; otherwise bounded depth layers)」に改める。3Dを既決の成果として読ませない。

### P2-2: 存在相との非同一性は保たれているが、vertical slice単体にも同じ注記が要る

`foundation-review.md`の“Permit a carrier medium”は、粒子・voxel・場をcanvas/pigmentとして扱い、noteの価値や存在相そのものへ還元しない点で適切である。だが[`vertical-slice.md`](../vertical-slice.md)単体には同じ境界がない。Purpose直後に「field、flow、depth、materialはこのproofの局所的観測表現であり、存在相そのもの、noteの価値、真の関係を表すものではない」を追加する。

### P2-3: Bのruntime unknownはDの最新receiptと整合しない

[`results/B-rendering-language.md` — Current, verified boundary / Unverified boundaries](B-rendering-language.md) はactual renderer WebGPU adapter/device/recoveryをunknownとするが、Dはhidden Electron rendererでadapter/device creationとintentional loss後のreplacement deviceを記録している。Bを履歴的なpre-probe assessmentと標示し、最新stateはDに置く。Dの限定（性能・作品優位・packaged parityは未証明）は維持する。

## 最強の反証

新しいfieldがより美しくても、matched Vaultでほぼ同じ12分を生成し、source removalがreceiptにしか現れず、viewerが匿名比較でcontrolを見分けられないなら、これはVaultから生じた作品ではなく、Vaultを後付け説明に使う汎用generative artである。この反証が成立した時は、WebGPU、霧、audio、AI解釈、product chromeを足さず、contributor contractとtemporal grammarへ戻るべきである。

## 残る未知

- 12分の無音鑑賞が、飽きではなく再訪性になるか。
- 新しいprovenance invariantがmaterial freedomを過度に狭めず、receiptが鑑賞体験と両立するか。
- pre-registered frame budgetをWebGL2が対象PCで満たすか。満たさない時のWebGPU A/Bは未実施。
- immersive surfaceでchromeを隠した時のkeyboard/focus/low-motion/failure pathの実装品質。製品統合後でなければ検証できない。

## 確認したscope

本verificationはread-only source/doc auditであり、製品コード、package dependency、production TSUZUNE、Git、browser stateを変更していない。
