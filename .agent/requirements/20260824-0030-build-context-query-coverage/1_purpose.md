# build_context query coverage改革

## Goal

`build_context` が、seed単体の文字数や固定3節という実装都合ではなく、利用者がqueryで明示した意図とbundle全体の実効予算に基づいて、必要なseed境界を安定して返すようにする。

## Current failures

1. seed本文が`maxCharacters`以内だと投影が発火せず、related MOCとの配分でseedが切れる。
2. 本文を直接持たない親見出しはscore 0となり、契約名などの重要な構造境界を選べない。
3. punctuationで4意図以上を明示しても固定3節で打ち切られる。

## Non-goals

- semantic embedding、DB、cache、daemon、Hook、新規dependency。
- queryless、temporal、MOC title projectionの意味変更。
- bundleの`maxCharacters`上限緩和。
- unrelated dirty worktreeの整理、Git commit、push。
