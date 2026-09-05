# Packet B: rendering and language

- Objective: TSUZUNE LIFE Weatherの表現上限を上げる描画API、language、runtime、library構成を比較する。
- Sources: current package/source/prototype、Electronと候補技術の公式一次資料。
- Ownership: `results/B-rendering-language.md`のみ。
- Do: 現行Canvas2D/WebGL2、TypeScript+WGSL/WebGPU、Three.js/WebGL2/WebGPU、Rust/WASM、native sidecar等を必要十分に比較し、作品能力、統合、性能、fallback、保守、provenance、spike costを評価する。
- Do not: 新規dependencyをinstallしない。ベンチ未実施の性能を断定しない。製品codeやTSUZUNEを変更しない。
- Expected output: candidate matrix、推奨、最強の反証、最小benchmark/spike。
- Verification: 変動しうる仕様は公式sourceと観測日付き。language変更とart qualityを因果的に混同しない。

