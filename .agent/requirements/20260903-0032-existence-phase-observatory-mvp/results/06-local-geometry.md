# Result 06 — Local Geometry

## 根本原因

`ObservatoryView`はsceneをopacityとcamera targetにだけ使い、全量node／edgeを描き続けていた。またviewport大のCanvas bitmapを親要素ごとCSS transformしたため、縮小された矩形境界が露出した。

## 採用する最小構造

- `createObservatorySceneGraph(graph, scene)`でscene内nodeとscene内edgeだけを抽出する。
- `layoutObservatoryScene(scene, viewport)`でglobal layout、force、乱数に依存しない局所座標を作る。
- rootを場面のanchorとして扱い、最大8件の隣接noteを安全領域内へ決定論的に配置する。
- Observatoryからglobal `layoutWikiGraph`、camera pan／zoom、Canvas親transformを削除する。
- DOMにもedge rendererにも同じscene graphと同じ局所座標だけを渡す。

## 検証seam

589 node／4175 edge相当でも、各sceneのnodeは9以下、edge endpointはscene内に閉じ、座標はviewport安全領域内、同じ入力では同じ結果になることをpure functionで検査する。

