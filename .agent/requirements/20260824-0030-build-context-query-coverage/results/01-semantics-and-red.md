# Packet 01 result

## Accepted RED behaviors

1. seed単体は上限内でも、related protected source追加後に切れる場合は投影する。
2. bodyless parent heading queryは親見出しだけでなく配下内容を返す。
3. punctuationで明示した4 intentを固定3節で落とさない。
4. atomic one-term queryは無関係なfallback sectionへseed予算を使わない。

## Observed RED evidence

- effective-budget fixture: second seed sentinel欠落。
- bodyless-parent fixture: `## 3. Benchmark契約`欠落。
- four-intent fixture: `DO_NOT_SENTINEL`欠落。
- atomic-query fixture: secondary/tertiary section混入、related MOC descriptors欠落。

全fixtureはpublic `buildContextBundle`経路を使う。
