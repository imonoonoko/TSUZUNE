# Packet 31 — Gate 3D renderer failure map

- objective: 現行rendererで同心円、薄い個体運動、単調な中心構図を生むexactなcode pathを特定し、削除優先の最小改稿mapを返す。
- owner profile: repository scout。
- source of truth: `work/protostar-field-prototype/prototype.mjs`、`renderer-contract.test.mjs`、`style.css`、`index.html`。
- ownership: read-only code tracing、parameter evidence、diagnostic候補、変更後の境界検証案。
- forbidden: file編集、TSUZUNE write、美術採否、新依存、Gate 3B.5変更。
- acceptance: 原因箇所をfunction／token単位で示し、消すもの・残すもの・置換するもの、個体運動を測るlive metricを返す。
- unseen boundary check: shaderだけ直してpoint layerが従わない、cameraだけ動いて粒子移動に見える、wrapで瞬間移動する、という三失敗を確認する。
- stop/escalation: baseline側の変更が必要と判明したら変更せず親へ返す。
