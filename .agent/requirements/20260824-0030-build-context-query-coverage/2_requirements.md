# Task Contract

- objective: queryで明示された各seed境界を、関連source込みのcompact bundleで一貫して保持する。
- deliverables: `src/core/context.ts`、回帰test、MCP公開説明、5ケースBenchmark、本番受入、TSUZUNE実施記録。
- constraints: Markdown正本、厳格な文字数上限、queryless/temporal/MOC互換、dirty worktree保全、新規dependencyなし。
- lane: Orchestrated。
- evidence: RED/GREEN、context全test、typecheck、full test、MCP gate、production receipt、再起動後live 5ケース、latency。
- stop: success条件達成、または既存安全契約を変える必要が判明した時。

## Success criteria

1. 短いseedでもrelated protected sourceとの競合時にはquery投影され、5000文字境界の不連続が消える。
2. 本文なし親見出しのqueryが、その見出しと関連する配下内容を返す。
3. 4つの明示intentを固定3節で落とさず、同一5ケースの3000/5000/8000文字でmarker 16/16・task 5/5を目標とする。

## Behavioral contract

- queryのpunctuation-delimited intentごとに最良のdistinct heading branchを選ぶ。
- 明示intent数は固定3件で切らない。aggregate fallbackだけを最大3節相当へ制限する。
- 親見出しは配下headingを含むbranchとして評価・投影する。
- ancestorとdescendantが同時選択された場合は重複本文を出さない。
- projectionはseed単体長ではなく、full seedとprotected related sourceがbundle実効予算を競合する場合にも使用する。
- queryがない場合、temporal seed、MOC seed、見出しのないnoteは従来動作を維持する。
