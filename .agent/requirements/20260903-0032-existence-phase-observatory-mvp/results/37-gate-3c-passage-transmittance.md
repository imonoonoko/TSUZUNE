# Gate 3C — 通過が空間を開く

- date: 2026-09-05
- source: `work/archive-weather-prototype/`
- route: `http://127.0.0.1:4175/work/archive-weather-prototype/`
- status: isolated prototype verified; owner artwork acceptance pending

## 結論

Gate 3B.5の白い宇宙、599 note光、連続したdepth／flow／cameraを残し、作品原理を一つだけ追加した。

> 光は消えず、観測された通過だけが空間の透過率を変える。

既存historyを灰色の星雲として足す構成をやめ、note通過履歴の`memorySignal`、密度稜線、flowの折れ、資料現象の局面から、局所の暗部だけを一時的に開く。形成期では光群の周囲に薄い渦状の空間差が生まれ、種蒔き期には広い黒へ戻る。新しい星、線、輪郭、noise、色分類、scene cutは加えていない。

## 変更

- `prototype.mjs`: composite shaderの`nebula`加算を`passageTransmittance`と`openedDarkness`へ置換。
- `renderer-contract.test.mjs`: source-backed passageだけが局所暗部を開き、synthetic sceneryを追加しない契約を追加。
- 初期の`smoothstep`閾値案は濃部が平坦な灰色blobへ寄ったため不採用。指数型の連続露光曲線へ変更し、低いdensity領域の寄与を稜線へ局所化した。

## 検証

- RED: 新contract追加直後はrenderer test 12 PASS／2 FAIL。
- GREEN: focused suite 39 PASS／0 FAIL、`node --check prototype.mjs` PASS。
- live Codex内browser: WebGL boot ready、`glError=0`、599 particles。形成期と90秒相当の種蒔き期を含む複数時点を同一runで確認。
- independent verifier: tests、syntax、one-note-one-light、POINTS only、no hash/noise/nebula/palette、shared camera/history projectionをPASS。live可視化だけは環境制約で未確認のため、親がunseen boundaryとして局所性とbroad wash回避を補完。
- Ponytail review: 新依存・新uniform・新buffer・抽象化なし。既存compositeの一変換で完結し、削除対象なし。

## Agent統合

- `gate3c_art_audit` / Terra medium / 美的監査: 一原理と拒否規則を提示。親は空間透過率だけを採用し、複数renderer案の同時投入は不採用。
- `gate3c_renderer_scout` / Luna low / renderer経路監査: 最小shader/test seamと不変条件を提示。親は新phase pulse案を装飾化リスクのため不採用。
- `gate3c_guard_audit` / Luna low / 歴史的失敗監査: 機械・因果・作品gateの分離とbroad wash guardを採用。
- `gate3c_independent_verify` / Luna low / 独立検証: 静的・回帰をCONDITIONAL PASS。親がlive境界を補完してcandidate verificationを完了。

## 停止線

これは`実装済み`かつ開発routeで`動作確認済み`だが、`利用者確認済み`ではない。美しいか、神秘的か、90秒見たいか、本人のノートだから生じたと感じるかは自動testで証明しない。工房主の採用前に12分run、製品統合、本番反映、音楽、WebGPU、Git deliveryへ進まない。

## 関係

- plan: `../plan.md`
- retrospective: `../retrospective.md`
- art direction: `../packets/19-gate-3c-art-direction-audit.md`
- implementation: `../packets/20-gate-3c-renderer-implementation.md`
- verification: `../packets/21-gate-3c-independent-verification.md`

## TSUZUNE persistence

- 同一campaignの実施記録、Life Weather計画、TSUZUNE入口MOCをGate 3Cのverified boundaryへ一度ずつ更新。
- revision: project `sha256:95605285739d3aec4182721562cba2604fb9ffcadd1186238ebc0a4ff8714710`／record `sha256:a146d051976249862435fe7c77655f1a4311416fe726fd26fd158769351cbd82`／root `sha256:d9ba95ad42fbd9cd7c664160105e80afcbf3c611d518795aa41e55bf0d265310`
- read-back、一意検索、相互backlinkを確認済み。新規実施記録は作成していない。
