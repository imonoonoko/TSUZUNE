# Packet 20: Gate 3C renderer path

- Objective: locate the smallest implementation path and public test seams for the accepted art direction.
- Context: raw WebGL2 Gate 3B.5 at `work/archive-weather-prototype/`.
- Files / sources: `prototype.mjs`, `display-composition.mjs`, existing focused tests.
- Ownership: read-only renderer and test-path analysis; parent owns edits.
- Do: trace camera, particle projection, field/history composition, phase timing, palette, and diagnostics.
- Do not: edit files, add dependencies, touch product source, or broaden beyond the isolated prototype.
- Expected output: exact functions/constants/shaders to change, invariants to preserve, and one RED-test proposal.
- Verification: parent checks every cited location before implementation.

## Result

Complete. `compositeFragment`だけで既存historyを`passageTransmittance`へ変換し、`nebula`加算を撤去した。公開contractをRED→GREENで追加。CPU力学、note数、camera、projection、palette、依存は変更していない。
