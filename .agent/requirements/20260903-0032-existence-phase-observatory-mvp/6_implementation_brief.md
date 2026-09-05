# 観測宙域 MVP Implementation Brief（R5）

## Architecture

```text
existing WikiGraph
  -> resolved Markdown notes only / deterministic cap <= 72
  -> seeded particle field
       moving temporary tides + partial participation
       near repulsion + drift + damping + soft bounds
       fixed-step deterministic evolution
  -> ObservatoryView
       one DPR-capped Canvas / one requestAnimationFrame loop
       proximity glow + short velocity wakes / no edges
       pointer hit-test + one keyboard stop + pause
```

## Ownership

- `src/core/observatory.ts`: input filtering、seeded field、有限寿命の移動tide、部分参加、step、bounds、hit-testに必要なparticle state。
- `src/renderer/components/ObservatoryView.tsx`: Canvas draw loop、resize／DPR、pause、visibility、reduced motion、pointer／keyboard direct-open、truthful caption。
- `src/renderer/styles.css`: flat Night Workshop field、caption、focus、最低限control。旧scene／link／star animationは削除。
- `tests/observatory.test.ts`: 決定性、実note provenance、72上限、移動、bounds、gather→departure／reform、empty／singleton。
- `tests/observatory-view.test.tsx`: Canvas contract、single rAF、cleanup、pause、input、reduced motion、graph swap。
- `scripts/run-observatory-acceptance.mjs`: offscreen dense／compact／singletonで連続motionと停止、direct-open、no-edgeを受入。

## Invariants

- 全particleは一意の取得済みreal Markdown note。装飾粒子、link由来の意味、固定clusterを作らない。
- 同じinput／seed／fixed timestepは同じstate列になる。
- rendererはReactをframeごとにrerenderせず、一つのrAFと一枚のCanvasだけを更新する。
- hidden／unmount／graph change／reduced motionでloopを止める。DPRは2以下。
- appearanceは観測表現であり、relation／classification／importance／identityの主張ではない。

## Verification commands

```powershell
npx vitest run tests/observatory.test.ts tests/observatory-view.test.tsx --maxWorkers=1
npm run typecheck
npm run build
npm test
npm run acceptance:observatory
node --check scripts/run-observatory-acceptance.mjs
git diff --check -- <task-owned files>
```

## Stop

開発source、tests、offscreen受入、workflow正本、TSUZUNE実施記録まで。本番更新、Git delivery、active Vaultの自動操作、利用者画面の自動起動は別gate。
